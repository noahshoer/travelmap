# TravelMap as a Home Assistant App

`travelmap/` packages TravelMap as a [Home Assistant App](https://developers.home-assistant.io/docs/apps/)
(the current name for what was previously called an "Add-on" — same
underlying mechanism: a container image plus a `config.yaml` manifest,
installed and run by the Supervisor). It's kept separate from the existing
`src/`/`web/` trees; the only files outside it touched for Home Assistant
support are the small ingress-path fix described below.

## Layout

```
repository.yaml            # marks the repo root as an app repository root
HOME_ASSISTANT.md          # this file
travelmap/
  config.yaml               # app manifest: name, version, arch, ingress, options schema
  Dockerfile                 # multi-stage build: Rust builder -> HA base runtime
  run.sh                     # bashio entrypoint; reads options, execs the binary
  README.md                  # short blurb shown in the HA Add-on Store
  DOCS.md                    # full docs shown in the app's "Documentation" tab
  CHANGELOG.md                # Keep-a-Changelog-style history
  .dockerignore
```

This mirrors the layout of Home Assistant's own reference repo,
[home-assistant/apps-example](https://github.com/home-assistant/apps-example)
(`repository.yaml` at the repo root, one subfolder per app containing that
app's `config.yaml`) — `repository.yaml` has to sit at the repo root for
Home Assistant's "Add repository" flow to find it at all; it previously
lived a level deeper (`home-assistant/repository.yaml`), which only
supported the local-apps-folder install method below.

## Installing

`config.yaml`'s `image:` field points at a pre-built, private image on GitHub
Container Registry, so the Supervisor pulls it rather than building anything
on-device. Two ways to install:

1. **Add this repo as a Home Assistant app repository** — Settings → Add-ons
   → Add-on Store → ⋮ → Repositories → add `https://github.com/noahshoer/travelmap`
   (or a fork of it). Supervisor periodically re-fetches `config.yaml` from
   the repo directly, so a `version:` bump shows up there as an available
   update automatically — no manual copying needed. Then register the
   registry credentials under **Settings → Add-ons → Add-on Store → Add new
   registry** (`ghcr.io` + username + a `read:packages`-scoped personal
   access token) so it can actually pull the image.
2. **Home Assistant's built-in local-apps folder** — no repository needed,
   but updates require manually re-copying files. Copy `travelmap/config.yaml`
   (optionally `DOCS.md`/`README.md`/icons too) into the local apps share on
   your Home Assistant device (exposed via the Samba or SSH/File Editor
   add-on — the share may be named `addons` or `local_apps` depending on
   your Supervisor version), under a folder named exactly `travelmap`.
   Register the same registry credentials as above, and the app appears
   under "Local Add-ons." Don't use both methods for the same install —
   Supervisor would see two different sources for the same `slug: travelmap`.

## Building & publishing the image

`.github/workflows/publish-ha-image.yml` builds `travelmap/Dockerfile` for
`linux/arm64` natively (on GitHub's free hosted Arm64 runner,
`ubuntu-24.04-arm` -- public repos only; cross-compiling Rust under QEMU
emulation instead is dramatically slower and can effectively hang) and
pushes it to
`ghcr.io/<owner>/aarch64-travelmap`, tagged `latest`, the version read from
`config.yaml`, and the commit SHA — matching the `{arch}-travelmap` name
`config.yaml`'s `image:` field expects for the `aarch64` entry in its
`arch:` list. It runs on every push to `main` that touches `src/`, `web/`,
`Cargo.{toml,lock}`, or `travelmap/`, and can also be run manually (Actions
tab -> this workflow -> "Run workflow").

One-time setup: a repo secret named `GHCR_PAT` holding a **classic** GitHub
PAT (Settings -> Developer settings -> Personal access tokens -> Tokens
(classic)) with the `write:packages` scope, used to log in to GHCR instead
of the built-in `GITHUB_TOKEN`. The push a bare `GITHUB_TOKEN` makes to a
package that doesn't exist yet is rejected with `denied: permission_denied:
read_package` -- a new package has no repo link yet for `GITHUB_TOKEN` to
inherit permissions from, regardless of the repo's Workflow permissions
setting. (GHCR also doesn't yet support fine-grained PATs for package
writes, only classic ones.) The first push creates the package privately,
matching the "private image" note above.

After a push lands a new image, install the update from Home Assistant's
Supervisor as usual (or bump `version:` in `config.yaml` first if you want
that version string to show up as an available update there).

## What the current docs actually say

("Apps" is a fairly recently renamed framework — worth confirming against
the source rather than assuming it matches older "Add-on" documentation.)

- Home Assistant's own docs open with: *"Apps (formerly known as add-ons)
  for Home Assistant allow the user to extend the functionality around
  Home Assistant."* Confirmed to be the same mechanism as the older
  "Add-ons," just renamed — not a different framework. `config.yaml`,
  `Dockerfile`, `run.sh`, Ingress, the Supervisor, `bashio`, etc. all still
  work as in the classic add-ons docs.
- The manifest file is still literally named `config.yaml` (also accepts
  `config.json`).
- Persistent storage: no `map:` entry needed for `/data` — every app
  automatically gets `/data` bind-mounted read-write. `TRAVELMAP_DB` is
  pointed at `/data/travelmap.db` in the Dockerfile/`run.sh`.
- Multi-arch builds use a `BUILD_FROM` Docker build-arg, defaulting to a
  single generic tag like `ghcr.io/home-assistant/base:3.23` (confirmed from
  Home Assistant's own current example app's Dockerfile) — no more per-arch
  base image names. The official builder action substitutes the right
  `BUILD_FROM` per architecture when publishing via CI; for a manual/local
  `docker build` the Dockerfile's own default is used as-is. (Also: as of
  Supervisor 2026.04.0, `BUILD_FROM` is no longer supplied automatically at
  all in some flows — worth re-checking current docs before relying on it.)
- **Ingress path handling**: Home Assistant's own docs recommend, verbatim,
  that if "the application doesn't support relative paths ... you can use
  [an] nginx filter to replace the URL" using the `X-Ingress-Path` header as
  a fallback — but the primary, docs-endorsed fix is making the frontend use
  relative paths so it works unmodified under any path prefix. That's the
  fix applied here (see below).

## The ingress-path fix (touches existing files)

Home Assistant's Ingress reverse proxy serves this app under a per-install
path prefix (e.g. `/api/hassio_ingress/<token>/`) rather than at the
webserver root. The frontend previously used root-absolute paths
(`/web/app.js`, `/api/snapshot`, etc.), which resolve against the browser's
current origin+prefix and would 404 under that prefix.

Fix: every root-absolute reference in the frontend became document-relative
(no leading `/`). Since the app's own router always serves `index.html` for
the path `"/"`, and Ingress always presents apps at a trailing-slash URL,
relative paths resolve correctly both in plain standalone mode and under an
Ingress prefix — no need to read `X-Ingress-Path`, and `src/router.rs`
didn't need to change.

Files touched:
- `web/index.html`: `/web/styles.css` -> `web/styles.css`,
  `/web/app.js` -> `web/app.js`
- `web/map.js`: `/web/us-states.svg` -> `web/us-states.svg`
- `web/app.js`: `/api/snapshot` -> `api/snapshot`, `/api/pins` ->
  `api/pins`, `/api/visits` -> `api/visits`,
  `` `/api/pins/${pin.id}` `` -> `` `api/pins/${pin.id}` ``

Verified this keeps working identically in plain `cargo run` mode (outside
Docker/Home Assistant entirely) as well as through a real container build.

## Icon / logo

Home Assistant's presentation guide recommends (not strictly requires) a
128x128 `icon.png` and a ~250x100 `logo.png` in `travelmap/`. Both are
included: a pin-shaped mark split blue/green/yellow the same way the app's
own map colors work (see below), rendered from inline SVG at exact pixel
size (no build step -- just checked-in PNGs). Nothing else needs to change
to pick them up.

## Options exposed

`config.yaml` exposes `me_name` / `partner_name` (mapped by `run.sh` to
`TRAVELMAP_ME` / `TRAVELMAP_PARTNER`) as user-editable options in the app's
Configuration tab.

## Access / security

This app has no login of its own — see the top-level project `README.md`.
Under Home Assistant, access is gated entirely by whatever your Home
Assistant instance itself grants (its login, Ingress being same-origin, and
any remote access such as Nabu Casa). Two things worth deciding deliberately
rather than by default:

- **Publishing scope.** This is set up as a private, installable-by-URL/
  local-folder app, not submitted to any public/community app store.
  Treat "make it public" as a separate step.
- **Whether the current zero-authentication design is acceptable** given
  who and what can reach your Home Assistant instance. If that access is
  broader than just the people this app's data is meant for, it's exposed
  to that same broader audience.
