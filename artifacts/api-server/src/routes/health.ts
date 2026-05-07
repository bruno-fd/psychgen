import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { runStage as runRScript, isRemoteREngine } from "../lib/r-client";
import { logger } from "../lib/logger";

const router: IRouter = Router();

interface RPackageStatus {
  name: string;
  available: boolean;
  version: string | null;
}

interface DeepHealthResponse {
  status: "ok" | "degraded";
  db: "ok" | "error";
  openai: "configured" | "missing";
  anthropic: "configured" | "missing";
  rEngine: {
    mode: "http" | "subprocess";
    rVersion: string | null;
    aigenieAvailable: boolean | null;
    udpipeModelCached: boolean | null;
    packages: RPackageStatus[];
    /** Present when the deep R check failed entirely. */
    error?: string;
    /** Set when ?deep=1 was not passed. */
    skipped?: boolean;
  };
}

router.get("/healthz", async (req, res) => {
  const out: DeepHealthResponse = {
    status: "ok",
    db: "ok",
    openai:
      process.env["OPENAI_API_KEY"] || process.env["AI_INTEGRATIONS_OPENAI_API_KEY"]
        ? "configured"
        : "missing",
    anthropic:
      process.env["ANTHROPIC_API_KEY"] ||
      process.env["AI_INTEGRATIONS_ANTHROPIC_API_KEY"]
        ? "configured"
        : "missing",
    rEngine: {
      mode: isRemoteREngine() ? "http" : "subprocess",
      rVersion: null,
      aigenieAvailable: null,
      udpipeModelCached: null,
      packages: [],
      skipped: true,
    },
  };

  try {
    await db.execute(sql`SELECT 1`);
  } catch (err) {
    out.db = "error";
    out.status = "degraded";
    logger.error({ err }, "DB healthcheck failed");
  }

  if (req.query["deep"] === "1") {
    delete out.rEngine.skipped;
    try {
      const r = await runRScript<{
        rVersion: string;
        aigenieAvailable?: boolean;
        udpipeModelCached?: boolean;
        packages: RPackageStatus[];
      }>("healthcheck.R", {}, { timeoutMs: 30_000 });
      if (r.ok) {
        out.rEngine.rVersion = r.result.rVersion;
        out.rEngine.aigenieAvailable = r.result.aigenieAvailable ?? false;
        out.rEngine.udpipeModelCached = r.result.udpipeModelCached ?? false;
        out.rEngine.packages = r.result.packages;
        if (r.result.packages.some((p) => !p.available)) out.status = "degraded";
      } else {
        out.rEngine.error = r.error;
        out.status = "degraded";
      }
    } catch (err) {
      out.rEngine.error = err instanceof Error ? err.message : String(err);
      out.status = "degraded";
      logger.error({ err }, "R healthcheck failed");
    }
  }

  res.json(out);
});

export default router;
