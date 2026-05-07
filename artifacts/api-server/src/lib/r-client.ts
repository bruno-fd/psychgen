import type { RStreamEvent, RRunResult, RRunError, RunRScriptOptions } from "./r-runner";
import { runRScript } from "./r-runner";
import { logger } from "./logger";

const R_ENGINE_URL = process.env["R_ENGINE_URL"];

const STAGE_TO_HTTP_PATH: Record<string, string> = {
  "stage1_aigenie.R": "/run/aigenie",
  "stage2_difficulty.R": "/run/difficulty",
  "stage3_irt.R": "/run/irt",
  "stage5_sample_design.R": "/run/sample-design",
  "export_xlsx.R": "/run/export-xlsx",
  "healthcheck.R": "/healthz",
};

/**
 * Dispatch an R stage either to the Plumber HTTP service (production /
 * docker-compose) or to a local Rscript subprocess (Replit dev fallback).
 *
 * Picked at runtime via R_ENGINE_URL.
 */
export async function runStage<T>(
  scriptName: string,
  input: unknown,
  opts: RunRScriptOptions = {},
): Promise<RRunResult<T> | RRunError> {
  if (!R_ENGINE_URL) {
    logger.debug({ scriptName }, "R_ENGINE_URL not set — using local Rscript subprocess");
    return runRScript<T>(scriptName, input, opts);
  }

  const path = STAGE_TO_HTTP_PATH[scriptName];
  if (!path) {
    return {
      ok: false,
      error: `Unknown R script: ${scriptName}`,
      stderr: "",
      events: [],
    };
  }

  const events: RStreamEvent[] = [];
  const pushEvent = (e: RStreamEvent) => {
    events.push(e);
    opts.onEvent?.(e);
  };

  // Synthetic progress so the UI gets at least start/stop signals while the
  // R-engine is processing (Plumber is sync; per-stage progress comes via
  // `docker compose logs r-engine`).
  pushEvent({
    type: "log",
    level: "info",
    message: `Enviando para r-engine ${path}`,
    ts: new Date().toISOString(),
  });
  pushEvent({
    type: "progress",
    progress: 0.05,
    message: "Executando no R engine…",
    ts: new Date().toISOString(),
  });

  const url = `${R_ENGINE_URL.replace(/\/+$/, "")}${path}`;
  const timeoutMs = opts.timeoutMs ?? 1000 * 60 * 60;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method: scriptName === "healthcheck.R" ? "GET" : "POST",
      headers: { "content-type": "application/json" },
      body: scriptName === "healthcheck.R" ? undefined : JSON.stringify(input ?? {}),
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      pushEvent({
        type: "log",
        level: "error",
        message: `r-engine HTTP ${res.status}: ${text.slice(0, 500)}`,
        ts: new Date().toISOString(),
      });
      return {
        ok: false,
        error: `r-engine HTTP ${res.status}`,
        stderr: text,
        events,
      };
    }

    const body = (await res.json()) as
      | { ok: true; result: T }
      | { ok: false; error: string; traceback?: string }
      | T; // healthz returns the raw object

    // Healthz path: response is the raw status object
    if (scriptName === "healthcheck.R") {
      pushEvent({
        type: "progress",
        progress: 1,
        message: "OK",
        ts: new Date().toISOString(),
      });
      return { ok: true, result: body as T, events };
    }

    if (typeof body === "object" && body !== null && "ok" in body) {
      if ((body as { ok: boolean }).ok) {
        pushEvent({
          type: "progress",
          progress: 1,
          message: "Concluído",
          ts: new Date().toISOString(),
        });
        return { ok: true, result: (body as { result: T }).result, events };
      }
      const err = body as { error: string; traceback?: string };
      pushEvent({
        type: "log",
        level: "error",
        message: err.error,
        ts: new Date().toISOString(),
      });
      return { ok: false, error: err.error, stderr: err.traceback ?? "", events };
    }

    // Fallback (shouldn't happen if plumber.R is in sync)
    return { ok: true, result: body as T, events };
  } catch (err) {
    clearTimeout(timer);
    const msg = err instanceof Error ? err.message : String(err);
    pushEvent({
      type: "log",
      level: "error",
      message: `Falha ao chamar r-engine: ${msg}`,
      ts: new Date().toISOString(),
    });
    return { ok: false, error: msg, stderr: "", events };
  }
}

export function isRemoteREngine(): boolean {
  return Boolean(R_ENGINE_URL);
}
