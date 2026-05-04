import {
  db,
  pipelineJobsTable,
  itemsTable,
  projectsTable,
  reportsTable,
} from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./logger";
import { runRScript, type RStreamEvent } from "./r-runner";

class JobCancelledError extends Error {
  constructor() {
    super("Job cancelled");
    this.name = "JobCancelledError";
  }
}

type Stage = "aigenie" | "difficulty" | "irt" | "sample_design";

const cancellation = new Map<number, boolean>();
// In-memory log buffer per job for SSE streaming. Capped at 500 events.
const jobLogs = new Map<number, RStreamEvent[]>();
const jobListeners = new Map<number, Set<(e: RStreamEvent) => void>>();

export function requestCancel(jobId: number): void {
  cancellation.set(jobId, true);
}

export function getJobLogs(jobId: number): RStreamEvent[] {
  return jobLogs.get(jobId) ?? [];
}

export function subscribeJob(
  jobId: number,
  listener: (e: RStreamEvent) => void,
): () => void {
  let set = jobListeners.get(jobId);
  if (!set) {
    set = new Set();
    jobListeners.set(jobId, set);
  }
  set.add(listener);
  return () => {
    set?.delete(listener);
    if (set && set.size === 0) jobListeners.delete(jobId);
  };
}

function recordEvent(jobId: number, e: RStreamEvent): void {
  let buf = jobLogs.get(jobId);
  if (!buf) {
    buf = [];
    jobLogs.set(jobId, buf);
  }
  buf.push(e);
  if (buf.length > 500) buf.splice(0, buf.length - 500);
  const listeners = jobListeners.get(jobId);
  if (listeners) for (const l of listeners) l(e);
}

async function setProgress(
  jobId: number,
  progress: number,
  message: string,
): Promise<void> {
  // Skip progress writes after cancellation so we don't resurrect a cancelled
  // job back to "running" status.
  if (cancellation.get(jobId)) return;
  await db
    .update(pipelineJobsTable)
    .set({ progress, message, status: "running" })
    .where(eq(pipelineJobsTable.id, jobId));
}

async function complete(
  jobId: number,
  result: Record<string, unknown>,
): Promise<void> {
  await db
    .update(pipelineJobsTable)
    .set({
      status: "completed",
      progress: 1,
      resultJson: result,
      finishedAt: new Date(),
    })
    .where(eq(pipelineJobsTable.id, jobId));
}

async function fail(jobId: number, error: string): Promise<void> {
  await db
    .update(pipelineJobsTable)
    .set({ status: "failed", error, finishedAt: new Date() })
    .where(eq(pipelineJobsTable.id, jobId));
}

async function setProjectStatus(projectId: number, status: string): Promise<void> {
  await db
    .update(projectsTable)
    .set({ status })
    .where(eq(projectsTable.id, projectId));
}

export async function enqueueJob(opts: {
  projectId: number;
  stage: Stage;
  params: Record<string, unknown>;
}): Promise<number> {
  const [row] = await db
    .insert(pipelineJobsTable)
    .values({
      projectId: opts.projectId,
      stage: opts.stage,
      status: "queued",
      paramsJson: opts.params,
    })
    .returning({ id: pipelineJobsTable.id });
  if (!row) throw new Error("Failed to insert job");
  setImmediate(() => {
    runJob(row.id, opts.projectId, opts.stage, opts.params).catch((err) => {
      logger.error({ err, jobId: row.id }, "Unhandled job error");
    });
  });
  return row.id;
}

async function runJob(
  jobId: number,
  projectId: number,
  stage: Stage,
  rawParams: Record<string, unknown>,
): Promise<void> {
  await db
    .update(pipelineJobsTable)
    .set({ status: "running", startedAt: new Date(), progress: 0 })
    .where(eq(pipelineJobsTable.id, jobId));

  const checkCancel = () => {
    if (cancellation.get(jobId)) throw new JobCancelledError();
  };
  const onEvent = (e: RStreamEvent) => {
    recordEvent(jobId, e);
    if (e.type === "progress" && !cancellation.get(jobId)) {
      void setProgress(jobId, e.progress, e.message);
    }
  };

  try {
    if (stage === "aigenie") {
      await setProjectStatus(projectId, "generating");
      const params = (rawParams as { params?: Record<string, unknown> }).params!;
      const project = await db.query.projectsTable.findFirst({
        where: eq(projectsTable.id, projectId),
      });
      if (!project) throw new Error("Project not found");

      const r = await runRScript<{
        items: { text: string; community: number | null }[];
        rounds: number;
        rejected: number;
        egaSummary: { dimensions: number | null; method: string; n_items: number };
        model: string;
      }>("stage1_aigenie.R", { construct: project.construct, params }, { onEvent });
      if (!r.ok) throw new Error(r.error);
      checkCancel();

      if (r.result.items.length > 0) {
        await db.insert(itemsTable).values(
          r.result.items.map((it) => ({
            projectId,
            text: it.text,
            construct: project.construct,
            status: "needs_review",
            generatedBy: r.result.model,
            egaCommunity: it.community,
          })),
        );
      }
      await db.insert(reportsTable).values({
        projectId,
        kind: "aigenie",
        summary: `${r.result.items.length} itens gerados em ${r.result.rounds} rodadas (${r.result.rejected} rejeitados; EGA: ${r.result.egaSummary.dimensions ?? "n/a"} dimensões via ${r.result.egaSummary.method}).`,
        metricsJson: {
          generated: r.result.items.length,
          rounds: r.result.rounds,
          rejected: r.result.rejected,
          ega: r.result.egaSummary,
          model: r.result.model,
          params,
        },
      });
      await complete(jobId, {
        itemsGenerated: r.result.items.length,
        rounds: r.result.rounds,
        rejected: r.result.rejected,
        egaSummary: r.result.egaSummary,
      });
      await setProjectStatus(projectId, "draft");
    } else if (stage === "difficulty") {
      const params = (rawParams as { params?: Record<string, unknown> }).params!;
      const items = await db.query.itemsTable.findMany({
        where: eq(itemsTable.projectId, projectId),
      });
      const r = await runRScript<{
        predictions: { itemId: number; predicted: number }[];
        cvR2: number | null;
        algorithm: string;
        trainSize: number;
        nFeatures: number;
        topFeatures: { feature: string; importance: number }[];
      }>(
        "stage2_difficulty.R",
        {
          items: items.map((it) => ({
            id: it.id,
            text: it.text,
            difficultyEstimated: it.difficultyEstimated,
          })),
          params,
        },
        { onEvent },
      );
      if (!r.ok) throw new Error(r.error);
      checkCancel();

      for (const pred of r.result.predictions) {
        await db
          .update(itemsTable)
          .set({ difficultyPredicted: pred.predicted })
          .where(eq(itemsTable.id, pred.itemId));
      }
      await db.insert(reportsTable).values({
        projectId,
        kind: "difficulty",
        summary: `Predição de dificuldade para ${r.result.predictions.length} itens via ${r.result.algorithm} em R (R²=${r.result.cvR2?.toFixed(3) ?? "n/a"}, ${r.result.nFeatures} features).`,
        metricsJson: {
          predicted: r.result.predictions.length,
          trainSize: r.result.trainSize,
          cvR2: r.result.cvR2,
          algorithm: r.result.algorithm,
          nFeatures: r.result.nFeatures,
          topFeatures: r.result.topFeatures,
        },
      });
      await complete(jobId, {
        predicted: r.result.predictions.length,
        trainSize: r.result.trainSize,
        cvR2: r.result.cvR2,
        algorithm: r.result.algorithm,
        nFeatures: r.result.nFeatures,
        topFeatures: r.result.topFeatures.slice(0, 10),
      });
    } else if (stage === "irt") {
      await setProjectStatus(projectId, "calibrating");
      const params = (rawParams as { params?: Record<string, unknown> }).params!;
      const project = await db.query.projectsTable.findFirst({
        where: eq(projectsTable.id, projectId),
      });
      if (!project) throw new Error("Project not found");
      const items = await db.query.itemsTable.findMany({
        where: eq(itemsTable.projectId, projectId),
      });
      const reviewable = items.filter((it) => it.status !== "rejected");
      if (reviewable.length < 2)
        throw new Error("Pelo menos 2 itens válidos são necessários para IRT.");

      const r = await runRScript<{
        calibrations: {
          itemId: number;
          difficulty: number;
          discrimination: number;
          guessing: number | null;
        }[];
        reliability: number;
        responsesGenerated: number;
        modelFit: Record<string, number>;
        wrightMap: {
          items: { itemId: number; difficulty: number }[];
          thetaHistogram: { bin: number; count: number }[];
          binEdges: number[];
        };
      }>(
        "stage3_irt.R",
        {
          construct: project.construct,
          items: reviewable.map((it) => ({ id: it.id, text: it.text })),
          params,
        },
        { onEvent, timeoutMs: 1000 * 60 * 90 },
      );
      if (!r.ok) throw new Error(r.error);
      checkCancel();

      for (const cal of r.result.calibrations) {
        await db
          .update(itemsTable)
          .set({
            difficultyEstimated: cal.difficulty,
            discrimination: cal.discrimination,
            guessing: cal.guessing,
          })
          .where(eq(itemsTable.id, cal.itemId));
      }
      const irtParams = params as { models: string[]; irtModel: string };
      await db.insert(reportsTable).values({
        projectId,
        kind: "irt",
        summary: `Calibração ${irtParams.irtModel} via ${irtParams.models.length} modelo(s) LLM em R, ${r.result.responsesGenerated} respostas, confiabilidade=${r.result.reliability.toFixed(3)}.`,
        metricsJson: {
          irtModel: irtParams.irtModel,
          syntheticN: (params as { syntheticN: number }).syntheticN,
          responsesGenerated: r.result.responsesGenerated,
          reliability: r.result.reliability,
          modelFit: r.result.modelFit,
          calibrations: r.result.calibrations.length,
          wrightMap: r.result.wrightMap,
        },
      });
      await complete(jobId, {
        calibrations: r.result.calibrations.length,
        reliability: r.result.reliability,
        responsesGenerated: r.result.responsesGenerated,
        modelFit: r.result.modelFit,
        wrightMap: r.result.wrightMap,
      });
      await setProjectStatus(projectId, "ready");
    } else if (stage === "sample_design") {
      const params = (rawParams as { params?: Record<string, unknown> }).params!;
      const items = await db.query.itemsTable.findMany({
        where: eq(itemsTable.projectId, projectId),
      });
      const calibratedItems = items
        .filter((it) => it.difficultyEstimated != null)
        .map((it) => ({
          id: it.id,
          difficulty: it.difficultyEstimated,
          discrimination: it.discrimination,
          guessing: it.guessing,
        }));
      const r = await runRScript<{
        targetSampleN: number;
        targetThetaSE: number;
        perStratum: {
          label: string;
          populationShare: number;
          allocatedN: number;
          sampledN: number | null;
          weight: number;
        }[];
        effectiveN: number;
        designEffect: number;
        testInformationAtZero: number | null;
        itemShortlist: {
          itemId: number;
          info: number;
          difficulty: number;
          discrimination: number;
        }[];
      }>(
        "stage5_sample_design.R",
        { ...params, calibratedItems },
        { onEvent },
      );
      if (!r.ok) throw new Error(r.error);
      checkCancel();

      await db.insert(reportsTable).values({
        projectId,
        kind: "sample_design",
        summary: `Plano amostral para N=${r.result.targetSampleN} (efetivo=${r.result.effectiveN.toFixed(0)}, deff=${r.result.designEffect.toFixed(2)}, ${r.result.perStratum.length} estratos).`,
        metricsJson: r.result as unknown as Record<string, unknown>,
      });
      await complete(jobId, r.result as unknown as Record<string, unknown>);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error({ err, jobId, stage }, "Job failed");
    if (err instanceof JobCancelledError || msg === "Job cancelled") {
      await db
        .update(pipelineJobsTable)
        .set({ status: "cancelled", finishedAt: new Date() })
        .where(eq(pipelineJobsTable.id, jobId));
    } else {
      await fail(jobId, msg);
    }
  } finally {
    cancellation.delete(jobId);
  }
}
