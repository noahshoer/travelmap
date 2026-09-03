# Changelog

All notable changes to the TravelMap Home Assistant app are documented here,
following the [Keep a Changelog](https://keepachangelog.com/) format.

## [0.1.1] - 2026-09-02

### Fixed

- The app's HTTP router only matched the literal path `/`, but Home
  Assistant's Ingress entry URL is built with a trailing double slash
  (`//`), which fell through to a 404 on every "Open Web UI" click. Paths
  are now normalized (repeated slashes collapsed) before routing.

## [0.1.0] - 2026-09-02

### Added

- Initial Home Assistant App packaging of TravelMap: multi-stage Dockerfile
  (Rust build stage + `ghcr.io/home-assistant/base` runtime stage),
  `config.yaml` manifest, Ingress support, and `/data`-backed persistent
  SQLite storage.
