import { Router, type IRouter } from "express";
import { db, projectsTable, itemsTable, reportsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { ExportProjectXlsxParams } from "@workspace/api-zod";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { readFile, unlink } from "node:fs/promises";
import { runStage } from "../lib/r-client";
import { logger } from "../lib/logger";

const router: IRouter = Router();

router.get("/projects/:id/export.xlsx", async (req, res) => {
  const { id } = ExportProjectXlsxParams.parse(req.params);
  const project = await db.query.projectsTable.findFirst({
    where: eq(projectsTable.id, id),
  });
  if (!project) {
    res.status(404).json({ error: "Projeto não encontrado" });
    return;
  }
  const [items, reports] = await Promise.all([
    db.query.itemsTable.findMany({ where: eq(itemsTable.projectId, id) }),
    db.query.reportsTable.findMany({ where: eq(reportsTable.projectId, id) }),
  ]);

  const outPath = join(tmpdir(), `psychgen-${id}-${Date.now()}.xlsx`);
  const r = await runStage<{ outputPath: string; sheets: string[] }>(
    "export_xlsx.R",
    {
      outputPath: outPath,
      project: {
        ...project,
        createdAt: project.createdAt.toISOString(),
        updatedAt: project.updatedAt.toISOString(),
      },
      items,
      reports: reports.map((r) => ({
        ...r,
        createdAt: r.createdAt.toISOString(),
      })),
    },
    { timeoutMs: 60_000 },
  );
  if (!r.ok) {
    logger.error({ err: r.error }, "XLSX export failed");
    res.status(500).json({ error: r.error });
    return;
  }
  try {
    const buf = await readFile(outPath);
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${project.name.replace(/[^a-z0-9]+/gi, "_")}.xlsx"`,
    );
    res.send(buf);
  } finally {
    await unlink(outPath).catch(() => {});
  }
});

export default router;
