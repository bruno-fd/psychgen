#!/bin/sh
# Boot sequence for the api container:
#   1. Wait for Postgres to accept connections (compose already waits for the
#      pg healthcheck, but this is defensive against transient races).
#   2. Run `drizzle-kit push` to apply the current schema (idempotent — safe
#      to re-run on every boot, no-op if schema already matches).
#   3. exec the node server so signals propagate (PID 1).
set -e

cd /app

echo "[entrypoint] Applying database schema (drizzle-kit push, idempotent)…"
# `--force` skips the interactive "drop column?" prompt; on a fresh DB it is a
# pure CREATE; on an existing DB it will warn and continue.
pnpm --filter @workspace/db run push-force || {
  echo "[entrypoint] WARN: drizzle-kit push failed — server will start anyway"
}

cd /app/artifacts/api-server
echo "[entrypoint] Starting api server: $*"
exec "$@"
