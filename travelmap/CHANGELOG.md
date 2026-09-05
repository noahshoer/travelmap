# Changelog

All notable changes to the TravelMap Home Assistant app are documented here,
following the [Keep a Changelog](https://keepachangelog.com/) format.

## [0.1.5] - 2026-09-04

### Fixed

- The map was sized by its own aspect ratio (`height: auto`, capped at
  `80vh`) with padding around it, rather than filling the space below the
  header — so on most screens it fell short of the available height,
  leaving blank page background as a visible border/block beneath it. The
  page now uses a full-height flex layout: the header keeps its natural
  size, and the map fills exactly the remaining space edge to edge (a
  narrow/portrait screen still letterboxes some, since the US map's own
  aspect ratio is much wider than a portrait screen — that's normal, not a
  bug).

## [0.1.4] - 2026-09-04

### Added

- `icon.png` (128x128) and `logo.png` (270x100): a pin-shaped mark split
  blue/green/yellow the same way the map itself colors a state — blue for
  one person, yellow for the other, green exactly where both have visited.

### Fixed

- Dragging the map when not zoomed in (still at its default, fully-fit
  scale) slid it around anyway, revealing the map container's background as
  a border on one side while clipping map content on the other. Panning is
  now only possible once actually zoomed in past that default scale.

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
