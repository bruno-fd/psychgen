# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Hosts multiple artifacts including the **PsychGen BR** psychometric instrument lab.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.

## PsychGen BR (artifacts/psychgen-br + artifacts/api-server)

Production-oriented system for AI-driven psychometric instrument development for the Brazilian editorial market (Hogrefe, Vetor, Casa do Psicólogo).

### Architecture

- **Frontend** (`artifacts/psychgen-br`, base path `/`): React + Vite + shadcn/ui + react-query + Recharts + wouter, fully in pt-BR.
  - Pages: Dashboard (Painel), Projects, ProjectDetail (com botão **Exportar Excel** + grade de 4 estágios), ProjectNew, ItemDetail, RunAigenie, RunDifficulty, RunIrt, **RunSampleDesign** (Estágio 5: estratos + tamanhos), Jobs, JobDetail (com `JobLogs` SSE), Reports, ReportDetail (renderiza **WrightMap** quando `kind === "irt"`).
  - Componentes: `wright-map.tsx` (visualização SVG/CSS de pessoas vs itens em escala θ), `job-logs.tsx` (logs ao vivo via EventSource SSE).
- **API server** (`artifacts/api-server`, port 8080): Express 5 + Drizzle/Postgres. Pipeline 100% em R via subprocessos.
  - Rotas: `/api/healthz` (com `?deep=1` checando R), `/api/projects`, `/api/items`, `/api/pipeline/jobs[/:id[/logs|/cancel]]`, `/api/projects/:id/runs/{aigenie,difficulty,irt,sample-design}`, `/api/projects/:id/export.xlsx`, `/api/dashboard/*`, `/api/reports`.
  - Lib: `jobs.ts` (runner async em memória + cancelamento + pub/sub para SSE), `r-runner.ts` (executa Rscript com input JSON, captura stdout/stderr/progresso).
  - Scripts R: `_common.R` (helpers chat_complete/embeddings/cosine_sim/log/progress), `healthcheck.R`, `stage1_aigenie.R` (LLM + embeddings + EGA com fallback igraph::louvain), `stage2_difficulty.R` (glmnet + randomForest), `stage3_irt.R` (mirt 1PL/2PL/3PL/Rasch + Wright Map data), `stage5_sample_design.R` (alocação por estratos com pesos), `export_xlsx.R` (workbook multi-aba: Itens, IRT, Wright Map, Estratos, Relatórios).
- **Database** (`lib/db`): `projects`, `items`, `pipeline_jobs`, `reports` (com `kind` aceitando `"sample_design"`), Drizzle migrations.
- **Shared types**: `lib/api-spec` (OpenAPI), `lib/api-zod` (Zod gerado), `lib/api-client-react` (react-query hooks gerados).

### R packages installed under `~/.R/library-4.4`

OK: `mirt 1.46.1`, `glmnet 4.1.8`, `randomForest 4.7.1.2`, `quanteda 4.4`, `udpipe 0.8.16` (+ modelo PT-BR Bosque em `~/.cache/udpipe`), `openxlsx 4.2.8.1`, `httr2 1.2.2`, `jsonlite 2.0.0`, `lavaan 0.6.19`, `psych 2.4.12`, `igraph 2.1.4`, `Matrix 1.7.2`, `lme4 1.1.36`, `XML 3.99-0.23`, `xml2 1.5.2`, `tictoc`, `reticulate`. Indisponíveis no ambiente atual: `EGAnet`, `qgraph`, `semPlot`, `AIGENIE` — bloqueados por incompatibilidade `OpenMx 2.22.x` × `R 4.4.3` (`Rf_isDataFrame` removido). `stage1_aigenie.R` degrada graciosamente para `igraph::cluster_louvain` quando `EGAnet` ausente.

### Bootstrap R

`scripts/r-bootstrap-loop.sh` instala pacotes CRAN em loop com até 3 tentativas. `scripts/r-env.sh` exporta `PATH` (xml2-config, cmake), `PKG_CONFIG_PATH` (libxml-2.0), `R_LIBS_SITE` (cache de pacotes nix), `R_LIBS_USER`. Para reexecutar, criar workflow temporário `bash scripts/r-bootstrap-loop.sh`.

### Pipeline stages (todos em R)

1. **AIGENIE** (`stage1_aigenie.R`): prompt PT-BR → `chat_complete` (Anthropic/OpenAI) iterativo → embeddings → dedup por cosseno > 0.95 → comunidades via EGAnet (ou igraph::louvain como fallback).
2. **Dificuldade** (`stage2_difficulty.R`): glmnet + randomForest sobre features de item.
3. **IRT** (`stage3_irt.R`): respondentes sintéticos via LLM → `mirt` 1PL/2PL/3PL/Rasch → params + reliability + fit + dados para Wright Map.
4. **Sample Design** (`stage5_sample_design.R`): aloca tamanho amostral por estratos (sexo/idade/região) com pesos.
5. **Export Excel** (`export_xlsx.R`): workbook multi-aba consolidando todo o projeto.

### Operational notes

- The job runner is in-memory (single-node). Process restarts orphan running jobs — acceptable for the current MVP. A durable queue (DB-backed worker) would be the next hardening step.
- LLM calls have no built-in retry/backoff; failures bubble up to the job and mark it `failed` with a message. Cost guards (high `syntheticN` × multiple ensemble models) are caller responsibility.
- All routes are open (no authn/authz). Add auth before exposing publicly.

### Seed data (already in DB)

- 3 projects (BDI-BR, Big Five Brasileiro Reduzido, Banco Pré-ENEM Matemática).
- 13 items (8 Extroversão / 5 Matemática), 6 approved.
- 2 reports (1 IRT calibration with reliability 0.842, 1 placeholder).
