import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { runStage as runRScript, isRemoteREngine } from "../lib/r-client";
import { logger } from "../lib/logger";

const router: IRouter = Router();

router.get("/healthz", async (_req, res) => {
  const status: Record<string, string> = { status: "ok" };

  try {
    await db.execute(sql`SELECT 1`);
    status.db = "ok";
  } catch (err) {
    status.db = "error";
    status.status = "degraded";
    logger.error({ err }, "DB healthcheck failed");
  }

  status.openai =
    process.env["OPENAI_API_KEY"] || process.env["AI_INTEGRATIONS_OPENAI_API_KEY"]
      ? "configured"
      : "missing";
  status.anthropic =
    process.env["ANTHROPIC_API_KEY"] ||
    process.env["AI_INTEGRATIONS_ANTHROPIC_API_KEY"]
      ? "configured"
      : "missing";
  status.rEngineMode = isRemoteREngine() ? "http" : "subprocess";

  // R runtime + key R packages — only run on demand (?deep=1) since each call
  // spawns Rscript and takes ~2s.
  if (_req.query.deep === "1") {
    try {
      const r = await runRScript<{
        rVersion: string;
        packages: { name: string; available: boolean; version: string | null }[];
      }>("healthcheck.R", {}, { timeoutMs: 30_000 });
      if (r.ok) {
        status.rRuntime = r.result.rVersion;
        for (const p of r.result.packages) {
          status[`r_${p.name}`] = p.available ? p.version ?? "ok" : "missing";
          if (!p.available) status.status = "degraded";
        }
      } else {
        status.rRuntime = "error";
        status.status = "degraded";
      }
    } catch (err) {
      status.rRuntime = "error";
      status.status = "degraded";
      logger.error({ err }, "R healthcheck failed");
    }
  } else {
    status.rRuntime = "not_checked";
  }

  res.json(status);
});

export default router;
