import { spawn } from "node:child_process";
import { writeFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { logger } from "./logger";

const R_LIBS_USER = process.env.R_LIBS_USER ?? `${process.env.HOME}/.R/library`;

export interface RRunResult<T> {
  ok: true;
  result: T;
  stderr: string;
}

export interface RRunError {
  ok: false;
  error: string;
  stderr: string;
}

/**
 * Run an R script with JSON input piped via a temp file. The R script must
 * write its result as JSON to the path in the env var `R_OUTPUT_JSON` and
 * read its input from the path in `R_INPUT_JSON`.
 */
export async function runRScript<T>(
  scriptPath: string,
  input: unknown,
  timeoutMs = 1000 * 60 * 30,
): Promise<RRunResult<T> | RRunError> {
  const dir = await mkdtemp(join(tmpdir(), "psychgen-r-"));
  const inputPath = join(dir, "input.json");
  const outputPath = join(dir, "output.json");
  try {
    await writeFile(inputPath, JSON.stringify(input ?? {}));

    const { stderr, exitCode } = await new Promise<{
      stderr: string;
      exitCode: number;
    }>((resolve) => {
      const child = spawn(
        "Rscript",
        ["--no-save", "--no-restore", scriptPath],
        {
          env: {
            ...process.env,
            R_LIBS_USER,
            R_INPUT_JSON: inputPath,
            R_OUTPUT_JSON: outputPath,
          },
        },
      );
      let stderr = "";
      child.stderr.on("data", (chunk) => {
        stderr += chunk.toString();
      });
      child.stdout.on("data", (chunk) => {
        logger.debug({ scriptPath, chunk: chunk.toString() }, "R stdout");
      });
      const killTimer = setTimeout(() => {
        child.kill("SIGKILL");
      }, timeoutMs);
      child.on("close", (code) => {
        clearTimeout(killTimer);
        resolve({ stderr, exitCode: code ?? -1 });
      });
    });

    if (exitCode !== 0) {
      return { ok: false, error: `Rscript exited ${exitCode}`, stderr };
    }

    const fs = await import("node:fs/promises");
    const raw = await fs.readFile(outputPath, "utf-8");
    const parsed = JSON.parse(raw) as T;
    return { ok: true, result: parsed, stderr };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      stderr: "",
    };
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}
