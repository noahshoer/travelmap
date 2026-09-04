# Changelog

All notable changes to the TravelMap Home Assistant app are documented here,
following the [Keep a Changelog](https://keepachangelog.com/) format.

## [0.1.3] - 2026-09-04

### Changed

- Moved `repository.yaml` and this app's folder from `home-assistant/` up to
  the repository root, so this repo can be added directly as a Home
  Assistant app repository (Settings → Add-ons → Add-on Store →
  Repositories) — Supervisor requires `repository.yaml` at the repo root,
  and this now supports automatic update detection instead of only the
  local-apps-folder install method.

## [0.1.2] - 2026-09-04

### Added

- Pinch-to-zoom and drag-to-pan on the map — aimed at the touchscreen this
  app typically runs on under the Ingress panel.
- A shared 🔓/🔒 "lock editing" button. While locked, no device can toggle a
  state or add/delete a pin until someone unlocks it again. This guards
  against accidental taps on a shared touchscreen; it is not authentication
  (see the "Access / networking" note in `DOCS.md`).

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
