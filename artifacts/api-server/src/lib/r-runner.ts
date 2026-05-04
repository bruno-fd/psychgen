import { spawn } from "node:child_process";
import { writeFile, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { logger } from "./logger";

const REPO_ROOT = resolve(process.cwd(), "..", "..");
const R_ENV_WRAPPER = resolve(REPO_ROOT, "scripts", "r-env.sh");
const R_SCRIPTS_DIR = resolve(process.cwd(), "r-scripts");

export interface RProgressEvent {
  type: "progress";
  progress: number;
  message: string;
  ts: string;
}

export interface RLogEvent {
  type: "log";
  level: "info" | "warn" | "error";
  message: string;
  ts: string;
}

export type RStreamEvent = RProgressEvent | RLogEvent;

export interface RRunResult<T> {
  ok: true;
  result: T;
  events: RStreamEvent[];
}

export interface RRunError {
  ok: false;
  error: string;
  stderr: string;
  events: RStreamEvent[];
}

export interface RunRScriptOptions {
  /** Called for every progress + log line emitted by the R process. */
  onEvent?: (e: RStreamEvent) => void;
  /** Hard timeout in ms. Default 60 minutes. */
  timeoutMs?: number;
  /** Extra env vars passed through to R. */
  env?: Record<string, string>;
}

/**
 * Run an R script via the `scripts/r-env.sh` wrapper (which sources R 4.4.3
 * from the nix channel and assembles R_LIBS_SITE from `replit.nix`).
 *
 * The R script reads its input from `R_INPUT_JSON` and writes its output to
 * `R_OUTPUT_JSON`. While running it can emit lines:
 *   PSYCHGEN_PROGRESS {"progress":0.42,"message":"...","ts":"..."}
 *   PSYCHGEN_LOG      {"level":"info","message":"...","ts":"..."}
 *
 * which are parsed and forwarded to `onEvent` (used for SSE log streaming).
 */
export async function runRScript<T>(
  scriptName: string,
  input: unknown,
  opts: RunRScriptOptions = {},
): Promise<RRunResult<T> | RRunError> {
  const timeoutMs = opts.timeoutMs ?? 1000 * 60 * 60;
  const dir = await mkdtemp(join(tmpdir(), "psychgen-r-"));
  const inputPath = join(dir, "input.json");
  const outputPath = join(dir, "output.json");
  const scriptPath = join(R_SCRIPTS_DIR, scriptName);
  const events: RStreamEvent[] = [];
  const pushEvent = (e: RStreamEvent) => {
    events.push(e);
    opts.onEvent?.(e);
  };

  try {
    await writeFile(inputPath, JSON.stringify(input ?? {}));

    const childResult = await new Promise<{
      stdout: string;
      stderr: string;
      exitCode: number;
    }>((resolveProm) => {
      const child = spawn("bash", [R_ENV_WRAPPER, "Rscript", scriptPath], {
        cwd: process.cwd(),
        env: {
          ...process.env,
          ...opts.env,
          R_INPUT_JSON: inputPath,
          R_OUTPUT_JSON: outputPath,
        },
      });
      let stdoutBuf = "";
      let stderrBuf = "";
      let lineBuf = "";

      const handleLine = (line: string) => {
        if (line.startsWith("PSYCHGEN_PROGRESS ")) {
          try {
            const j = JSON.parse(line.slice("PSYCHGEN_PROGRESS ".length));
            pushEvent({
              type: "progress",
              progress: j.progress,
              message: j.message ?? "",
              ts: j.ts,
            });
            return;
          } catch {
            /* fall through to stdout buffering */
          }
        }
        if (line.startsWith("PSYCHGEN_LOG ")) {
          try {
            const j = JSON.parse(line.slice("PSYCHGEN_LOG ".length));
            pushEvent({
              type: "log",
              level: j.level ?? "info",
              message: j.message ?? "",
              ts: j.ts,
            });
            return;
          } catch {
            /* fall through */
          }
        }
        // Non-tagged stdout — log at info level
        if (line.length > 0) {
          stdoutBuf += line + "\n";
          if (!line.startsWith("[") && !line.startsWith("Loading")) {
            pushEvent({
              type: "log",
              level: "info",
              message: line,
              ts: new Date().toISOString(),
            });
          }
        }
      };

      child.stdout.on("data", (chunk: Buffer) => {
        lineBuf += chunk.toString();
        let nl: number;
        while ((nl = lineBuf.indexOf("\n")) >= 0) {
          const line = lineBuf.slice(0, nl).replace(/\r$/, "");
          lineBuf = lineBuf.slice(nl + 1);
          handleLine(line);
        }
      });
      child.stderr.on("data", (chunk: Buffer) => {
        const s = chunk.toString();
        stderrBuf += s;
        // R writes warnings/messages to stderr — surface them as log lines too
        for (const ln of s.split(/\r?\n/)) {
          if (ln.trim().length === 0) continue;
          pushEvent({
            type: "log",
            level: ln.match(/error/i) ? "error" : "warn",
            message: ln,
            ts: new Date().toISOString(),
          });
        }
      });

      const killTimer = setTimeout(() => {
        logger.warn({ scriptName, timeoutMs }, "R script timeout — killing");
        child.kill("SIGKILL");
      }, timeoutMs);
      child.on("close", (code) => {
        clearTimeout(killTimer);
        if (lineBuf.length > 0) handleLine(lineBuf);
        resolveProm({ stdout: stdoutBuf, stderr: stderrBuf, exitCode: code ?? -1 });
      });
      child.on("error", (err) => {
        clearTimeout(killTimer);
        resolveProm({
          stdout: stdoutBuf,
          stderr: stderrBuf + "\n" + (err.message ?? String(err)),
          exitCode: -1,
        });
      });
    });

    if (childResult.exitCode !== 0) {
      // The R script's run_with_error_capture writes {error, traceback} to the
      // output file even on failure, so try to pick that up for a nicer error.
      let scriptErr = "";
      try {
        const raw = await readFile(outputPath, "utf-8");
        const j = JSON.parse(raw) as { error?: string; traceback?: string };
        if (j.error) scriptErr = `${j.error}\n${j.traceback ?? ""}`;
      } catch {
        /* ignore */
      }
      return {
        ok: false,
        error:
          scriptErr ||
          `Rscript exited ${childResult.exitCode}`,
        stderr: childResult.stderr,
        events,
      };
    }

    const raw = await readFile(outputPath, "utf-8");
    const parsed = JSON.parse(raw) as T;
    return { ok: true, result: parsed, events };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      stderr: "",
      events,
    };
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}
