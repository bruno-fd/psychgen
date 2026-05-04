# ============================================================================
# Stage 2 — Difficulty prediction in PURE R
#
# Receives raw item texts (PT-BR) + observed difficulty for the calibrated
# subset. Computes:
#   - Linguistic features via udpipe (Portuguese-Bosque) and quanteda
#     (token counts, sentence stats, lexical diversity, POS profiles).
#   - Optional dense semantic features via OpenAI embeddings.
#   - glmnet / randomForest / ensemble model with k-fold CV.
#   - Predicts difficulty for uncalibrated items + reports CV R² and
#     feature importance.
# ============================================================================
source(file.path(getwd(), "r-scripts", "_common.R"))

run_with_error_capture(function() {
  inp <- read_input()
  items <- inp$items     # list of list(id=, text=, difficultyEstimated=)
  p <- inp$params

  if (length(items) == 0L) stop("No items received.")

  ids   <- vapply(items, function(it) as.integer(it$id), integer(1))
  texts <- vapply(items, function(it) it$text, character(1))
  y_obs <- vapply(items, function(it) {
    if (is.null(it$difficultyEstimated)) NA_real_ else as.numeric(it$difficultyEstimated)
  }, numeric(1))

  train_idx   <- which(!is.na(y_obs))
  predict_idx <- which(is.na(y_obs))
  if (length(train_idx) < 5L)
    stop(sprintf("Predição requer >=5 itens calibrados; recebidos %d.", length(train_idx)))
  if (length(predict_idx) == 0L)
    stop("Todos os itens já calibrados — nada a predizer.")

  # ---- Linguistic features (udpipe + quanteda) ---------------------------
  feat_mat <- NULL
  feat_names <- character()

  if (isTRUE(p$useTextFeatures)) {
    progress(0.1, "Carregando modelo udpipe Portuguese-Bosque")
    if (!requireNamespace("udpipe", quietly = TRUE)) stop("udpipe não instalado")
    if (!requireNamespace("quanteda", quietly = TRUE)) stop("quanteda não instalado")

    udpipe_dir <- file.path(Sys.getenv("HOME"), ".cache", "udpipe")
    candidates <- list.files(udpipe_dir, pattern = "portuguese.*\\.udpipe$", full.names = TRUE)
    if (length(candidates) == 0L) {
      log_info("Baixando modelo udpipe Portuguese-Bosque (uma vez)")
      dir.create(udpipe_dir, showWarnings = FALSE, recursive = TRUE)
      udpipe::udpipe_download_model(language = "portuguese-bosque", model_dir = udpipe_dir)
      candidates <- list.files(udpipe_dir, pattern = "portuguese.*\\.udpipe$", full.names = TRUE)
    }
    model_path <- candidates[1]
    ud_model <- udpipe::udpipe_load_model(file = model_path)

    progress(0.25, sprintf("Tokenizando %d itens via udpipe", length(texts)))
    annot <- udpipe::udpipe_annotate(ud_model, x = texts, doc_id = paste0("item_", seq_along(texts)))
    df <- as.data.frame(annot)

    # quanteda summary
    corp <- quanteda::corpus(texts, docnames = paste0("item_", seq_along(texts)))
    tok  <- quanteda::tokens(corp, what = "word", remove_punct = TRUE)
    types_per_doc <- vapply(tok, function(t) length(unique(t)), integer(1))
    tokens_per_doc <- quanteda::ntoken(corp, remove_punct = TRUE)
    sentences_per_doc <- quanteda::nsentence(corp)

    pos_share <- function(doc_id, tag) {
      sub <- df[df$doc_id == doc_id, , drop = FALSE]
      if (nrow(sub) == 0) return(0)
      mean(sub$upos == tag, na.rm = TRUE)
    }

    rows <- lapply(seq_along(texts), function(i) {
      doc_id <- paste0("item_", i)
      sub <- df[df$doc_id == doc_id, , drop = FALSE]
      n_tok <- max(1L, tokens_per_doc[[i]])
      mean_tok_len <- if (nrow(sub) > 0) mean(nchar(sub$token), na.rm = TRUE) else 0
      ttr <- if (n_tok > 0) types_per_doc[[i]] / n_tok else 0
      c(
        chars              = nchar(texts[i]),
        tokens             = n_tok,
        sentences          = max(1L, sentences_per_doc[[i]]),
        types              = types_per_doc[[i]],
        ttr                = ttr,
        mean_token_length  = mean_tok_len,
        words_per_sentence = n_tok / max(1L, sentences_per_doc[[i]]),
        share_NOUN         = pos_share(doc_id, "NOUN"),
        share_VERB         = pos_share(doc_id, "VERB"),
        share_ADJ          = pos_share(doc_id, "ADJ"),
        share_ADV          = pos_share(doc_id, "ADV"),
        share_PRON         = pos_share(doc_id, "PRON"),
        share_DET          = pos_share(doc_id, "DET"),
        share_ADP          = pos_share(doc_id, "ADP"),
        share_CCONJ        = pos_share(doc_id, "CCONJ"),
        share_SCONJ        = pos_share(doc_id, "SCONJ")
      )
    })
    text_feats <- do.call(rbind, rows)
    feat_mat <- text_feats
    feat_names <- colnames(text_feats)
  }

  if (isTRUE(p$useEmbeddingFeatures)) {
    progress(0.5, sprintf("Computando embeddings (%s)", p$embeddingModel))
    embs <- embeddings(model = p$embeddingModel, inputs = texts)
    colnames(embs) <- paste0("emb_", seq_len(ncol(embs)))
    feat_mat <- if (is.null(feat_mat)) embs else cbind(feat_mat, embs)
    feat_names <- c(feat_names, colnames(embs))
  }

  if (is.null(feat_mat) || ncol(feat_mat) == 0L)
    stop("Nenhuma feature ativada (textFeatures e embeddingFeatures ambos desligados).")

  # ---- Train ------------------------------------------------------------
  X_train <- feat_mat[train_idx, , drop = FALSE]
  y_train <- y_obs[train_idx]
  X_pred  <- feat_mat[predict_idx, , drop = FALSE]

  cv_r2 <- function(predicted, observed) {
    ss_res <- sum((observed - predicted)^2)
    ss_tot <- sum((observed - mean(observed))^2)
    if (ss_tot == 0) return(NA_real_)
    1 - ss_res / ss_tot
  }

  train_glmnet <- function() {
    if (!requireNamespace("glmnet", quietly = TRUE)) stop("glmnet not installed")
    cv <- glmnet::cv.glmnet(as.matrix(X_train), y_train,
                            nfolds = min(p$crossValidationFolds, length(y_train)),
                            alpha = 0.5)
    pred    <- as.numeric(predict(cv, newx = as.matrix(X_pred), s = "lambda.min"))
    cv_pred <- as.numeric(predict(cv, newx = as.matrix(X_train), s = "lambda.min"))
    coefs <- as.numeric(coef(cv, s = "lambda.min"))[-1]
    importance <- data.frame(
      feature    = feat_names,
      importance = abs(coefs),
      stringsAsFactors = FALSE
    )
    list(pred = pred, r2 = cv_r2(cv_pred, y_train), importance = importance)
  }
  train_rf <- function() {
    if (!requireNamespace("randomForest", quietly = TRUE)) stop("randomForest not installed")
    rf <- randomForest::randomForest(x = X_train, y = y_train, ntree = 500, importance = TRUE)
    pred <- as.numeric(predict(rf, newdata = X_pred))
    importance <- data.frame(
      feature    = rownames(rf$importance),
      importance = as.numeric(rf$importance[, "IncNodePurity"]),
      stringsAsFactors = FALSE
    )
    list(pred = pred, r2 = cv_r2(rf$predicted, y_train), importance = importance)
  }

  progress(0.75, sprintf("Treinando modelo: %s", p$algorithm))
  result <- switch(p$algorithm,
    glmnet       = train_glmnet(),
    randomForest = train_rf(),
    ensemble = {
      a <- train_glmnet(); b <- train_rf()
      imp <- merge(a$importance, b$importance, by = "feature", all = TRUE,
                   suffixes = c(".glmnet", ".rf"))
      imp[is.na(imp)] <- 0
      imp$importance <- (imp$importance.glmnet / max(imp$importance.glmnet) +
                          imp$importance.rf     / max(imp$importance.rf)) / 2
      list(
        pred = (a$pred + b$pred) / 2,
        r2   = mean(c(a$r2, b$r2), na.rm = TRUE),
        importance = imp[, c("feature", "importance")]
      )
    },
    stop(sprintf("Algoritmo desconhecido: %s", p$algorithm))
  )

  imp <- result$importance
  imp <- imp[order(-imp$importance), ]
  top_imp <- head(imp, 25)

  predictions <- lapply(seq_along(predict_idx), function(k) list(
    itemId    = ids[predict_idx[k]],
    predicted = as.numeric(result$pred[k])
  ))

  progress(1, sprintf("Concluído: %d itens preditos", length(predictions)))
  list(
    predictions       = predictions,
    cvR2              = if (is.na(result$r2)) NULL else result$r2,
    algorithm         = p$algorithm,
    trainSize         = length(train_idx),
    nFeatures         = ncol(feat_mat),
    topFeatures       = top_imp
  )
})
