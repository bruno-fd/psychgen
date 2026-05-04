import { Router, type IRouter } from "express";
import { db, projectsTable, itemsTable, pipelineJobsTable } from "@workspace/db";
import { eq, sql, and, desc } from "drizzle-orm";
import {
  CreateProjectBody,
  UpdateProjectBody,
  GetProjectParams,
  UpdateProjectParams,
  DeleteProjectParams,
  GetProjectPipelineParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

async function projectWithCounts(projectId: number) {
  const project = await db.query.projectsTable.findFirst({
    where: eq(projectsTable.id, projectId),
  });
  if (!project) return null;
  const counts = await db
    .select({
      total: sql<number>`count(*)::int`,
      approved: sql<number>`count(*) filter (where ${itemsTable.status} = 'approved')::int`,
    })
    .from(itemsTable)
    .where(eq(itemsTable.projectId, projectId));
  return {
    ...project,
    itemCount: counts[0]?.total ?? 0,
    approvedCount: counts[0]?.approved ?? 0,
  };
}

router.get("/projects", async (_req, res) => {
  const rows = await db
    .select({
      id: projectsTable.id,
      name: projectsTable.name,
      construct: projectsTable.construct,
      description: projectsTable.description,
      language: projectsTable.language,
      targetAudience: projectsTable.targetAudience,
      publisher: projectsTable.publisher,
      status: projectsTable.status,
      createdAt: projectsTable.createdAt,
      updatedAt: projectsTable.updatedAt,
      itemCount: sql<number>`count(${itemsTable.id})::int`.as("item_count"),
      approvedCount:
        sql<number>`count(${itemsTable.id}) filter (where ${itemsTable.status} = 'approved')::int`.as(
          "approved_count",
        ),
    })
    .from(projectsTable)
    .leftJoin(itemsTable, eq(itemsTable.projectId, projectsTable.id))
    .groupBy(projectsTable.id)
    .orderBy(desc(projectsTable.updatedAt));
  res.json(rows);
});

router.post("/projects", async (req, res) => {
  const body = CreateProjectBody.parse(req.body);
  const [row] = await db
    .insert(projectsTable)
    .values({
      name: body.name,
      construct: body.construct,
      description: body.description ?? null,
      language: body.language ?? "pt-BR",
      targetAudience: body.targetAudience,
      publisher: body.publisher ?? null,
    })
    .returning();
  if (!row) {
    res.status(500).json({ error: "Failed to create project" });
    return;
  }
  res.status(201).json({ ...row, itemCount: 0, approvedCount: 0 });
});

router.get("/projects/:id", async (req, res) => {
  const { id } = GetProjectParams.parse(req.params);
  const project = await projectWithCounts(id);
  if (!project) {
    res.status(404).json({ error: "Projeto não encontrado" });
    return;
  }
  res.json(project);
});

router.patch("/projects/:id", async (req, res) => {
  const { id } = UpdateProjectParams.parse(req.params);
  const body = UpdateProjectBody.parse(req.body);
  const updates: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(body)) {
    if (v !== undefined) updates[k] = v;
  }
  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: "Nenhum campo para atualizar" });
    return;
  }
  await db.update(projectsTable).set(updates).where(eq(projectsTable.id, id));
  const project = await projectWithCounts(id);
  if (!project) {
    res.status(404).json({ error: "Projeto não encontrado" });
    return;
  }
  res.json(project);
});

router.delete("/projects/:id", async (req, res) => {
  const { id } = DeleteProjectParams.parse(req.params);
  await db.delete(projectsTable).where(eq(projectsTable.id, id));
  res.status(204).send();
});

router.get("/projects/:id/pipeline", async (req, res) => {
  const { id } = GetProjectPipelineParams.parse(req.params);
  const stages = ["aigenie", "difficulty", "irt", "sample_design"] as const;
  const results = await Promise.all(
    stages.map(async (stage) => {
      const jobs = await db.query.pipelineJobsTable.findMany({
        where: and(
          eq(pipelineJobsTable.projectId, id),
          eq(pipelineJobsTable.stage, stage),
        ),
        orderBy: [desc(pipelineJobsTable.createdAt)],
      });
      const latest = jobs[0];
      const status = !latest
        ? "not_started"
        : latest.status === "running" || latest.status === "queued"
          ? "running"
          : latest.status === "completed"
            ? "completed"
            : latest.status === "failed"
              ? "failed"
              : "not_started";
      return {
        stage,
        status,
        jobCount: jobs.length,
        latestJob: latest ?? null,
      };
    }),
  );
  res.json({ projectId: id, stages: results });
});

router.get("/projects/:id/items", async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: "ID inválido" });
    return;
  }
  const rows = await db.query.itemsTable.findMany({
    where: eq(itemsTable.projectId, id),
    orderBy: [desc(itemsTable.createdAt)],
  });
  res.json(rows);
});

export default router;
