# ============================================================================
# PsychGen BR — Plumber API exposing every R stage as an HTTP endpoint.
#
# Stage scripts live in /srv/r-scripts (mounted read-only from the host) and
# are sourced lazily on each request. Each handler:
#   1. Writes the request body to a temp JSON (matching the contract used by
#      the legacy Rscript runner via R_INPUT_JSON).
#   2. Sets R_OUTPUT_JSON to a temp path.
#   3. Calls source(stageN.R) inside a fresh environment.
#   4. Returns the parsed output JSON to the caller.
#
# Endpoints (all POST except /healthz):
#   POST /run/aigenie         body { construct, params }
#   POST /run/difficulty      body { items, params }
#   POST /run/irt             body { construct, items, params }
#   POST /run/sample-design   body { strata, targetSampleN, ..., calibratedItems }
#   POST /run/export-xlsx     body { project, items, reports, outputPath }
#   GET  /healthz
# ============================================================================
suppressPackageStartupMessages({
  library(plumber)
  library(jsonlite)
})

R_SCRIPTS_DIR <- Sys.getenv("R_SCRIPTS_DIR", unset = "/srv/r-scripts")

run_stage <- function(script, body) {
  inp <- tempfile(fileext = ".json")
  out <- tempfile(fileext = ".json")
  on.exit({
    if (file.exists(inp)) file.remove(inp)
    if (file.exists(out)) file.remove(out)
  })
  writeLines(jsonlite::toJSON(body, auto_unbox = TRUE, null = "null"), inp)

  old_in  <- Sys.getenv("R_INPUT_JSON")
  old_out <- Sys.getenv("R_OUTPUT_JSON")
  old_wd  <- getwd()
  Sys.setenv(R_INPUT_JSON = inp, R_OUTPUT_JSON = out)
  setwd(dirname(R_SCRIPTS_DIR))
  on.exit({
    Sys.setenv(R_INPUT_JSON = old_in, R_OUTPUT_JSON = old_out)
    setwd(old_wd)
  }, add = TRUE)

  script_path <- file.path(R_SCRIPTS_DIR, script)
  if (!file.exists(script_path)) stop(sprintf("Script not found: %s", script_path))

  tryCatch(
    sys.source(script_path, envir = new.env(parent = globalenv())),
    error = function(e) {
      msg <- conditionMessage(e)
      writeLines(jsonlite::toJSON(list(error = msg), auto_unbox = TRUE), out)
    }
  )

  if (!file.exists(out)) {
    return(list(ok = FALSE, error = "R script did not produce an output file."))
  }
  raw <- readLines(out, warn = FALSE)
  parsed <- jsonlite::fromJSON(paste(raw, collapse = "\n"), simplifyVector = FALSE)
  if (!is.null(parsed$error)) {
    return(list(ok = FALSE, error = parsed$error,
                traceback = parsed$traceback %||% NULL))
  }
  list(ok = TRUE, result = parsed)
}

`%||%` <- function(a, b) if (is.null(a)) b else a

#* @apiTitle PsychGen R Engine
#* @apiDescription Plumber API wrapping the AIGENIE / difficulty / IRT / sample-design R stages.

#* Health check — reports R version, key package availability, and AI key status
#* @serializer unboxedJSON
#* @get /healthz
function() {
  pkgs <- c("jsonlite","httr2","plumber","glmnet","randomForest",
            "EGAnet","mirt","udpipe","quanteda","openxlsx","psych","lavaan")
  status <- lapply(pkgs, function(p) {
    ok <- suppressWarnings(suppressMessages(requireNamespace(p, quietly = TRUE)))
    list(name = p, available = ok,
         version = if (ok) as.character(packageVersion(p)) else NA_character_)
  })
  list(
    ok                  = TRUE,
    rVersion            = as.character(getRVersion()),
    packages            = status,
    openaiConfigured    = nzchar(Sys.getenv("OPENAI_API_KEY")) ||
                          nzchar(Sys.getenv("AI_INTEGRATIONS_OPENAI_API_KEY")),
    anthropicConfigured = nzchar(Sys.getenv("ANTHROPIC_API_KEY")) ||
                          nzchar(Sys.getenv("AI_INTEGRATIONS_ANTHROPIC_API_KEY")),
    udpipeModelCached   = length(list.files(file.path(Sys.getenv("HOME"), ".cache/udpipe"),
                                            pattern = "portuguese.*\\.udpipe$")) > 0
  )
}

#* @serializer unboxedJSON
#* @post /run/aigenie
function(req) {
  run_stage("stage1_aigenie.R", req$body)
}

#* @serializer unboxedJSON
#* @post /run/difficulty
function(req) {
  run_stage("stage2_difficulty.R", req$body)
}

#* @serializer unboxedJSON
#* @post /run/irt
function(req) {
  run_stage("stage3_irt.R", req$body)
}

#* @serializer unboxedJSON
#* @post /run/sample-design
function(req) {
  run_stage("stage5_sample_design.R", req$body)
}

#* @serializer unboxedJSON
#* @post /run/export-xlsx
function(req) {
  run_stage("export_xlsx.R", req$body)
}
