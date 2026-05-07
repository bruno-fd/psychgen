# ============================================================================
# PsychGen BR — Plumber API exposing the R engine over HTTP.
#
# Two execution modes:
#   1) Named-stage endpoints (POST /run/{aigenie,difficulty,irt,sample-design,
#      export-xlsx})  — kept for backwards-compat / manual debugging.
#   2) Generic script runner (POST /run/script)  — the primary path used by
#      the API server. Receives the *generated* R source as plain text plus
#      the runtime payload, so the script that ran is byte-for-byte the one
#      the user previewed and can download.
#
# Live progress: when `jobId` is provided in the payload, stdout and stderr
# are sink()-redirected to a per-job NDJSON file under JOBS_LOG_DIR
# (/srv/jobs-logs by default — shared volume with the api container, which
# tails the file and forwards lines as SSE).
# ============================================================================
suppressPackageStartupMessages({
  library(plumber)
  library(jsonlite)
})

R_SCRIPTS_DIR <- Sys.getenv("R_SCRIPTS_DIR", unset = "/srv/r-scripts")
JOBS_LOG_DIR  <- Sys.getenv("JOBS_LOG_DIR",  unset = "/srv/jobs-logs")
dir.create(JOBS_LOG_DIR, recursive = TRUE, showWarnings = FALSE)

`%||%` <- function(a, b) if (is.null(a)) b else a

# Capture stdout to a per-job file when jobId is present, so the api-server
# can tail it for live SSE. Returns a list of teardown closures.
.start_job_sink <- function(job_id) {
  if (is.null(job_id) || !nzchar(as.character(job_id))) return(list())
  log_path <- file.path(JOBS_LOG_DIR, paste0(job_id, ".ndjson"))
  con <- file(log_path, open = "wt")
  sink(con, append = TRUE, split = FALSE, type = "output")
  sink(con, append = TRUE, split = FALSE, type = "message")
  list(
    teardown = function() {
      try(sink(type = "message"), silent = TRUE)
      try(sink(type = "output"),  silent = TRUE)
      try(close(con),             silent = TRUE)
      # Note: we leave the file in place so a slow tail can still drain it.
      # A janitor (api-side) can prune old files.
    },
    log_path = log_path
  )
}

# Execute an arbitrary R script string with the given JSON payload, honoring
# the same R_INPUT_JSON / R_OUTPUT_JSON contract as the legacy stage scripts.
run_script_text <- function(script_text, payload, job_id = NULL) {
  inp <- tempfile(fileext = ".json")
  out <- tempfile(fileext = ".json")
  scr <- tempfile(fileext = ".R")
  writeLines(jsonlite::toJSON(payload, auto_unbox = TRUE, null = "null"), inp)
  writeLines(script_text, scr)

  old_in  <- Sys.getenv("R_INPUT_JSON")
  old_out <- Sys.getenv("R_OUTPUT_JSON")
  old_wd  <- getwd()
  Sys.setenv(R_INPUT_JSON = inp, R_OUTPUT_JSON = out)
  setwd(dirname(R_SCRIPTS_DIR))

  sink_state <- .start_job_sink(job_id)

  on.exit({
    if (length(sink_state) > 0) sink_state$teardown()
    Sys.setenv(R_INPUT_JSON = old_in, R_OUTPUT_JSON = old_out)
    setwd(old_wd)
    if (file.exists(inp)) file.remove(inp)
    if (file.exists(scr)) file.remove(scr)
    if (file.exists(out)) file.remove(out)
  })

  err_msg <- NULL
  err_tb  <- NULL
  tryCatch(
    sys.source(scr, envir = new.env(parent = globalenv())),
    error = function(e) {
      err_msg <<- conditionMessage(e)
      err_tb  <<- paste(capture.output(traceback()), collapse = "\n")
    }
  )

  if (!is.null(err_msg)) {
    return(list(ok = FALSE, error = err_msg, traceback = err_tb))
  }
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

# Backwards-compat: source a stage script by filename (no script text).
run_stage <- function(script, body, job_id = NULL) {
  script_path <- file.path(R_SCRIPTS_DIR, script)
  if (!file.exists(script_path))
    return(list(ok = FALSE, error = sprintf("Script not found: %s", script_path)))
  src <- paste(readLines(script_path, warn = FALSE), collapse = "\n")
  run_script_text(src, body, job_id)
}

#* @apiTitle PsychGen R Engine

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
    aigenieAvailable    = suppressWarnings(requireNamespace("AIGENIE", quietly = TRUE)),
    openaiConfigured    = nzchar(Sys.getenv("OPENAI_API_KEY")) ||
                          nzchar(Sys.getenv("AI_INTEGRATIONS_OPENAI_API_KEY")),
    anthropicConfigured = nzchar(Sys.getenv("ANTHROPIC_API_KEY")) ||
                          nzchar(Sys.getenv("AI_INTEGRATIONS_ANTHROPIC_API_KEY")),
    udpipeModelCached   = length(list.files(file.path(Sys.getenv("HOME"), ".cache/udpipe"),
                                            pattern = "portuguese.*\\.udpipe$")) > 0
  )
}

#* Generic script runner — primary path. Body: { script, payload, jobId? }
#* @serializer unboxedJSON
#* @post /run/script
function(req) {
  b <- req$body
  if (is.null(b$script) || !nzchar(b$script))
    return(list(ok = FALSE, error = "Missing 'script' in request body"))
  run_script_text(b$script, b$payload %||% list(), b$jobId)
}

#* @serializer unboxedJSON
#* @post /run/aigenie
function(req) { run_stage("stage1_aigenie.R", req$body, req$body$jobId) }

#* @serializer unboxedJSON
#* @post /run/difficulty
function(req) { run_stage("stage2_difficulty.R", req$body, req$body$jobId) }

#* @serializer unboxedJSON
#* @post /run/irt
function(req) { run_stage("stage3_irt.R", req$body, req$body$jobId) }

#* @serializer unboxedJSON
#* @post /run/sample-design
function(req) { run_stage("stage5_sample_design.R", req$body, req$body$jobId) }

#* @serializer unboxedJSON
#* @post /run/export-xlsx
function(req) { run_stage("export_xlsx.R", req$body, req$body$jobId) }
