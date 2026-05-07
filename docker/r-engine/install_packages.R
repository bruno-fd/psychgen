# ============================================================================
# PsychGen BR — R package install (run at image build time).
# Pinned CRAN snapshot for reproducibility.
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

# AIGENIE from GitHub (commit-pinned for reproducibility). Comment out if the
# repository becomes unavailable — the R-native pipeline does not require it.
if (!requireNamespace("AIGENIE", quietly = TRUE)) {
  cat(">>> Installing AIGENIE from GitHub\n")
  if (!requireNamespace("remotes", quietly = TRUE)) install.packages("remotes")
  tryCatch(
    remotes::install_github("hfgolino/AIGENIE",
                            ref = "HEAD",
                            upgrade = "never"),
    error = function(e) {
      cat("WARN: AIGENIE install failed (non-fatal): ", conditionMessage(e), "\n")
    }
  )
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
