# ============================================================================
# Stage 3 — IRT calibration via synthetic LLM respondents (PURE R)
#
# Pipeline:
#   1. Generate `syntheticN` PT-BR personas via the small LLM (httr2).
#   2. For each persona, pick an LLM from `models[]` round-robin and ask it
#      to answer all items in character on the requested scale.
#   3. Parse responses, build a respondents x items matrix.
#   4. Fit `mirt` with the requested model (Rasch / 2PL / 3PL / graded).
#   5. Extract item parameters, person abilities, model fit, and Wright Map
#      data (item difficulties + theta histogram bins).
# ============================================================================
source(file.path(getwd(), "r-scripts", "_common.R"))

# Inline helper since we don't want a stringr dep — extract integers from text.
stringr_extract_all <- function(text) {
  m <- regmatches(text, gregexpr("-?\\d+", text))[[1]]
  as.integer(m)
}

run_with_error_capture(function() {
  inp <- read_input()
  items <- inp$items   # list of list(id=, text=)
  construct <- inp$construct
  p <- inp$params

  if (length(items) < 2L) stop("IRT requer pelo menos 2 itens.")
  if (length(p$models) == 0L) stop("Pelo menos um modelo LLM é necessário.")

  ids   <- vapply(items, function(it) as.integer(it$id), integer(1))
  texts <- vapply(items, function(it) it$text, character(1))

  scale_info <- switch(p$responseFormat,
    likert7      = list(min = 1, max = 7,
                        desc = "uma escala Likert de 7 pontos: 1=Discordo totalmente, 4=Neutro, 7=Concordo totalmente"),
    dichotomous  = list(min = 0, max = 1,
                        desc = "0=Falso/Não me descreve, 1=Verdadeiro/Me descreve"),
    list(min = 1, max = 5,
         desc = "uma escala Likert de 5 pontos: 1=Discordo totalmente, 3=Neutro, 5=Concordo totalmente")
  )

  # ---- Personas ----------------------------------------------------------
  default_seed <- "Você gerará personas brasileiras realistas para um estudo psicométrico. Cada persona inclui idade, gênero, escolaridade, ocupação, traços de personalidade dominantes e histórico breve."
  seed <- if (is.null(p$personaSeed) || nchar(trimws(p$personaSeed)) == 0) default_seed else p$personaSeed

  progress(0.05, sprintf("Gerando %d personas sintéticas", p$syntheticN))
  personas <- character()
  batch <- 25L
  while (length(personas) < p$syntheticN) {
    k <- min(batch, p$syntheticN - length(personas))
    raw <- chat_complete(
      model = "gpt-4o-mini",
      messages = list(
        list(role = "system", content = seed),
        list(role = "user",
             content = sprintf(
               "Gere %d personas distintas, uma por linha, no formato compacto: \"Idade X, Gênero, Escolaridade, Ocupação, traços principais (3-4 palavras), histórico breve\". Sem numeração.",
               k))
      ),
      temperature = 1.1, max_tokens = k * 80L
    )
    new_p <- trimws(strsplit(raw, "\r?\n+")[[1]])
    new_p <- new_p[nchar(new_p) > 20]
    if (length(new_p) == 0L) {
      log_warn("Personas batch returned 0 lines; retrying")
      next
    }
    personas <- c(personas, head(new_p, k))
  }
  personas <- personas[seq_len(p$syntheticN)]
  log_info(sprintf("Generated %d personas", length(personas)))

  # ---- Item list block ---------------------------------------------------
  item_block <- paste(seq_along(texts), texts, sep = ". ", collapse = "\n")

  # ---- Collect responses -------------------------------------------------
  resp_matrix <- matrix(NA_integer_, nrow = 0, ncol = length(texts))
  for (i in seq_along(personas)) {
    persona <- personas[i]
    model <- p$models[[((i - 1L) %% length(p$models)) + 1L]]
    user_prompt <- sprintf(
      "Você responderá a um questionário sobre \"%s\" como se fosse esta pessoa:\n\nPERSONA: %s\n\nPara cada item, responda com um número em %s.\n\nITENS:\n%s\n\nResponda APENAS com os %d números, separados por vírgula, na ordem dos itens. Sem explicações.",
      construct, persona, scale_info$desc, item_block, length(texts)
    )
    raw <- tryCatch(
      chat_complete(
        model = model,
        messages = list(
          list(role = "system",
               content = "Você está em uma simulação psicométrica acadêmica. Responda em personagem como a persona descrita."),
          list(role = "user", content = user_prompt)
        ),
        temperature = p$temperature, max_tokens = length(texts) * 8L + 50L
      ),
      error = function(e) { log_warn("Persona ", i, " (", model, ") failed: ", conditionMessage(e)); "" }
    )
    nums <- as.integer(stringr_extract_all(raw))
    nums <- nums[!is.na(nums) & nums >= scale_info$min & nums <= scale_info$max]
    if (length(nums) >= length(texts)) {
      resp_matrix <- rbind(resp_matrix, nums[seq_len(length(texts))])
    } else {
      log_warn("Persona ", i, " returned ", length(nums), " usable nums; skipping")
    }
    if (i %% 25L == 0L || i == length(personas)) {
      progress(0.05 + 0.65 * (i / length(personas)),
               sprintf("%d/%d respostas coletadas (%d válidas)",
                       i, length(personas), nrow(resp_matrix)))
    }
  }

  if (nrow(resp_matrix) < 10L)
    stop(sprintf("Apenas %d respostas válidas — insuficiente para calibração.", nrow(resp_matrix)))

  # ---- mirt --------------------------------------------------------------
  if (!requireNamespace("mirt", quietly = TRUE)) stop("mirt not installed")
  progress(0.75, sprintf("Calibrando %s via mirt em %d × %d", p$irtModel,
                         nrow(resp_matrix), ncol(resp_matrix)))

  mat <- as.data.frame(resp_matrix)
  colnames(mat) <- paste0("I", seq_len(ncol(mat)))

  itemtype <- switch(p$irtModel,
    Rasch = "Rasch", `2PL` = "2PL", `3PL` = "3PL", graded = "graded", "2PL")

  if (!identical(p$irtModel, "graded") && !identical(p$responseFormat, "dichotomous")) {
    mid <- median(unlist(mat))
    mat <- as.data.frame(lapply(mat, function(x) as.integer(x > mid)))
    colnames(mat) <- paste0("I", seq_len(ncol(mat)))
  }

  fit <- mirt::mirt(mat, model = 1, itemtype = itemtype, verbose = FALSE,
                    technical = list(NCYCLES = 500))
  coefs <- mirt::coef(fit, IRTpars = TRUE, simplify = TRUE)$items

  calibrations <- lapply(seq_len(nrow(coefs)), function(i) {
    row <- coefs[i, ]
    diff <- if ("b" %in% names(row)) row[["b"]] else if ("b1" %in% names(row)) row[["b1"]] else NA_real_
    list(
      itemId         = ids[i],
      difficulty     = as.numeric(diff),
      discrimination = if ("a" %in% names(row)) as.numeric(row[["a"]]) else NA_real_,
      guessing       = if ("g" %in% names(row)) as.numeric(row[["g"]]) else NULL
    )
  })

  reliability <- tryCatch({
    r <- mirt::empirical_rxx(mirt::fscores(fit, full.scores.SE = TRUE))
    if (length(r) > 1) mean(r, na.rm = TRUE) else as.numeric(r)
  }, error = function(e) NA_real_)
  if (is.na(reliability)) reliability <- 0

  model_fit <- tryCatch({
    mf <- mirt::M2(fit, type = "C2", calcNULL = FALSE)
    list(M2 = as.numeric(mf$M2), df = as.numeric(mf$df), p = as.numeric(mf$p),
         RMSEA = as.numeric(mf$RMSEA), CFI = as.numeric(mf$CFI), TLI = as.numeric(mf$TLI))
  }, error = function(e) list())

  thetas <- tryCatch(as.numeric(mirt::fscores(fit, method = "EAP")[, 1]),
                     error = function(e) numeric())

  bins <- pretty(c(thetas, vapply(calibrations, function(c) c$difficulty, numeric(1))), n = 18)
  if (length(bins) < 3) bins <- seq(-3, 3, by = 0.5)
  hist_theta <- if (length(thetas) > 0) {
    h <- hist(thetas, breaks = bins, plot = FALSE)
    lapply(seq_along(h$counts), function(i) list(
      bin   = (h$breaks[i] + h$breaks[i + 1]) / 2,
      count = as.integer(h$counts[i])
    ))
  } else list()

  wright_map <- list(
    items = lapply(calibrations, function(c) list(
      itemId     = c$itemId,
      difficulty = c$difficulty
    )),
    thetaHistogram = hist_theta,
    binEdges       = as.numeric(bins)
  )

  progress(1, sprintf("Calibração concluída — confiabilidade %.3f", reliability))
  list(
    calibrations       = calibrations,
    reliability        = as.numeric(reliability),
    responsesGenerated = nrow(resp_matrix),
    modelFit           = model_fit,
    wrightMap          = wright_map
  )
})
