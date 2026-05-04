# R bootstrap: installs CRAN packages not available in the Replit nix channel
# (mirt, udpipe, quanteda + helpers, httr2, tictoc) and AIGENIE from r-universe.
# Idempotent — skips packages that already load. Safe to run on every API
# server boot.

user_lib <- Sys.getenv("R_LIBS_USER", unset = "~/.R/library-4.4")
dir.create(user_lib, showWarnings = FALSE, recursive = TRUE)
.libPaths(c(user_lib, .libPaths()))

cran_repo <- "https://cloud.r-project.org"
ruv_repo <- "https://laralee.r-universe.dev"

ensure <- function(pkg, repos = cran_repo, type = "source") {
  if (suppressWarnings(suppressMessages(requireNamespace(pkg, quietly = TRUE)))) {
    cat(sprintf("[OK]      %s already available\n", pkg))
    return(invisible(TRUE))
  }
  cat(sprintf("[INSTALL] %s ...\n", pkg))
  res <- tryCatch(
    {
      install.packages(pkg, repos = repos, lib = user_lib, type = type,
                       quiet = FALSE,
                       dependencies = c("Depends", "Imports", "LinkingTo"),
                       Ncpus = max(1L, parallel::detectCores() - 1L))
      suppressWarnings(suppressMessages(requireNamespace(pkg, quietly = TRUE)))
    },
    error = function(e) {
      cat(sprintf("[FAIL]    %s: %s\n", pkg, conditionMessage(e)))
      FALSE
    }
  )
  if (isTRUE(res)) {
    cat(sprintf("[DONE]    %s installed\n", pkg))
  } else {
    cat(sprintf("[FAIL]    %s did NOT install correctly\n", pkg))
  }
  invisible(res)
}

# ---- core CRAN packages ----------------------------------------------------
# Order matters: install lightweight deps first.
ensure("tictoc")
ensure("stopwords")
ensure("SnowballC")
ensure("fastmatch")
ensure("httr2")
ensure("quanteda")
ensure("udpipe")
ensure("mirt")
ensure("openxlsx")  # used by Stage 5 / Excel export from R if needed

# ---- OpenMx (binary build from official repo, avoids R 4.4 source incompat) -
# OpenMx 2.22.x source code references Rf_isDataFrame, which was removed/renamed
# in R 4.4 — installing from the OpenMx team's binary repo sidesteps the issue.
if (!suppressWarnings(suppressMessages(requireNamespace("OpenMx", quietly = TRUE)))) {
  cat("[INSTALL] OpenMx from openmx.ssri.psu.edu ...\n")
  tryCatch(
    install.packages(
      "OpenMx",
      repos = c("https://openmx.ssri.psu.edu/packages/", cran_repo),
      lib = user_lib,
      dependencies = c("Depends", "Imports", "LinkingTo"),
      Ncpus = max(1L, parallel::detectCores() - 1L)
    ),
    error = function(e) cat(sprintf("[FAIL] OpenMx: %s\n", conditionMessage(e)))
  )
}

# ---- qgraph + EGAnet (heavy psychometric core) -----------------------------
ensure("xml2")
ensure("XML")
ensure("qgraph")
ensure("EGAnet")

# ---- AIGENIE from r-universe ----------------------------------------------
if (!suppressWarnings(suppressMessages(requireNamespace("AIGENIE", quietly = TRUE)))) {
  cat("[INSTALL] AIGENIE from r-universe ...\n")
  tryCatch(
    install.packages(
      "AIGENIE",
      repos = c(ruv_repo, cran_repo),
      lib = user_lib,
      dependencies = c("Depends", "Imports", "LinkingTo"),
      Ncpus = max(1L, parallel::detectCores() - 1L)
    ),
    error = function(e) cat(sprintf("[FAIL] AIGENIE: %s\n", conditionMessage(e)))
  )
  if (suppressWarnings(suppressMessages(requireNamespace("AIGENIE", quietly = TRUE)))) {
    cat("[DONE]    AIGENIE installed\n")
  } else {
    cat("[FAIL]    AIGENIE NOT installed\n")
  }
} else {
  cat("[OK]      AIGENIE already available\n")
}

# ---- udpipe Portuguese model -----------------------------------------------
udpipe_dir <- file.path(Sys.getenv("HOME"), ".cache", "udpipe")
dir.create(udpipe_dir, showWarnings = FALSE, recursive = TRUE)
pt_model <- file.path(udpipe_dir, "portuguese-bosque-ud-2.5-191206.udpipe")
if (!file.exists(pt_model)) {
  if (requireNamespace("udpipe", quietly = TRUE)) {
    cat("[DOWNLOAD] udpipe Portuguese-Bosque model ...\n")
    tryCatch({
      udpipe::udpipe_download_model(language = "portuguese-bosque",
                                    model_dir = udpipe_dir)
      cat("[DONE]    udpipe PT-BR model cached at ", udpipe_dir, "\n")
    }, error = function(e) cat(sprintf("[FAIL] udpipe model download: %s\n", conditionMessage(e))))
  }
} else {
  cat("[OK]      udpipe PT-BR model already cached\n")
}

# ---- final report ----------------------------------------------------------
cat("\n========================= BOOTSTRAP REPORT =========================\n")
report <- c(
  "EGAnet", "mirt", "glmnet", "randomForest", "udpipe", "quanteda",
  "httr2", "tictoc", "AIGENIE", "reticulate", "jsonlite", "igraph",
  "qgraph", "glasso", "lavaan", "psych", "Matrix", "lme4", "openxlsx"
)
for (p in report) {
  ok <- suppressWarnings(suppressMessages(requireNamespace(p, quietly = TRUE)))
  ver <- if (ok) tryCatch(as.character(packageVersion(p)), error = function(e) "?") else "-"
  cat(sprintf("  %-15s %s  %s\n", p, if (ok) "OK  " else "FAIL", ver))
}
cat("====================================================================\n")
