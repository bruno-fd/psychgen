#!/usr/bin/env bash
set -euo pipefail

# Make sure the persisted user library is on .libPaths() at runtime.
mkdir -p "${R_LIBS_USER:-/home/r/.R/library-4.4}"

echo ">>> Starting PsychGen R engine on :8000"
exec Rscript -e "
  options(plumber.port = 8000, plumber.host = '0.0.0.0')
  pr <- plumber::plumb('/srv/plumber.R')
  pr\$run(host = '0.0.0.0', port = 8000)
"
