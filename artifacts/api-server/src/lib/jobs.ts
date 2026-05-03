import { db, pipelineJobsTable, itemsTable, projectsTable, reportsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./logger";
import { runAigenie, type AigenieParams } from "./aigenie";
import { runDifficulty, type DifficultyParams } from "./difficulty";
import { runIrt, type IrtParams } from "./irt";

type Stage = "aigenie" | "difficulty" | "irt";

const cancellation = new Map<number, boolean>();

export function requestCancel(jobId: number): void {
  cancellation.set(jobId, true);
}

async function setProgress(jobId: number, progress: number, message: string): Promise<void> {
  await db
    .update(pipelineJobsTable)
    .set({ progress, message, status: "running" })
    .where(eq(pipelineJobsTable.id, jobId));
}

async function complete(jobId: number, result: Record<string, unknown>): Promise<void> {
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
  // Fire and forget — runs in this Node process
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

  const onProgress = (p: number, msg: string) => {
    if (cancellation.get(jobId)) {
      throw new Error("Job cancelled");
    }
    void setProgress(jobId, p, msg);
  };

  try {
    if (stage === "aigenie") {
      await setProjectStatus(projectId, "generating");
      const params = (rawParams as { params?: AigenieParams }).params!;
      const project = await db.query.projectsTable.findFirst({
        where: eq(projectsTable.id, projectId),
      });
      if (!project) throw new Error("Project not found");

      const result = await runAigenie(project.construct, params, onProgress);
      // Persist generated items
      if (result.items.length > 0) {
        await db.insert(itemsTable).values(
          result.items.map((it) => ({
            projectId,
            text: it.text,
            construct: project.construct,
            status: "needs_review",
            generatedBy: params.model,
            egaCommunity: it.community,
          })),
        );
      }
      await db.insert(reportsTable).values({
        projectId,
        kind: "aigenie",
        summary: `${result.items.length} itens gerados em ${result.rounds} rodadas (${result.rejected} rejeitados).`,
        metricsJson: {
          generated: result.items.length,
          rounds: result.rounds,
          rejected: result.rejected,
          model: params.model,
          temperature: params.temperature,
          egaThreshold: params.egaThreshold,
        },
      });
      await complete(jobId, {
        itemsGenerated: result.items.length,
        rounds: result.rounds,
        rejected: result.rejected,
      });
      await setProjectStatus(projectId, "draft");
    } else if (stage === "difficulty") {
      const params = (rawParams as { params?: DifficultyParams }).params!;
      const items = await db.query.itemsTable.findMany({
        where: eq(itemsTable.projectId, projectId),
      });
      const result = await runDifficulty(items, params, onProgress);
      for (const pred of result.predictions) {
        await db
          .update(itemsTable)
          .set({ difficultyPredicted: pred.predicted })
          .where(eq(itemsTable.id, pred.itemId));
      }
      await db.insert(reportsTable).values({
        projectId,
        kind: "difficulty",
        summary: `Predição de dificuldade para ${result.predictions.length} itens via ${result.algorithm} (R²=${result.cvR2?.toFixed(3) ?? "n/a"}).`,
        metricsJson: {
          predicted: result.predictions.length,
          trainSize: result.trainSize,
          cvR2: result.cvR2,
          algorithm: result.algorithm,
        },
      });
      await complete(jobId, {
        predicted: result.predictions.length,
        trainSize: result.trainSize,
        cvR2: result.cvR2,
        algorithm: result.algorithm,
      });
    } else if (stage === "irt") {
      await setProjectStatus(projectId, "calibrating");
      const params = (rawParams as { params?: IrtParams }).params!;
      const project = await db.query.projectsTable.findFirst({
        where: eq(projectsTable.id, projectId),
      });
      if (!project) throw new Error("Project not found");
      const items = await db.query.itemsTable.findMany({
        where: eq(itemsTable.projectId, projectId),
      });
      const reviewable = items.filter((it) => it.status !== "rejected");
      if (reviewable.length < 2) {
        throw new Error("Pelo menos 2 itens válidos são necessários para IRT.");
      }
      const result = await runIrt(
        reviewable.map((it) => ({ id: it.id, text: it.text })),
        project.construct,
        params,
        onProgress,
      );
      for (const cal of result.calibrations) {
        await db
          .update(itemsTable)
          .set({
            difficultyEstimated: cal.difficulty,
            discrimination: cal.discrimination,
            guessing: cal.guessing,
          })
          .where(eq(itemsTable.id, cal.itemId));
      }
      await db.insert(reportsTable).values({
        projectId,
        kind: "irt",
        summary: `Calibração ${params.irtModel} via ${params.models.length} modelo(s) LLM, ${result.responsesGenerated} respostas, confiabilidade=${result.reliability.toFixed(3)}.`,
        metricsJson: {
          irtModel: params.irtModel,
          syntheticN: params.syntheticN,
          responsesGenerated: result.responsesGenerated,
          reliability: result.reliability,
          modelFit: result.modelFit,
          calibrations: result.calibrations.length,
        },
      });
      await complete(jobId, {
        calibrations: result.calibrations.length,
        reliability: result.reliability,
        responsesGenerated: result.responsesGenerated,
        modelFit: result.modelFit,
      });
      await setProjectStatus(projectId, "ready");
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error({ err, jobId, stage }, "Job failed");
    if (msg === "Job cancelled") {
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
