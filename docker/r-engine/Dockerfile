FROM rocker/r-ver:4.4.3

ENV DEBIAN_FRONTEND=noninteractive \
    R_LIBS_USER=/home/r/.R/library-4.4 \
    HOME=/home/r

# System libs needed by EGAnet, qgraph, semPlot, lavaan, mirt, udpipe, quanteda,
# httr2, openxlsx, plumber, etc.
RUN apt-get update && apt-get install -y --no-install-recommends \
      build-essential \
      gfortran \
      libcurl4-openssl-dev \
      libssl-dev \
      libxml2-dev \
      libfontconfig1-dev \
      libfreetype6-dev \
      libharfbuzz-dev \
      libfribidi-dev \
      libpng-dev \
      libtiff5-dev \
      libjpeg-dev \
      libcairo2-dev \
      libudunits2-dev \
      libgdal-dev \
      libgeos-dev \
      libproj-dev \
      libsodium-dev \
      libgit2-dev \
      libnode-dev \
      libglpk-dev \
      libgmp-dev \
      libmpfr-dev \
      pandoc \
      curl \
      ca-certificates \
      git \
    && rm -rf /var/lib/apt/lists/*

# Non-root user owning the persisted library volume.
RUN useradd -m -u 1000 -s /bin/bash r \
    && mkdir -p /home/r/.R/library-4.4 /home/r/.cache /srv/r-scripts \
    && chown -R r:r /home/r /srv

WORKDIR /srv

COPY --chown=r:r install_packages.R /srv/install_packages.R
COPY --chown=r:r plumber.R /srv/plumber.R
COPY --chown=r:r entrypoint.sh /srv/entrypoint.sh
# Strip Windows CRLF line endings (host-OS-agnostic build): if the repo was
# checked out on Windows with autocrlf=true, the shebang ends with \r and the
# kernel can't find the interpreter ("/usr/bin/env: 'bash\r': No such file").
RUN sed -i 's/\r$//' /srv/entrypoint.sh /srv/install_packages.R /srv/plumber.R \
    && chmod +x /srv/entrypoint.sh

# Install R packages as ROOT so they go into the system lib
# (/usr/local/lib/R/site-library — not writable by the unprivileged `r` user).
# Heavy deps (mirt, EGAnet, udpipe, quanteda, plumber, AIGENIE) are pre-baked
# so the image is self-contained; the user volume at $R_LIBS_USER is for any
# extras and survives container removal. The udpipe model is downloaded to
# /home/r/.cache/udpipe (HOME=/home/r set above); we chown it back to `r`
# afterwards so the runtime user can read it.
RUN Rscript /srv/install_packages.R \
    && chown -R r:r /home/r/.cache /home/r/.R

USER r

EXPOSE 8000

ENTRYPOINT ["/srv/entrypoint.sh"]
