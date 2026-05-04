# ============================================================================
# Stage 1 — AIGENIE-style item generation (PURE R)
#
# Pipeline:
#   1. Build PT-BR prompt.
#   2. Iteratively call the chosen LLM (via httr2) for batches of items.
#   3. Embed every candidate via OpenAI embeddings (in R).
#   4. Drop near-duplicates against accepted pool (cosine > 0.95).
#   5. Once ≥ targetN candidates accumulated, run EGAnet::EGA on the
#      embedding-cosine adjacency thresholded by `egaThreshold` to assign
#      community membership and report dimensionality.
#
# Optionally delegates to AIGENIE::AIGENIE() if the package is installed and
# `params$useAigeniePackage = TRUE` — but the default path is the R-native
# implementation so we don't depend on the reticulate/uv bridge at runtime.
# ============================================================================
source(file.path(getwd(), "r-scripts", "_common.R"))

run_with_error_capture(function() {
  inp <- read_input()
  p <- inp$params
  construct <- inp$construct

  default_role <- "Você é um especialista em psicometria, com experiência na construção de instrumentos psicológicos para o mercado editorial brasileiro (Hogrefe, Vetor, Casa do Psicólogo). Você redige itens em português brasileiro, claros, sem ambiguidade, com vocabulário acessível e psicometricamente bem formulados."
  role <- if (is.null(p$systemRole) || nchar(trimws(p$systemRole)) == 0) default_role else p$systemRole

  attrs <- if (length(p$itemAttributes) > 0)
    paste0("\n\nCada item DEVE atender aos seguintes atributos:\n- ",
           paste(unlist(p$itemAttributes), collapse = "\n- "))
  else ""
  examples <- if (length(p$itemExamples) > 0)
    paste0("\n\nExemplos de itens bem formulados (não copiar literalmente):\n- ",
           paste(unlist(p$itemExamples), collapse = "\n- "))
  else ""
  notes <- if (!is.null(p$promptNotes) && nchar(trimws(p$promptNotes)) > 0)
    paste0("\n\nObservações adicionais:\n", p$promptNotes) else ""

  system_prompt <- paste0(
    role,
    "\n\nTarefa: gerar itens para o construto \"", construct, "\".",
    attrs, examples, notes,
    "\n\nDiretrizes:\n",
    "- Idioma: português brasileiro.\n",
    "- 1ª pessoa do singular para escalas autorrelato quando apropriado.\n",
    "- Evite duplas negações.\n",
    "- 8 a 30 palavras por item.\n",
    "\nResponda APENAS com os itens, um por linha, sem numeração, sem cabeçalho."
  )

  target_n <- as.integer(p$targetN)
  max_rounds <- if (isTRUE(p$adaptive)) 8L else 1L
  batch_size <- if (isTRUE(p$allTogether)) target_n else max(5L, ceiling(target_n / 4L))

  accepted_text <- character()
  accepted_emb  <- NULL  # matrix
  rejected <- 0L
  rounds <- 0L

  while (length(accepted_text) < target_n && rounds < max_rounds) {
    rounds <- rounds + 1L
    need <- target_n - length(accepted_text)
    request_n <- min(batch_size, need * 2L)
    progress(min(0.9, length(accepted_text) / target_n),
             sprintf("Rodada %d: solicitando %d itens via %s", rounds, request_n, p$model))
    log_info(sprintf("Round %d: requesting %d items via %s", rounds, request_n, p$model))

    user_prompt <- sprintf(
      "Gere %d itens distintos e diversos para medir o construto \"%s\". Não repita ideias. Cubra diferentes facetas do construto.",
      request_n, construct
    )

    raw <- chat_complete(
      model       = p$model,
      messages    = list(
        list(role = "system", content = system_prompt),
        list(role = "user",   content = user_prompt)
      ),
      temperature = p$temperature,
      top_p       = p$topP,
      max_tokens  = min(4000L, request_n * 80L)
    )
    candidates <- parse_items(raw)
    if (length(candidates) == 0L) {
      log_warn("No items parsed from LLM response")
      next
    }
    log_info(sprintf("Parsed %d candidates", length(candidates)))

    embs <- embeddings(model = p$embeddingModel, inputs = candidates)

    for (i in seq_along(candidates)) {
      e <- matrix(embs[i, ], nrow = 1)
      if (!is.null(accepted_emb)) {
        sims <- as.numeric(cosine_sim(e, accepted_emb))
        if (max(sims, na.rm = TRUE) > 0.95) {
          rejected <- rejected + 1L
          next
        }
      }
      accepted_text <- c(accepted_text, candidates[i])
      accepted_emb  <- if (is.null(accepted_emb)) e else rbind(accepted_emb, e)
      if (length(accepted_text) >= target_n) break
    }
  }

  # ---- Final EGA ---------------------------------------------------------
  communities <- rep(NA_integer_, length(accepted_text))
  ega_summary <- list(dimensions = NA_integer_, method = "none", n_items = length(accepted_text))

  if (isTRUE(p$runOverall) && length(accepted_text) > 1L) {
    progress(0.95, "Executando análise EGA final")
    sim_mat <- as.matrix(cosine_sim(accepted_emb))
    sim_mat[!is.finite(sim_mat)] <- 0
    diag(sim_mat) <- 0

    # Apply threshold to get a sparse correlation-like network for EGA.
    thr <- p$egaThreshold
    adj <- sim_mat
    adj[adj < thr] <- 0

    ega_done <- FALSE
    if (requireNamespace("EGAnet", quietly = TRUE) && length(accepted_text) >= 4L) {
      ega <- tryCatch(
        EGAnet::EGA(data = adj, model = "glasso", plot.EGA = FALSE,
                    verbose = FALSE, corr = "auto"),
        error = function(e) {
          log_warn("EGAnet::EGA failed, falling back to igraph community: ", conditionMessage(e))
          NULL
        }
      )
      if (!is.null(ega) && !is.null(ega$wc)) {
        communities <- as.integer(ega$wc)
        ega_summary <- list(
          dimensions = as.integer(length(unique(stats::na.omit(communities)))),
          method = "EGAnet::EGA(glasso)",
          n_items = length(accepted_text)
        )
        ega_done <- TRUE
      }
    }
    if (!ega_done) {
      # Fallback: igraph louvain on thresholded similarity
      g <- igraph::graph_from_adjacency_matrix(adj, mode = "undirected",
                                               weighted = TRUE, diag = FALSE)
      comm <- igraph::cluster_louvain(g, weights = igraph::E(g)$weight)
      communities <- as.integer(igraph::membership(comm))
      ega_summary <- list(
        dimensions = as.integer(length(unique(communities))),
        method     = "igraph::cluster_louvain (EGAnet fallback)",
        n_items    = length(accepted_text)
      )
    }
  }

  progress(1, sprintf("Concluído: %d itens em %d rodadas", length(accepted_text), rounds))

  list(
    items = lapply(seq_along(accepted_text), function(i) list(
      text      = accepted_text[i],
      community = if (is.na(communities[i])) NULL else communities[i]
    )),
    rounds      = rounds,
    rejected    = rejected,
    egaSummary  = ega_summary,
    model       = p$model,
    temperature = p$temperature,
    egaThreshold = p$egaThreshold
  )
})
