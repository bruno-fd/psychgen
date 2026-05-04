# Builds a multi-sheet XLSX workbook for the project (items + IRT + Wright Map).
source(file.path(getwd(), "r-scripts", "_common.R"))

run_with_error_capture(function() {
  inp <- read_input()
  if (!requireNamespace("openxlsx", quietly = TRUE)) stop("openxlsx not installed")
  out_path <- inp$outputPath
  project  <- inp$project
  items    <- inp$items
  reports  <- inp$reports

  wb <- openxlsx::createWorkbook()

  # ---- Sheet 1 — Project metadata ----
  openxlsx::addWorksheet(wb, "Projeto")
  meta <- data.frame(
    Campo = c("ID", "Nome", "Construto", "Idioma", "Público-alvo",
              "Editora", "Status", "Criado em", "Atualizado em"),
    Valor = c(project$id, project$name, project$construct,
              project$language, project$targetAudience,
              project$publisher %||% "—", project$status,
              project$createdAt, project$updatedAt),
    stringsAsFactors = FALSE
  )
  openxlsx::writeData(wb, "Projeto", meta)

  # ---- Sheet 2 — Items ----
  openxlsx::addWorksheet(wb, "Itens")
  if (length(items) > 0) {
    items_df <- do.call(rbind, lapply(items, function(it) {
      data.frame(
        ID                   = it$id,
        Texto                = it$text,
        Status               = it$status,
        GeradoPor            = it$generatedBy,
        Comunidade_EGA       = it$egaCommunity %||% NA_integer_,
        Dificuldade_Estimada = it$difficultyEstimated %||% NA_real_,
        Dificuldade_Predita  = it$difficultyPredicted %||% NA_real_,
        Discriminacao        = it$discrimination %||% NA_real_,
        Acerto_ao_Acaso      = it$guessing %||% NA_real_,
        NotasHumanas         = it$humanNotes %||% "",
        stringsAsFactors     = FALSE
      )
    }))
    openxlsx::writeData(wb, "Itens", items_df)
    openxlsx::freezePane(wb, "Itens", firstRow = TRUE)
  } else {
    openxlsx::writeData(wb, "Itens", data.frame(Mensagem = "Sem itens"))
  }

  # ---- Sheet 3 — Wright Map (only if IRT report exists) ----
  irt_reports <- Filter(function(r) identical(r$kind, "irt"), reports)
  if (length(irt_reports) > 0) {
    last_irt <- irt_reports[[length(irt_reports)]]
    wm <- last_irt$metricsJson$wrightMap
    if (!is.null(wm)) {
      openxlsx::addWorksheet(wb, "Wright Map - Itens")
      if (length(wm$items) > 0) {
        wm_items <- do.call(rbind, lapply(wm$items, function(x) {
          data.frame(itemId = x$itemId, difficulty = x$difficulty,
                     stringsAsFactors = FALSE)
        }))
        openxlsx::writeData(wb, "Wright Map - Itens", wm_items)
      }
      openxlsx::addWorksheet(wb, "Wright Map - Theta")
      if (length(wm$thetaHistogram) > 0) {
        wm_theta <- do.call(rbind, lapply(wm$thetaHistogram, function(x) {
          data.frame(bin = x$bin, count = x$count, stringsAsFactors = FALSE)
        }))
        openxlsx::writeData(wb, "Wright Map - Theta", wm_theta)
      }
    }
  }

  # ---- Sheet 4 — All reports summary ----
  openxlsx::addWorksheet(wb, "Relatórios")
  if (length(reports) > 0) {
    rep_df <- do.call(rbind, lapply(reports, function(r) {
      data.frame(
        ID = r$id, Tipo = r$kind, Resumo = r$summary,
        CriadoEm = r$createdAt, stringsAsFactors = FALSE
      )
    }))
    openxlsx::writeData(wb, "Relatórios", rep_df)
  }

  openxlsx::saveWorkbook(wb, out_path, overwrite = TRUE)
  list(outputPath = out_path, sheets = openxlsx::sheets(wb))
})
