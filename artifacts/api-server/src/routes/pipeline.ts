import { Router, type IRouter } from "express";
import { db, pipelineJobsTable } from "@workspace/db";
import { and, desc, eq } from "drizzle-orm";
import {
  ListPipelineJobsQueryParams,
  GetPipelineJobParams,
  CancelPipelineJobParams,
  RunAigenieStageParams,
  RunAigenieStageBody,
  RunDifficultyStageParams,
  RunDifficultyStageBody,
  RunIrtStageParams,
  RunIrtStageBody,
} from "@workspace/api-zod";
import { enqueueJob, requestCancel } from "../lib/jobs";

const router: IRouter = Router();

router.get("/jobs", async (req, res) => {
  const query = ListPipelineJobsQueryParams.parse(req.query);
  const filters = [];
  if (query.projectId != null) filters.push(eq(pipelineJobsTable.projectId, query.projectId));
  if (query.stage) filters.push(eq(pipelineJobsTable.stage, query.stage));
  const rows = await db.query.pipelineJobsTable.findMany({
    where: filters.length > 0 ? and(...filters) : undefined,
    orderBy: [desc(pipelineJobsTable.createdAt)],
    limit: 200,
  });
  res.json(rows);
});

router.get("/jobs/:id", async (req, res) => {
  const { id } = GetPipelineJobParams.parse(req.params);
  const job = await db.query.pipelineJobsTable.findFirst({
    where: eq(pipelineJobsTable.id, id),
  });
  if (!job) {
    res.status(404).json({ error: "Job não encontrado" });
    return;
  }
  res.json(job);
});

router.post("/jobs/:id/cancel", async (req, res) => {
  const { id } = CancelPipelineJobParams.parse(req.params);
  const job = await db.query.pipelineJobsTable.findFirst({
    where: eq(pipelineJobsTable.id, id),
  });
  if (!job) {
    res.status(404).json({ error: "Job não encontrado" });
    return;
  }
  if (job.status === "running" || job.status === "queued") {
    requestCancel(id);
    await db
      .update(pipelineJobsTable)
      .set({ status: "cancelled", finishedAt: new Date() })
      .where(eq(pipelineJobsTable.id, id));
  }
  const updated = await db.query.pipelineJobsTable.findFirst({
    where: eq(pipelineJobsTable.id, id),
  });
  res.json(updated);
});

router.post("/projects/:id/runs/aigenie", async (req, res) => {
  const { id } = RunAigenieStageParams.parse(req.params);
  const body = RunAigenieStageBody.parse(req.body);
  const jobId = await enqueueJob({
    projectId: id,
    stage: "aigenie",
    params: body as Record<string, unknown>,
  });
  const job = await db.query.pipelineJobsTable.findFirst({
    where: eq(pipelineJobsTable.id, jobId),
  });
  res.status(202).json(job);
});

router.post("/projects/:id/runs/difficulty", async (req, res) => {
  const { id } = RunDifficultyStageParams.parse(req.params);
  const body = RunDifficultyStageBody.parse(req.body);
  const jobId = await enqueueJob({
    projectId: id,
    stage: "difficulty",
    params: body as Record<string, unknown>,
  });
  const job = await db.query.pipelineJobsTable.findFirst({
    where: eq(pipelineJobsTable.id, jobId),
  });
  res.status(202).json(job);
});

router.post("/projects/:id/runs/irt", async (req, res) => {
  const { id } = RunIrtStageParams.parse(req.params);
  const body = RunIrtStageBody.parse(req.body);
  const jobId = await enqueueJob({
    projectId: id,
    stage: "irt",
    params: body as Record<string, unknown>,
  });
  const job = await db.query.pipelineJobsTable.findFirst({
    where: eq(pipelineJobsTable.id, jobId),
  });
  res.status(202).json(job);
});

export default router;
