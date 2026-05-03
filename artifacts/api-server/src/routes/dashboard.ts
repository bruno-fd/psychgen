import { Router, type IRouter } from "express";
import { db, projectsTable, itemsTable, pipelineJobsTable, reportsTable } from "@workspace/db";
import { sql, desc } from "drizzle-orm";
import { GetRecentActivityQueryParams } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/dashboard/summary", async (_req, res) => {
  const [counts] = await db
    .select({
      totalProjects: sql<number>`(select count(*) from ${projectsTable})::int`,
      totalItems: sql<number>`(select count(*) from ${itemsTable})::int`,
      approvedItems: sql<number>`(select count(*) from ${itemsTable} where status = 'approved')::int`,
      jobsRunning: sql<number>`(select count(*) from ${pipelineJobsTable} where status in ('queued','running'))::int`,
      jobsCompleted: sql<number>`(select count(*) from ${pipelineJobsTable} where status = 'completed')::int`,
      jobsFailed: sql<number>`(select count(*) from ${pipelineJobsTable} where status = 'failed')::int`,
    })
    .from(sql`(select 1) as _`);

  const itemsByConstruct = await db
    .select({
      construct: itemsTable.construct,
      count: sql<number>`count(*)::int`,
    })
    .from(itemsTable)
    .groupBy(itemsTable.construct)
    .orderBy(desc(sql`count(*)`));

  res.json({
    totalProjects: counts?.totalProjects ?? 0,
    totalItems: counts?.totalItems ?? 0,
    approvedItems: counts?.approvedItems ?? 0,
    jobsRunning: counts?.jobsRunning ?? 0,
    jobsCompleted: counts?.jobsCompleted ?? 0,
    jobsFailed: counts?.jobsFailed ?? 0,
    itemsByConstruct,
  });
});

router.get("/dashboard/activity", async (req, res) => {
  const { limit } = GetRecentActivityQueryParams.parse(req.query);

  const jobs = await db
    .select({
      id: pipelineJobsTable.id,
      projectId: pipelineJobsTable.projectId,
      projectName: projectsTable.name,
      stage: pipelineJobsTable.stage,
      status: pipelineJobsTable.status,
      message: pipelineJobsTable.message,
      createdAt: pipelineJobsTable.createdAt,
      updatedAt: pipelineJobsTable.updatedAt,
    })
    .from(pipelineJobsTable)
    .innerJoin(projectsTable, sql`${projectsTable.id} = ${pipelineJobsTable.projectId}`)
    .orderBy(desc(pipelineJobsTable.updatedAt))
    .limit(limit);

  const projects = await db
    .select({
      id: projectsTable.id,
      name: projectsTable.name,
      createdAt: projectsTable.createdAt,
    })
    .from(projectsTable)
    .orderBy(desc(projectsTable.createdAt))
    .limit(limit);

  const activity = [
    ...jobs.map((j) => ({
      id: j.id * 10 + 1,
      type:
        j.status === "completed"
          ? ("job_completed" as const)
          : j.status === "failed"
            ? ("job_failed" as const)
            : ("job_started" as const),
      projectId: j.projectId,
      projectName: j.projectName,
      stage: j.stage,
      message: j.message ?? `Etapa ${j.stage} ${j.status}`,
      createdAt: j.updatedAt,
    })),
    ...projects.map((p) => ({
      id: p.id * 10 + 2,
      type: "project_created" as const,
      projectId: p.id,
      projectName: p.name,
      stage: null,
      message: `Projeto "${p.name}" criado`,
      createdAt: p.createdAt,
    })),
  ]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, limit);

  res.json(activity);
});

export default router;
