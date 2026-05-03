import { Router, type IRouter } from "express";
import { db, reportsTable } from "@workspace/db";
import { and, desc, eq } from "drizzle-orm";
import { ListReportsQueryParams, GetReportParams } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/reports", async (req, res) => {
  const { projectId } = ListReportsQueryParams.parse(req.query);
  const filters = projectId != null ? [eq(reportsTable.projectId, projectId)] : [];
  const rows = await db.query.reportsTable.findMany({
    where: filters.length > 0 ? and(...filters) : undefined,
    orderBy: [desc(reportsTable.createdAt)],
    limit: 200,
  });
  res.json(rows);
});

router.get("/reports/:id", async (req, res) => {
  const { id } = GetReportParams.parse(req.params);
  const report = await db.query.reportsTable.findFirst({
    where: eq(reportsTable.id, id),
  });
  if (!report) {
    res.status(404).json({ error: "Relatório não encontrado" });
    return;
  }
  res.json(report);
});

export default router;
