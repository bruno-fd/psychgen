#!/usr/bin/env bash
# Bootstrap workflow — installs missing R packages from CRAN, then idles.
# Used as a temporary workflow so the install survives agent turn boundaries.
set -uo pipefail
cd "$(dirname "$0")/.."
mkdir -p logs
echo "[$(date)] === bootstrap starting ==="
source scripts/r-env.sh
rm -rf /home/runner/.R/library-4.4/00LOCK-* /tmp/Rtmp* 2>/dev/null || true
# Run bootstrap up to 3 times (handles transient compile failures, env updates)
ATTEMPT=1
while [ $ATTEMPT -le 3 ]; do
  echo "[$(date)] === bootstrap attempt $ATTEMPT ==="
  rm -rf /home/runner/.R/library-4.4/00LOCK-* 2>/dev/null || true
  stdbuf -oL -eL Rscript scripts/r-bootstrap.R 2>&1 | tee -a logs/r-heavy.log
  # Check if all critical packages installed
  MISSING=$(Rscript -e 'pkgs<-c("mirt","EGAnet","quanteda","udpipe","openxlsx","httr2"); m<-pkgs[!sapply(pkgs,function(p)suppressWarnings(suppressMessages(requireNamespace(p,quietly=TRUE))))]; cat(length(m))' 2>/dev/null)
  if [ "$MISSING" = "0" ]; then
    echo "[$(date)] === all critical R packages present ==="
    break
  fi
  ATTEMPT=$((ATTEMPT+1))
  sleep 5
done
echo "[$(date)] === bootstrap finished ==="
# Stay alive so the workflow doesn't get auto-removed; sleep until killed
while true; do
  sleep 60
  echo "[$(date)] bootstrap-loop alive (idle)"
done
