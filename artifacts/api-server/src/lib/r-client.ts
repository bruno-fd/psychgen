import { promises as fs } from "node:fs";
import { join } from "node:path";
import type {
  RStreamEvent,
  RRunResult,
  RRunError,
  RunRScriptOptions,
} from "./r-runner";
import { runRScript } from "./r-runner";
import { logger } from "./logger";

const R_ENGINE_URL = process.env["R_ENGINE_URL"];
const JOBS_LOG_DIR = process.env["JOBS_LOG_DIR"] ?? "/srv/jobs-logs";

const STAGE_TO_HTTP_PATH: Record<string, string> = {
  "stage1_aigenie.R": "/run/aigenie",
  "stage2_difficulty.R": "/run/difficulty",
  "stage3_irt.R": "/run/irt",
  "stage5_sample_design.R": "/run/sample-design",
  "export_xlsx.R": "/run/export-xlsx",
  "healthcheck.R": "/healthz",
};

export interface RunOptions extends RunRScriptOptions {
  /** When set, r-engine writes per-job NDJSON logs that the client tails. */
  jobId?: number;
}

function parseLogLine(line: string): RStreamEvent | null {
  if (line.startsWith("PSYCHGEN_PROGRESS ")) {
    try {
      const j = JSON.parse(line.slice("PSYCHGEN_PROGRESS ".length));
      return { type: "progress", progress: j.progress, message: j.message ?? "", ts: j.ts };
    } catch {
      return null;
    }
  }
  if (line.startsWith("PSYCHGEN_LOG ")) {
    try {
      const j = JSON.parse(line.slice("PSYCHGEN_LOG ".length));
      return { type: "log", level: j.level ?? "info", message: j.message ?? "", ts: j.ts };
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Tail an NDJSON log file written by the r-engine sink, parsing each line
 * into an RStreamEvent and forwarding to `onEvent`. Polls every 200 ms until
 * `stop()` is called.
 */
function tailJobLog(
  filePath: string,
  onEvent: (e: RStreamEvent) => void,
): { stop: () => void } {
  let stopped = false;
  let offset = 0;
  let buf = "";

  const tick = async () => {
    try {
      const stat = await fs.stat(filePath).catch(() => null);
      if (stat && stat.size > offset) {
        const fh = await fs.open(filePath, "r");
        try {
          const len = stat.size - offset;
          const data = Buffer.alloc(len);
          await fh.read(data, 0, len, offset);
          offset = stat.size;
          buf += data.toString("utf-8");
        } finally {
          await fh.close();
        }
        let nl: number;
        while ((nl = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, nl).replace(/\r$/, "");
          buf = buf.slice(nl + 1);
          if (!line) continue;
          const ev = parseLogLine(line);
          if (ev) onEvent(ev);
        }
      }
    } catch (err) {
      logger.debug({ err, filePath }, "tailJobLog tick failed");
    }
    if (!stopped) setTimeout(tick, 200);
  };
  setTimeout(tick, 0);

  return {
    stop: () => {
      stopped = true;
    },
  };
}

/**
 * POST a generated R script (the canonical "source of truth" produced by
 * `r-syntax/`) to the r-engine for execution. The same script is what the
 * user previews and downloads.
 *
 * Falls back to a local subprocess (`Rscript <tmp>.R`) when R_ENGINE_URL is
 * not set — used by the Replit dev environment.
 */
export async function runScript<T>(
  script: string,
  payload: unknown,
  opts: RunOptions = {},
): Promise<RRunResult<T> | RRunError> {
  if (!R_ENGINE_URL) {
    logger.debug("R_ENGINE_URL not set — running script via local Rscript subprocess");
    return runScriptLocally<T>(script, payload, opts);
  }
  return runScriptHttp<T>(script, payload, opts);
}

/**
 * POST a named stage script to the r-engine (or fall back to subprocess).
 * Used by `healthcheck.R` and by callers that haven't migrated to runScript.
 */
export async function runStage<T>(
  scriptName: string,
  input: unknown,
  opts: RunOptions = {},
): Promise<RRunResult<T> | RRunError> {
  if (!R_ENGINE_URL) {
    return runRScript<T>(scriptName, input, opts);
  }
  const path = STAGE_TO_HTTP_PATH[scriptName];
  if (!path) {
    return { ok: false, error: `Unknown R script: ${scriptName}`, stderr: "", events: [] };
  }
  return httpCall<T>(path, scriptName === "healthcheck.R" ? "GET" : "POST", input, opts);
}

async function runScriptHttp<T>(
  script: string,
  payload: unknown,
  opts: RunOptions,
): Promise<RRunResult<T> | RRunError> {
  return httpCall<T>(
    "/run/script",
    "POST",
    { script, payload: payload ?? {}, jobId: opts.jobId },
    opts,
  );
}

async function httpCall<T>(
  path: string,
  method: "GET" | "POST",
  body: unknown,
  opts: RunOptions,
): Promise<RRunResult<T> | RRunError> {
  const events: RStreamEvent[] = [];
  const pushEvent = (e: RStreamEvent) => {
    events.push(e);
    opts.onEvent?.(e);
  };

  // Start tailing the per-job log file BEFORE the request hits the wire so
  // we don't miss early progress lines.
  let tail: { stop: () => void } | null = null;
  if (opts.jobId !== undefined) {
    const logPath = join(JOBS_LOG_DIR, `${opts.jobId}.ndjson`);
    tail = tailJobLog(logPath, pushEvent);
  }

  pushEvent({
    type: "log",
    level: "info",
    message: `→ r-engine ${method} ${path}`,
    ts: new Date().toISOString(),
  });

  const url = `${R_ENGINE_URL!.replace(/\/+$/, "")}${path}`;
  const timeoutMs = opts.timeoutMs ?? 1000 * 60 * 60;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method,
      headers: { "content-type": "application/json" },
      body: method === "GET" ? undefined : JSON.stringify(body ?? {}),
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
      return { ok: false, error: `r-engine HTTP ${res.status}`, stderr: text, events };
    }

    const parsed = (await res.json()) as
      | { ok: true; result: T }
      | { ok: false; error: string; traceback?: string }
      | T; // healthz returns the raw status object

    if (path === "/healthz") {
      return { ok: true, result: parsed as T, events };
    }

    if (typeof parsed === "object" && parsed !== null && "ok" in parsed) {
      const obj = parsed as { ok: boolean };
      if (obj.ok) {
        pushEvent({
          type: "progress",
          progress: 1,
          message: "Concluído",
          ts: new Date().toISOString(),
        });
        return { ok: true, result: (parsed as { result: T }).result, events };
      }
      const err = parsed as { error: string; traceback?: string };
      pushEvent({
        type: "log",
        level: "error",
        message: err.error,
        ts: new Date().toISOString(),
      });
      return { ok: false, error: err.error, stderr: err.traceback ?? "", events };
    }

    return { ok: true, result: parsed as T, events };
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
  } finally {
    // Drain a final tick before stopping so any buffered tail lines arrive.
    await new Promise((r) => setTimeout(r, 250));
    tail?.stop();
  }
}

/**
 * Dev-only: write the generated script to a tmp `.R` file and execute via
 * `bash scripts/r-env.sh Rscript <tmp.R>` — the same wrapper used by
 * runRScript. Reuses runRScript's stdout/stderr parser by writing the script
 * into the r-scripts directory under a unique temp name.
 */
async function runScriptLocally<T>(
  script: string,
  payload: unknown,
  opts: RunOptions,
): Promise<RRunResult<T> | RRunError> {
  const path = await import("node:path");
  const os = await import("node:os");
  const fsAsync = await import("node:fs/promises");
  const tmpName = `_generated_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.R`;
  const rScriptsDir = path.resolve(process.cwd(), "r-scripts");
  const tmpPath = path.join(rScriptsDir, tmpName);
  try {
    await fsAsync.writeFile(tmpPath, script, "utf-8");
    return await runRScript<T>(tmpName, payload, opts);
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      stderr: "",
      events: [],
    };
  } finally {
    await fsAsync.unlink(tmpPath).catch(() => {
      /* ignore */
    });
    // Discard the unused `os` import (kept to avoid TS unused warnings if
    // refactored later to use os.tmpdir()).
    void os;
  }
}

export function isRemoteREngine(): boolean {
  return Boolean(R_ENGINE_URL);
}
