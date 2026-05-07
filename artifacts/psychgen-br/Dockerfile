# --- Build stage ------------------------------------------------------------
FROM node:24-alpine AS builder

ARG VITE_API_URL=/api
ENV VITE_API_URL=$VITE_API_URL

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json tsconfig.json ./
COPY .npmrc ./
COPY lib ./lib
COPY artifacts/psychgen-br/package.json ./artifacts/psychgen-br/package.json

RUN pnpm install --frozen-lockfile

COPY artifacts/psychgen-br ./artifacts/psychgen-br

RUN pnpm --filter @workspace/psychgen-br run build

# --- Runtime: nginx ---------------------------------------------------------
FROM nginx:1.27-alpine AS runtime

COPY artifacts/psychgen-br/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/artifacts/psychgen-br/dist /usr/share/nginx/html

EXPOSE 80
