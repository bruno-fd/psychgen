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
  - Pages: Dashboard (Painel), Projects, ProjectDetail, ProjectNew, ItemDetail, RunAigenie, RunDifficulty, RunIrt, Jobs, JobDetail, Reports, ReportDetail.
  - Status badges localized: `draft="Rascunho"`, `calibrating="Calibrando"`, `ready="Pronto"`, `archived="Arquivado"`.
- **API server** (`artifacts/api-server`, port 8080): Express 5 + Drizzle/Postgres.
  - Routes: `/api/{healthz,projects,items,pipeline,dashboard,reports}`.
  - Lib: `jobs.ts` (in-memory async pipeline runner with cancellation), `llm.ts` (OpenAI + Anthropic via Replit AI Integrations), `aigenie.ts` (Node port of AIGENIE — embeddings + cosine union-find for EGA-style communities), `difficulty.ts`, `irt.ts`, `r-runner.ts`.
  - R subprocesses: `r-scripts/stage2_difficulty.R` (glmnet + randomForest), `r-scripts/stage3_irt.R` (mirt 1PL/2PL/3PL/Rasch).
- **Database** (`lib/db`): tables `projects`, `items`, `pipeline_jobs`, `reports` with Drizzle migrations.
- **Shared types**: `lib/api-spec` (OpenAPI), `lib/api-zod` (generated Zod schemas), `lib/api-client-react` (generated react-query hooks).
- **AI integrations**: `lib/integrations-openai-ai-server` and `lib/integrations-anthropic-ai` (client-only re-exports of `openai` and `anthropic`).

### R packages installed under `~/.R/library`

`jsonlite`, `Matrix`, `randomForest`, `Rcpp`, `RcppEigen`, `lattice`, `foreach`, `codetools`, `iterators`, `shape`, `crayon`, `proxy`, `rappdirs`, `sys`. Heavy packages (`survival`, `glmnet`, `mirt`) install in background — track via `logs/r_install3.log`. The IRT/difficulty stages will fail gracefully with a clear error if the corresponding R package is missing; the rest of the system (item generation, EGA via Node, dashboards) works without them.

### Pipeline stages

1. **AIGENIE** (Node, OpenAI): generates a candidate item pool from a construct + dimensions, embeds with `text-embedding-3-small`, builds an EGA-style community map via cosine union-find, optionally trims by retained-community threshold.
2. **Difficulty** (R, glmnet + randomForest): predicts item difficulty from item features (length, embedding stats, etc.) — used for pre-pretest screening.
3. **IRT** (R, mirt + LLM ensemble): generates synthetic respondent answers via a chosen LLM ensemble, calibrates 1PL/2PL/3PL/Rasch, returns IRT params + reliability + model fit (CFI/TLI/RMSEA).

### Operational notes

- The job runner is in-memory (single-node). Process restarts orphan running jobs — acceptable for the current MVP. A durable queue (DB-backed worker) would be the next hardening step.
- LLM calls have no built-in retry/backoff; failures bubble up to the job and mark it `failed` with a message. Cost guards (high `syntheticN` × multiple ensemble models) are caller responsibility.
- All routes are open (no authn/authz). Add auth before exposing publicly.

### Seed data (already in DB)

- 3 projects (BDI-BR, Big Five Brasileiro Reduzido, Banco Pré-ENEM Matemática).
- 13 items (8 Extroversão / 5 Matemática), 6 approved.
- 2 reports (1 IRT calibration with reliability 0.842, 1 placeholder).
