#!/usr/bin/env bash
# Source this file (or use as wrapper) to get a working R 4.4.3 environment
# with all psychometric packages from nix + the user library for CRAN-installed
# extras (mirt, udpipe, quanteda, httr2, AIGENIE).
#
# Usage:
#   source scripts/r-env.sh
#   Rscript path/to/script.R
#
# Or as a wrapper:
#   bash scripts/r-env.sh Rscript path/to/script.R

set -e

# Locate R 4.4.3 from the nix channel (matches the rPackages in replit.nix).
if [ -z "${R_NIX_PATH:-}" ]; then
  R_NIX_PATH=$(nix-instantiate --eval -E '(import <nixpkgs> {}).R.outPath' 2>/dev/null | tr -d '"')
fi

export PATH="${R_NIX_PATH}/bin:${PATH}"

# Ensure xml2-config + pkg-config metadata for libxml2 are available so the
# XML and xml2 CRAN packages (and EGAnet/semPlot transitively) build from source.
for _xml2dev in /nix/store/*-libxml2-*-dev; do
  if [ -x "${_xml2dev}/bin/xml2-config" ] && [ -d "${_xml2dev}/lib/pkgconfig" ]; then
    export PATH="${_xml2dev}/bin:${PATH}"
    export PKG_CONFIG_PATH="${_xml2dev}/lib/pkgconfig${PKG_CONFIG_PATH:+:${PKG_CONFIG_PATH}}"
    break
  fi
done
unset _xml2dev

# Ensure cmake is available for packages such as nanonext.
for _cmakedir in /nix/store/*-cmake-3.*; do
  case "${_cmakedir}" in
    *-debug|*-doc|*-cursesUI*) continue ;;
  esac
  if [ -x "${_cmakedir}/bin/cmake" ]; then
    export PATH="${_cmakedir}/bin:${PATH}"
    break
  fi
done
unset _cmakedir

# R_LIBS_SITE: read from cache, regenerate if missing or older than replit.nix.
CACHE_FILE="$(dirname "${BASH_SOURCE[0]:-$0}")/../.cache/R_LIBS_SITE.txt"
CACHE_FILE="$(realpath "${CACHE_FILE}" 2>/dev/null || echo "${CACHE_FILE}")"

if [ ! -f "${CACHE_FILE}" ] || [ "$(dirname "${CACHE_FILE}")/../replit.nix" -nt "${CACHE_FILE}" ]; then
  mkdir -p "$(dirname "${CACHE_FILE}")"
  PKGS_JSON=$(nix-instantiate --eval -E 'let pkgs = import <nixpkgs> {}; in builtins.toJSON (map (p: p.outPath) (with pkgs.rPackages; [glmnet jsonlite igraph qgraph glasso randomForest psych Matrix lme4 lavaan ggplot2 patchwork RcppArmadillo numDeriv GPArotation survival reticulate proxy rappdirs RcppEigen Rcpp]))' 2>/dev/null | sed 's/^"//; s/"$//; s/\\"/"/g')
  PATHS=$(echo "$PKGS_JSON" | jq -r '.[]')
  ALL_R=$(for p in $PATHS; do nix-store -q --requisites "$p" 2>/dev/null; done | grep -- "-r-" | sort -u)
  echo "$ALL_R" | awk '{print $0"/library"}' | tr '\n' ':' | sed 's/:$//' > "${CACHE_FILE}"
fi

export R_LIBS_SITE="$(cat "${CACHE_FILE}")"

# User library for CRAN-installed packages (mirt, udpipe, quanteda, httr2, AIGENIE)
export R_LIBS_USER="${HOME}/.R/library-4.4"
mkdir -p "${R_LIBS_USER}"

# If invoked with arguments, exec them; otherwise no-op (intended to be sourced).
if [ "$#" -gt 0 ]; then
  exec "$@"
fi
