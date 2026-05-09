# --- Build stage ------------------------------------------------------------
FROM node:24-slim AS builder

ARG VITE_API_URL=/api
ENV VITE_API_URL=$VITE_API_URL
# Required by vite.config.ts at build time. Container runtime does not use them.
ENV PORT=5173
ENV BASE_PATH=/
ENV NODE_ENV=production

RUN corepack enable && corepack prepare pnpm@10.26.1 --activate

WORKDIR /app

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

RUN pnpm install --frozen-lockfile

COPY artifacts/psychgen-br ./artifacts/psychgen-br

RUN pnpm --filter @workspace/psychgen-br run build

# --- Runtime: nginx ---------------------------------------------------------
FROM nginx:1.27-alpine AS runtime

COPY artifacts/psychgen-br/nginx.conf /etc/nginx/conf.d/default.conf
# vite.config.ts writes to dist/public — copy that, not dist.
COPY --from=builder /app/artifacts/psychgen-br/dist/public /usr/share/nginx/html

EXPOSE 80
