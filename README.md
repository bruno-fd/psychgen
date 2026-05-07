# PsychGen BR

Sistema R-first para o desenvolvimento de instrumentos psicométricos no
mercado editorial brasileiro. Pipeline completo:

1. **AIGENIE** — geração iterativa de itens via LLM + EGA (em R).
2. **Predição de dificuldade** — features linguísticas (udpipe Portuguese-Bosque)
   + embeddings + glmnet/randomForest.
3. **Calibração IRT** — respondentes sintéticos (LLMs como personas) +
   `mirt::mirt()` (Rasch / 2PL / 3PL / graded).
4. **Plano amostral** — pós-estratificação + design effect + shortlist
   informacional via `mirt`.
5. **Export** — workbook XLSX multi-aba via `openxlsx`.

A interface é toda em pt-BR, com um painel lateral que mostra **a sintaxe R
gerada em tempo real** a partir dos parâmetros do formulário (fonte da
verdade no backend, em TypeScript). O botão **Baixar .R** entrega o script
exato que será executado.

---

## Rodando localmente (Windows / macOS / Linux)

### Pré-requisitos

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) ≥ 4.30
  (no Windows precisa do WSL 2 habilitado).
- ≥ 8 GB de RAM disponíveis para o Docker (a imagem do R + EGAnet + mirt
  consome bem na primeira build).
- ≥ 5 GB de disco livre.

### Primeira execução

```bash
git clone <este-repositorio>
cd <pasta-do-repo>
cp .env.example .env
# Edite .env e coloque sua OPENAI_API_KEY (ou as variáveis AI_INTEGRATIONS_*).

docker compose up -d --build
```

A primeira build leva **15–30 minutos** porque o container `r-engine` compila
todos os pacotes do CRAN (mirt, EGAnet, udpipe, quanteda, etc.) a partir do
fonte. As builds seguintes são instantâneas (camadas em cache).

> O schema do banco é aplicado **automaticamente** no boot do container `api`
> (entrypoint roda `drizzle-kit push --force` antes do `node`). Não é
> preciso rodar nada manualmente após o `up -d`.

Acesse:

| Serviço     | URL                       |
|-------------|---------------------------|
| Web (UI)    | http://localhost:5173     |
| API REST    | http://localhost:8080/api |
| Postgres    | localhost:5432            |

> O **R engine** (Plumber em `r-engine:8000`) é proposital­mente acessível
> apenas pela rede interna do Docker — a API é o único ponto de entrada
> externo. Para inspecioná-lo diretamente, use `docker compose exec`
> conforme abaixo.

### Verificando saúde

```bash
# Health completo (DB + AI keys + versão do R + pacotes instalados):
curl 'http://localhost:8080/api/healthz?deep=1' | jq

# R engine direto (de dentro do container, já que a porta não é exposta):
docker compose exec r-engine curl -s http://localhost:8000/healthz | jq
```

### Comandos úteis

```bash
# Logs ao vivo
docker compose logs -f r-engine
docker compose logs -f api

# Reiniciar só um serviço
docker compose restart api

# Parar tudo (preserva dados — volumes nomeados)
docker compose down

# Apagar tudo INCLUSIVE banco e biblioteca R
docker compose down -v

# Entrar no container R (debug)
docker compose exec r-engine R
```

---

## Estrutura

```
.
├── docker-compose.yml             ← orquestra os 4 serviços
├── docker/r-engine/               ← Dockerfile + plumber.R + install_packages.R
├── artifacts/
│   ├── api-server/                ← Express + Drizzle + Zod
│   │   ├── Dockerfile
│   │   ├── r-scripts/             ← stage1..5 + healthcheck (montados em r-engine)
│   │   └── src/lib/r-syntax/      ← geradores de sintaxe R (fonte da verdade)
│   └── psychgen-br/               ← React + Vite + shadcn (UI pt-BR)
│       ├── Dockerfile
│       └── nginx.conf
├── lib/
│   ├── api-spec/openapi.yaml      ← contrato OpenAPI compartilhado
│   ├── api-zod/                   ← schemas Zod gerados
│   ├── api-client-react/          ← hooks React Query gerados
│   └── db/                        ← schema Drizzle + migrações
└── README.md
```

### Volumes persistidos

| Volume               | Conteúdo                          | Sobrevive a `down`? | A `down -v`? |
|----------------------|-----------------------------------|---------------------|--------------|
| `psychgen_pg_data`   | banco PostgreSQL                  | ✅                   | ❌            |
| `psychgen_r_lib`     | biblioteca R do usuário (~/.R)    | ✅                   | ❌            |
| `psychgen_r_cache`   | modelo udpipe Portuguese-Bosque   | ✅                   | ❌            |

---

## Migração para VPS

Como tudo é declarado em `docker-compose.yml`, a migração é trivial:

1. Provisione qualquer VPS Linux com Docker (Hetzner, DigitalOcean, OCI free).
2. `git clone` deste repositório no servidor.
3. `cp .env.example .env` e ajuste senhas + chaves de API.
4. (Opcional) Coloque `nginx` ou Caddy na frente para HTTPS — aponte para
   `localhost:5173`.
5. `docker compose up -d --build` (o entrypoint da `api` aplica o schema
   do banco automaticamente).

Backup do banco:

```bash
docker compose exec -T postgres pg_dump -U psychgen psychgen | gzip > backup.sql.gz
```

Restore:

```bash
gunzip < backup.sql.gz | docker compose exec -T postgres psql -U psychgen -d psychgen
```

---

## Desenvolvimento

A pasta `artifacts/api-server/r-scripts` é montada **read-only** dentro do
container `r-engine`, então qualquer edição em um `stageN.R` do host é
refletida no próximo POST sem rebuild.

Para alterar a UI ou a API durante desenvolvimento, rode-as fora do Docker
e aponte para os serviços containerizados:

```bash
# Banco rodando em container; R rodando local (subprocess fallback)
docker compose up -d postgres

# API e Web no host. Sem R_ENGINE_URL o api-server cai para Rscript local.
DATABASE_URL=postgres://psychgen:psychgen@localhost:5432/psychgen \
pnpm --filter @workspace/api-server run dev

pnpm --filter @workspace/psychgen-br run dev

# Para desenvolver contra o r-engine via HTTP, exponha a porta 8000
# temporariamente adicionando em docker-compose.override.yml:
#
#   services:
#     r-engine:
#       ports:
#         - "8000:8000"
#
# e então rode com R_ENGINE_URL=http://localhost:8000 pnpm ... dev
```
