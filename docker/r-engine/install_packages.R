# ============================================================================
# PsychGen BR — R package install (run at image build time).
# Pinned CRAN snapshot for reproducibility (Posit PPM 2025-04-15).
# ============================================================================
options(
  repos = c(CRAN = "https://packagemanager.posit.co/cran/__linux__/jammy/2025-04-15"),
  Ncpus = max(1L, parallel::detectCores() - 1L),
  install.packages.check.source = "no"
)

cat(">>> R version: ", R.version.string, "\n")
cat(">>> Library path: ", .libPaths()[1], "\n")

cran_pkgs <- c(
  # I/O + HTTP
  "jsonlite", "httr2", "curl",
  # API server
  "plumber",
  # Math / ML
  "Matrix", "glmnet", "randomForest",
  # Psychometrics
  "psych", "lavaan", "mirt",
  # Networks / EGA
  "igraph", "qgraph", "EGAnet",
  # NLP (PT-BR)
  "udpipe", "quanteda",
  # Excel export
  "openxlsx",
  # Plotting (semPlot wants these transitively)
  "ggplot2"
)

for (p in cran_pkgs) {
  if (requireNamespace(p, quietly = TRUE)) {
    cat("  [skip] ", p, " already installed\n", sep = "")
    next
  }
  cat(">>> Installing ", p, "\n", sep = "")
  install.packages(p, dependencies = TRUE)
  if (!requireNamespace(p, quietly = TRUE))
    stop(sprintf("Failed to install %s", p))
}

# AIGENIE is OPT-IN and must be pinned to an immutable git ref (commit SHA or
# tag) for reproducibility. To enable, set INSTALL_AIGENIE_REF in the
# docker-compose `.env` to a specific commit SHA — never use "HEAD" or branch
# names in production builds. When unset, AIGENIE is skipped and the
# R-native fallback in stage1_aigenie.R is used.
aigenie_ref <- Sys.getenv("INSTALL_AIGENIE_REF", unset = "")
if (nzchar(aigenie_ref)) {
  if (aigenie_ref %in% c("HEAD", "main", "master")) {
    stop(sprintf(
      "INSTALL_AIGENIE_REF must be an immutable ref (commit SHA or tag), got: %s",
      aigenie_ref
    ))
  }
  cat(">>> Installing AIGENIE from GitHub @", aigenie_ref, "\n", sep = "")
  if (!requireNamespace("remotes", quietly = TRUE)) install.packages("remotes")
  remotes::install_github("hfgolino/AIGENIE",
                          ref = aigenie_ref,
                          upgrade = "never")
  if (!requireNamespace("AIGENIE", quietly = TRUE)) {
    stop("AIGENIE install failed")
  }
} else {
  cat(">>> AIGENIE skipped (INSTALL_AIGENIE_REF not set). ",
      "stage1_aigenie.R will use the igraph::cluster_louvain fallback.\n",
      sep = "")
}

# Pre-download the udpipe Portuguese-Bosque model into the cache volume.
udpipe_dir <- file.path(Sys.getenv("HOME"), ".cache", "udpipe")
dir.create(udpipe_dir, recursive = TRUE, showWarnings = FALSE)
existing <- list.files(udpipe_dir, pattern = "portuguese.*\\.udpipe$", full.names = TRUE)
if (length(existing) == 0L) {
  cat(">>> Downloading udpipe Portuguese-Bosque model\n")
  tryCatch(
    udpipe::udpipe_download_model(language = "portuguese-bosque",
                                  model_dir = udpipe_dir),
    error = function(e) {
      cat("WARN: udpipe model download failed (will retry on first use): ",
          conditionMessage(e), "\n")
    }
  )
}

cat(">>> R package install complete.\n")
