# Changelog

All notable changes to the TravelMap Home Assistant app are documented here,
following the [Keep a Changelog](https://keepachangelog.com/) format.

## [0.1.0] - 2026-09-02

### Added

- Initial Home Assistant App packaging of TravelMap: multi-stage Dockerfile
  (Rust build stage + `ghcr.io/home-assistant/base` runtime stage),
  `config.yaml` manifest, Ingress support, and `/data`-backed persistent
  SQLite storage.
