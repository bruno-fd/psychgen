# ============================================================================
# Stage 5 — Sample design & weighting (PURE R)
#
# Given a target population stratified by demographic cells (region, sex,
# age, education) and the calibrated item bank, computes:
#   - Required sample size per stratum to achieve target SE for theta.
#   - Post-stratification weights normalised to sum to N.
#   - Effective sample size and design effect.
#   - Suggested item shortlist (information at theta = 0) using mirt's
#     test information function if calibrations are available.
# ============================================================================
source(file.path(getwd(), "r-scripts", "_common.R"))

run_with_error_capture(function() {
  inp <- read_input()
  strata <- inp$strata          # list of list(label=, populationShare=, sampledN=)
  target_n <- as.integer(inp$targetSampleN)
  target_se <- as.numeric(inp$targetThetaSE %||% 0.32)  # SE = 0.32 -> rel ~ 0.90
  items <- inp$calibratedItems  # optional; list of list(id=, difficulty=, discrimination=, guessing=)
  shortlist_max <- if (!is.null(inp$shortlistMaxItems)) as.integer(inp$shortlistMaxItems) else NA_integer_

  if (length(strata) == 0L) stop("Pelo menos um estrato é necessário.")
  if (target_n < 1L) stop("targetSampleN deve ser >=1.")

  shares <- vapply(strata, function(s) as.numeric(s$populationShare), numeric(1))
  if (abs(sum(shares) - 1) > 0.01)
    stop(sprintf("Soma das frações populacionais (%.3f) deve ser ~1.", sum(shares)))

  alloc <- pmax(1L, round(shares * target_n))
  diff_n <- sum(alloc) - target_n
  if (diff_n != 0L) {
    # Trim/grow the largest stratum to land exactly at target_n.
    biggest <- which.max(alloc)
    alloc[biggest] <- alloc[biggest] - diff_n
  }

  sampled <- vapply(strata, function(s) {
    if (is.null(s$sampledN)) NA_integer_ else as.integer(s$sampledN)
  }, integer(1))

  weights <- numeric(length(strata))
  for (i in seq_along(strata)) {
    n_pop  <- shares[i] * target_n
    n_samp <- if (is.na(sampled[i]) || sampled[i] == 0L) alloc[i] else sampled[i]
    weights[i] <- n_pop / n_samp
  }
  # normalise weights to sum to target_n
  weights <- weights * (target_n / sum(weights * pmax(1L, ifelse(is.na(sampled), alloc, sampled))))

  effective_n <- if (any(!is.na(sampled))) {
    s <- ifelse(is.na(sampled), alloc, sampled)
    sum(weights * s)^2 / sum(weights^2 * s)
  } else target_n

  design_effect <- target_n / effective_n

  # ---- Information / shortlist ------------------------------------------
  shortlist <- list()
  test_info <- NULL
  if (length(items) > 0L && requireNamespace("mirt", quietly = TRUE)) {
    a <- vapply(items, function(it) as.numeric(it$discrimination %||% 1), numeric(1))
    b <- vapply(items, function(it) as.numeric(it$difficulty), numeric(1))
    g <- vapply(items, function(it) as.numeric(it$guessing %||% 0), numeric(1))
    theta <- 0
    P <- g + (1 - g) / (1 + exp(-1.7 * a * (theta - b)))
    Q <- 1 - P
    info <- (1.7 ^ 2) * a^2 * Q / P * ((P - g) / (1 - g))^2
    info[!is.finite(info)] <- 0
    ord <- order(-info)
    if (!is.na(shortlist_max) && shortlist_max > 0L && shortlist_max < length(ord)) {
      ord <- ord[seq_len(shortlist_max)]
    }
    shortlist <- lapply(ord, function(k) list(
      itemId     = as.integer(items[[k]]$id),
      info       = as.numeric(info[k]),
      difficulty = as.numeric(b[k]),
      discrimination = as.numeric(a[k])
    ))
    test_info <- sum(info)
  }

  per_stratum <- lapply(seq_along(strata), function(i) list(
    label            = strata[[i]]$label,
    populationShare  = shares[i],
    allocatedN       = as.integer(alloc[i]),
    sampledN         = if (is.na(sampled[i])) NULL else as.integer(sampled[i]),
    weight           = as.numeric(weights[i])
  ))

  list(
    targetSampleN = target_n,
    targetThetaSE = target_se,
    perStratum    = per_stratum,
    effectiveN    = as.numeric(effective_n),
    designEffect  = as.numeric(design_effect),
    testInformationAtZero = test_info,
    itemShortlist = shortlist
  )
})

`%||%` <- function(a, b) if (is.null(a)) b else a
