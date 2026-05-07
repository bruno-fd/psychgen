# --- Build stage ------------------------------------------------------------
FROM node:24-alpine AS builder

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy lockfile + workspace manifests first for better layer caching.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json tsconfig.json ./
COPY .npmrc ./
COPY lib ./lib
COPY artifacts/api-server/package.json ./artifacts/api-server/package.json

# Install with frozen lockfile
RUN pnpm install --frozen-lockfile

# Now copy source and build
COPY artifacts/api-server ./artifacts/api-server

RUN pnpm --filter @workspace/api-server run build

# --- Runtime stage ----------------------------------------------------------
FROM node:24-alpine AS runtime

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/package.json /app/pnpm-lock.yaml /app/pnpm-workspace.yaml ./
COPY --from=builder /app/.npmrc ./
COPY --from=builder /app/lib ./lib
COPY --from=builder /app/artifacts/api-server/package.json ./artifacts/api-server/package.json
COPY --from=builder /app/artifacts/api-server/dist ./artifacts/api-server/dist
COPY --from=builder /app/artifacts/api-server/r-scripts ./artifacts/api-server/r-scripts

# Install only production deps for runtime
RUN pnpm install --frozen-lockfile --prod

EXPOSE 3001

WORKDIR /app/artifacts/api-server

CMD ["node", "dist/index.js"]
