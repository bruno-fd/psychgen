# --- Build stage ------------------------------------------------------------
FROM node:24-alpine AS builder

RUN corepack enable && corepack prepare pnpm@10.26.1 --activate

WORKDIR /app

# Copy lockfile + workspace manifests first for better layer caching.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json tsconfig.json ./
COPY .npmrc ./
COPY lib ./lib
# Copy ALL workspace package.json files referenced by pnpm-lock.yaml.
# pnpm install --frozen-lockfile validates the entire workspace, so every
# package listed in pnpm-workspace.yaml must exist on disk.
COPY scripts/package.json ./scripts/package.json
COPY artifacts/api-server/package.json ./artifacts/api-server/package.json
COPY artifacts/psychgen-br/package.json ./artifacts/psychgen-br/package.json
COPY artifacts/mockup-sandbox/package.json ./artifacts/mockup-sandbox/package.json

# Install with frozen lockfile
RUN pnpm install --frozen-lockfile

# Now copy source and build
COPY artifacts/api-server ./artifacts/api-server

RUN pnpm --filter @workspace/api-server run build

# --- Runtime stage ----------------------------------------------------------
FROM node:24-alpine AS runtime

RUN corepack enable && corepack prepare pnpm@10.26.1 --activate

WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/package.json /app/pnpm-lock.yaml /app/pnpm-workspace.yaml ./
COPY --from=builder /app/.npmrc ./
COPY --from=builder /app/lib ./lib
COPY --from=builder /app/scripts/package.json ./scripts/package.json
COPY --from=builder /app/artifacts/api-server/package.json ./artifacts/api-server/package.json
COPY --from=builder /app/artifacts/psychgen-br/package.json ./artifacts/psychgen-br/package.json
COPY --from=builder /app/artifacts/mockup-sandbox/package.json ./artifacts/mockup-sandbox/package.json
COPY --from=builder /app/artifacts/api-server/dist ./artifacts/api-server/dist
COPY --from=builder /app/artifacts/api-server/r-scripts ./artifacts/api-server/r-scripts

# Full install (not --prod) so drizzle-kit (devDependency of @workspace/db) is
# available for the automatic schema push performed by entrypoint.sh on boot.
RUN pnpm install --frozen-lockfile

COPY artifacts/api-server/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

EXPOSE 8080

WORKDIR /app/artifacts/api-server

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["node", "dist/index.mjs"]
