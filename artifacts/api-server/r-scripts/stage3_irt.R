user_lib <- Sys.getenv("R_LIBS_USER", unset = "~/.R/library")
.libPaths(c(user_lib, .libPaths()))

suppressPackageStartupMessages({
  library(jsonlite)
  library(mirt)
})

input_path <- Sys.getenv("R_INPUT_JSON")
output_path <- Sys.getenv("R_OUTPUT_JSON")
if (input_path == "" || output_path == "") stop("R_INPUT_JSON / R_OUTPUT_JSON not set")

input <- fromJSON(input_path, simplifyVector = TRUE)
responses <- do.call(rbind, lapply(input$responses, as.numeric))
irtModel <- input$irtModel
responseFormat <- input$responseFormat

if (nrow(responses) < 10) stop("Need >=10 respondents.")
if (ncol(responses) < 2) stop("Need >=2 items.")

# Convert to scoring matrix appropriate for the model
mat <- as.data.frame(responses)
colnames(mat) <- paste0("I", seq_len(ncol(mat)))

itemtype <- switch(irtModel,
  "Rasch" = "Rasch",
  "2PL" = "2PL",
  "3PL" = "3PL",
  "graded" = "graded",
  "2PL"
)

if (irtModel != "graded" && responseFormat != "dichotomous") {
  # dichotomize: above midpoint = 1
  mid <- median(unlist(mat))
  mat <- as.data.frame(lapply(mat, function(x) as.integer(x > mid)))
  colnames(mat) <- paste0("I", seq_len(ncol(mat)))
}

fit <- tryCatch(
  mirt::mirt(mat, model = 1, itemtype = itemtype, verbose = FALSE, technical = list(NCYCLES = 500)),
  error = function(e) stop(paste("mirt failed:", conditionMessage(e)))
)

coefs <- mirt::coef(fit, IRTpars = TRUE, simplify = TRUE)$items
calibrations <- lapply(seq_len(nrow(coefs)), function(i) {
  row <- coefs[i, , drop = TRUE]
  diff <- if ("b" %in% names(row)) as.numeric(row[["b"]]) else if ("b1" %in% names(row)) as.numeric(row[["b1"]]) else NA
  disc <- if ("a" %in% names(row)) as.numeric(row[["a"]]) else NA
  guess <- if ("g" %in% names(row)) as.numeric(row[["g"]]) else NULL
  list(
    difficulty = diff,
    discrimination = disc,
    guessing = guess
  )
})

reliability <- tryCatch({
  empirical_rxx(fscores(fit, full.scores.SE = TRUE))
}, error = function(e) NA_real_)

if (is.na(reliability)) reliability <- 0
if (length(reliability) > 1) reliability <- mean(reliability, na.rm = TRUE)

modelFit <- tryCatch({
  mf <- mirt::M2(fit, type = "C2", calcNULL = FALSE)
  list(
    M2 = as.numeric(mf$M2),
    df = as.numeric(mf$df),
    p = as.numeric(mf$p),
    RMSEA = as.numeric(mf$RMSEA),
    CFI = as.numeric(mf$CFI),
    TLI = as.numeric(mf$TLI)
  )
}, error = function(e) list())

writeLines(toJSON(list(
  calibrations = calibrations,
  reliability = as.numeric(reliability),
  modelFit = modelFit
), auto_unbox = TRUE, na = "null"), output_path)
