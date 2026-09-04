# Home Assistant App image for TravelMap.
#
# Two stages:
#   1. `builder` compiles the Rust binary. This image is picked by whatever
#      target platform `docker buildx`/the HA builder is building for (via
#      --platform, using QEMU emulation for foreign architectures) - this is
#      standard Docker multi-arch buildx behaviour and is independent of the
#      BUILD_FROM mechanism below.
#   2. The runtime stage is FROM the Home Assistant base image supplied via
#      the BUILD_FROM build-arg, which the official HA builder action
#      substitutes per target architecture. Default here matches what
#      developers.home-assistant.io's own example app
#      (home-assistant/apps-example) uses as of this writing, for local
#      `docker build` testing without the HA builder.
#      Ref: https://developers.home-assistant.io/docs/apps/tutorial
#           https://developers.home-assistant.io/docs/apps/publishing
#
# Build context MUST be the project root (not this directory), since this
# Dockerfile also needs Cargo.toml/src/web from up there, e.g. from the repo
# root:
#   docker build -f travelmap/Dockerfile -t travelmap-ha .
# The official Home Assistant builder handles this via its own repo-relative
# path conventions when publishing; see HOME_ASSISTANT.md.

# Declared before the first FROM so it's in scope for every stage's FROM
# line (Docker requires this for ARGs used in FROM).
ARG BUILD_FROM=ghcr.io/home-assistant/base:3.23

# ---- build stage -----------------------------------------------------------
FROM rust:1-alpine AS builder

RUN apk add --no-cache musl-dev gcc make

WORKDIR /src
COPY Cargo.toml Cargo.lock ./
COPY src ./src

# rusqlite's "bundled" feature compiles SQLite from source, so it needs a C
# toolchain (added above) but no system sqlite package.
RUN cargo build --release --locked && \
    cp target/release/travelmap /usr/local/bin/travelmap

# ---- runtime stage ----------------------------------------------------------
FROM ${BUILD_FROM}

COPY --from=builder /usr/local/bin/travelmap /usr/bin/travelmap
COPY web /opt/travelmap/web
COPY travelmap/run.sh /
RUN chmod a+x /run.sh /usr/bin/travelmap

# Persistent storage: Home Assistant always bind-mounts /data read-write into
# the container (see config.yaml). TRAVELMAP_WEB_DIR/ADDR are fixed for this
# image; TRAVELMAP_ME/TRAVELMAP_PARTNER are set at start-up by run.sh from the
# app's configured options.
ENV TRAVELMAP_WEB_DIR=/opt/travelmap/web \
    TRAVELMAP_DB=/data/travelmap.db \
    TRAVELMAP_ADDR=0.0.0.0:8099

LABEL \
    org.opencontainers.image.title="TravelMap" \
    org.opencontainers.image.description="A shared US travel map for two people" \
    org.opencontainers.image.source="https://github.com/noahshoer/travelmap" \
    org.opencontainers.image.licenses="MIT"

CMD [ "/run.sh" ]
