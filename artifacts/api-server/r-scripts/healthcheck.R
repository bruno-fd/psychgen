# Reports R runtime + package versions for /healthz.
source(file.path(getwd(), "r-scripts", "_common.R"))

run_with_error_capture(function() {
  pkgs <- c(
    "jsonlite", "httr2", "Matrix", "glmnet", "randomForest",
    "EGAnet", "qgraph", "igraph", "lavaan", "psych",
    "mirt", "udpipe", "quanteda", "openxlsx"
  )
  status <- lapply(pkgs, function(p) {
    ok <- suppressWarnings(suppressMessages(requireNamespace(p, quietly = TRUE)))
    list(
      name      = p,
      available = ok,
      version   = if (ok) as.character(packageVersion(p)) else NA_character_
    )
  })
  list(
    rVersion            = as.character(getRVersion()),
    rHome               = R.home(),
    packages            = status,
    openaiConfigured    = nzchar(Sys.getenv("OPENAI_API_KEY")),
    anthropicConfigured = nzchar(Sys.getenv("ANTHROPIC_API_KEY"))
  )
})
