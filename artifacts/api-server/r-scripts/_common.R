# ============================================================================
# PsychGen BR — Shared R helpers
#
# This file is sourced by every stage script. It sets up library paths, JSON
# I/O contracts, structured logging that streams back to the Node parent, and
# wrappers for OpenAI/Anthropic HTTP calls (so the entire pipeline runs in R
# — no Node-side LLM ports).
# ============================================================================

`%||%` <- function(a, b) if (is.null(a) || (length(a) == 1 && is.na(a)) || identical(a, "")) b else a

user_lib <- Sys.getenv("R_LIBS_USER", unset = file.path(Sys.getenv("HOME"), ".R/library-4.4"))
if (!dir.exists(user_lib)) dir.create(user_lib, showWarnings = FALSE, recursive = TRUE)
.libPaths(c(user_lib, .libPaths()))

suppressPackageStartupMessages({
  library(jsonlite)
})

# ----- I/O paths ------------------------------------------------------------
.input_path  <- Sys.getenv("R_INPUT_JSON",  unset = "")
.output_path <- Sys.getenv("R_OUTPUT_JSON", unset = "")

read_input <- function() {
  if (.input_path == "") stop("R_INPUT_JSON not set")
  jsonlite::fromJSON(.input_path, simplifyVector = FALSE)
}

write_output <- function(x) {
  if (.output_path == "") stop("R_OUTPUT_JSON not set")
  writeLines(
    jsonlite::toJSON(x, auto_unbox = TRUE, na = "null", null = "null", pretty = FALSE),
    .output_path
  )
}

# ----- progress / logging ---------------------------------------------------
# Emits structured lines to stdout that the Node runner parses and streams
# to clients via SSE. Format: PSYCHGEN_LOG <json>\n
.emit <- function(level, ...) {
  payload <- list(
    level   = level,
    message = paste0(...),
    ts      = format(Sys.time(), "%Y-%m-%dT%H:%M:%OS3Z", tz = "UTC")
  )
  cat("PSYCHGEN_LOG ", jsonlite::toJSON(payload, auto_unbox = TRUE), "\n", sep = "")
  flush.console()
}

log_info  <- function(...) .emit("info",  ...)
log_warn  <- function(...) .emit("warn",  ...)
log_error <- function(...) .emit("error", ...)

progress <- function(p, message = "") {
  payload <- list(
    progress = max(0, min(1, p)),
    message  = message,
    ts       = format(Sys.time(), "%Y-%m-%dT%H:%M:%OS3Z", tz = "UTC")
  )
  cat("PSYCHGEN_PROGRESS ", jsonlite::toJSON(payload, auto_unbox = TRUE), "\n", sep = "")
  flush.console()
}

# ----- HTTP / LLM wrappers --------------------------------------------------
# Both providers are gated on the corresponding env var. Failure is loud and
# upstream — we never silently fall back to a different provider.

.is_anthropic <- function(model) grepl("^claude", model, ignore.case = TRUE)

.require_httr2 <- function() {
  if (!requireNamespace("httr2", quietly = TRUE)) {
    stop("R package 'httr2' is required but not installed. Run scripts/r-bootstrap.R")
  }
}

.openai_url  <- function(path) paste0(Sys.getenv("OPENAI_BASE_URL",  unset = "https://api.openai.com/v1"),  path)
.anthropic_url <- function(path) paste0(Sys.getenv("ANTHROPIC_BASE_URL", unset = "https://api.anthropic.com/v1"), path)

#' Chat completion in R via httr2. Routes to Anthropic for claude-* models.
#' @param model      model id
#' @param messages   list of list(role=, content=)
#' @param temperature numeric
#' @param top_p      numeric
#' @param max_tokens integer
#' @return character scalar (the assistant message content)
chat_complete <- function(model, messages,
                          temperature = 1.0, top_p = 1.0,
                          max_tokens = 1024L) {
  .require_httr2()

  if (.is_anthropic(model)) {
    key <- Sys.getenv("ANTHROPIC_API_KEY")
    if (key == "") stop("ANTHROPIC_API_KEY not set")
    sys_msgs <- Filter(function(m) identical(m$role, "system"), messages)
    other    <- Filter(function(m) !identical(m$role, "system"), messages)
    body <- list(
      model       = model,
      max_tokens  = as.integer(max_tokens),
      temperature = temperature,
      top_p       = top_p,
      messages    = lapply(other, function(m) list(role = m$role, content = m$content))
    )
    if (length(sys_msgs) > 0) {
      body$system <- paste(vapply(sys_msgs, function(m) m$content, character(1)), collapse = "\n\n")
    }
    req <- httr2::request(.anthropic_url("/messages")) |>
      httr2::req_headers(
        "x-api-key"         = key,
        "anthropic-version" = "2023-06-01",
        "content-type"      = "application/json"
      ) |>
      httr2::req_body_json(body) |>
      httr2::req_timeout(180) |>
      httr2::req_retry(max_tries = 3, backoff = function(i) 2 ^ i)
    resp <- httr2::req_perform(req)
    j <- httr2::resp_body_json(resp)
    parts <- vapply(j$content, function(p) if (!is.null(p$text)) p$text else "", character(1))
    return(paste(parts, collapse = ""))
  }

  # OpenAI (default)
  key <- Sys.getenv("OPENAI_API_KEY")
  if (key == "") stop("OPENAI_API_KEY not set")
  body <- list(
    model       = model,
    temperature = temperature,
    top_p       = top_p,
    max_tokens  = as.integer(max_tokens),
    messages    = lapply(messages, function(m) list(role = m$role, content = m$content))
  )
  req <- httr2::request(.openai_url("/chat/completions")) |>
    httr2::req_headers(
      "Authorization" = paste("Bearer", key),
      "content-type"  = "application/json"
    ) |>
    httr2::req_body_json(body) |>
    httr2::req_timeout(180) |>
    httr2::req_retry(max_tries = 3, backoff = function(i) 2 ^ i)
  resp <- httr2::req_perform(req)
  j <- httr2::resp_body_json(resp)
  if (length(j$choices) == 0) stop("OpenAI returned no choices")
  j$choices[[1]]$message$content
}

#' Embeddings via OpenAI in R. Returns a numeric matrix [n_inputs x dim].
embeddings <- function(model, inputs) {
  .require_httr2()
  key <- Sys.getenv("OPENAI_API_KEY")
  if (key == "") stop("OPENAI_API_KEY not set")
  if (length(inputs) == 0) return(matrix(numeric(0), nrow = 0, ncol = 0))

  # Batch in chunks of 100 so we don't hit token limits per request.
  out <- vector("list", length(inputs))
  chunks <- split(seq_along(inputs), ceiling(seq_along(inputs) / 100))
  for (idx in chunks) {
    body <- list(model = model, input = as.list(inputs[idx]))
    req <- httr2::request(.openai_url("/embeddings")) |>
      httr2::req_headers(
        "Authorization" = paste("Bearer", key),
        "content-type"  = "application/json"
      ) |>
      httr2::req_body_json(body) |>
      httr2::req_timeout(180) |>
      httr2::req_retry(max_tries = 3, backoff = function(i) 2 ^ i)
    resp <- httr2::req_perform(req)
    j <- httr2::resp_body_json(resp)
    for (k in seq_along(idx)) {
      out[[idx[k]]] <- as.numeric(unlist(j$data[[k]]$embedding))
    }
  }
  do.call(rbind, out)
}

# ----- text utilities -------------------------------------------------------
parse_items <- function(text) {
  if (length(text) == 0 || is.na(text)) return(character())
  lines <- strsplit(text, "\r?\n+")[[1]]
  lines <- gsub("^[\\s\\-\\*0-9.\\)]+", "", lines, perl = TRUE)
  lines <- trimws(lines)
  lines[nchar(lines) >= 5 & nchar(lines) <= 400]
}

cosine_sim <- function(A, B = A) {
  na <- sqrt(rowSums(A * A))
  nb <- sqrt(rowSums(B * B))
  (A %*% t(B)) / (na %*% t(nb))
}

# ----- top-level error wrapper ---------------------------------------------
run_with_error_capture <- function(fn) {
  res <- tryCatch(
    list(ok = TRUE, value = fn()),
    error = function(e) {
      log_error("Stage failed: ", conditionMessage(e))
      list(ok = FALSE, error = conditionMessage(e),
           traceback = paste(capture.output(traceback()), collapse = "\n"))
    }
  )
  if (isTRUE(res$ok)) {
    write_output(res$value)
  } else {
    write_output(list(error = res$error, traceback = res$traceback))
    quit(status = 2, save = "no")
  }
}
