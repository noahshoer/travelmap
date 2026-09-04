# TravelMap

A small private web app for two people to record which US states each of them
has visited, drop labeled pins for specific places, and see where their travels
overlap.

- **Backend:** Rust. HTTP via `tiny_http`, storage in embedded SQLite
  (`rusqlite` with the `bundled` feature), JSON via `serde`. No npm anywhere.
- **Frontend:** plain browser ES modules with JSDoc types (`// @ts-check`). The
  browser loads the files as-is: no build step, no bundler, nothing shipped from
  npm. The single dev-only npm package `typescript` is used purely to run
  `tsc --noEmit` as a type-check (see below); it never touches the browser.
- **Map:** an inline public-domain SVG of the US (Wikimedia "Blank US Map"). Each
  state is one `<path>` keyed by its lowercase postal code.

## Colors

| Who | Color |
|-----|-------|
| You | blue |
| Partner | yellow |
| Both of you | green |

Pins are red dots.

There is no login or passphrase — this is meant to run on a trusted home
network for two people. Anyone who can reach it can view **and edit** it.

## Running it

You need a recent Rust toolchain (`cargo`). Then:

```sh
# optional: set your names / port (defaults work fine without this)
cp travelmap.toml.example travelmap.toml   # then edit it

cargo run
```

The server prints its address (default `http://0.0.0.0:8080`). Open it in a
browser. From another device on the same network, use the host machine's LAN IP,
e.g. `http://192.168.1.20:8080`.

### Configuration

Every setting can come from an environment variable or a matching line in
`travelmap.toml` (env wins). Nothing is required — everything has a default.

| Key | Default | Meaning |
|-----|---------|---------|
| `TRAVELMAP_ME` | `Me` | Display name for the first profile |
| `TRAVELMAP_PARTNER` | `Partner` | Display name for the second profile |
| `TRAVELMAP_ADDR` | `0.0.0.0:8080` | Address to bind |
| `TRAVELMAP_DB` | `data/travelmap.db` | SQLite file path |
| `TRAVELMAP_WEB_DIR` | `web` | Directory of static frontend files |

## Using it

- **Show: Me / Partner / Both** switches which travels are drawn. In *Both*,
  states only one of you has visited keep that person's color; shared states turn
  green.
- Pick **Record for: Me / Partner**, then click a state to toggle it for that
  person.
- Tick **Drop a pin on click**, then click anywhere on the map to add a labeled
  pin for the current person. Click a pin to delete it.
- **Pinch to zoom, drag to pan.** Handy on the touchscreen this app typically
  runs on under Home Assistant's dashboard; also works by dragging with a
  mouse. Purely a view — it never changes what's stored.
- **🔓/🔒 lock button** toggles a shared "editing locked" state: while locked,
  no one can toggle states, drop pins, or delete pins (from any device), until
  someone unlocks it again. This is a convenience to stop accidental taps on a
  shared touchscreen, not authentication — see the note above.

## Data & backups

Everything lives in the single SQLite file at `TRAVELMAP_DB` (default
`data/travelmap.db`). To back up, copy that file. To reset, delete it and
restart.

## Project layout

```
src/
  main.rs      tiny_http server; adapts HTTP <-> router::{Req, Resp}
  lib.rs       library root
  config.rs    env + travelmap.toml loading
  db.rs        SQLite schema and every query (unit tests here)
  router.rs    transport-agnostic route(App, &Req) -> Resp (handler tests here)
tests/
  http.rs      end-to-end check through the tiny_http server on a real port
web/
  index.html  styles.css  app.js  map.js  zoom.js  types.js  us-states.svg
e2e/
  playwright.config.ts  tests/*.spec.ts   browser tests against a throwaway server (`npm run test:e2e`)
package.json  tsconfig.json  .npmrc   dev-only: `npm run typecheck` (tsc --noEmit)
```

## Tests

```sh
cargo test
```

Covers the database layer, every route through `route()`, and one full pass
through the real HTTP server.

## End-to-end tests

Browser tests (Playwright) live in `e2e/`. One-time setup:

```sh
npm install
npx playwright install chromium
```

Run them with:

```sh
npm run test:e2e
```

See `e2e/README.md` for details — these tests launch their own throwaway
server instance on a separate port with a scratch database; they never touch
your real `data/travelmap.db` or port 8080.

## Type-checking the frontend

The `web/` files are plain JavaScript that the browser runs directly. They carry
`// @ts-check` and JSDoc type annotations; your editor checks them live with no
setup. To check them from the command line (e.g. before a commit):

```sh
npm install   # one-time; installs only `typescript`
npm run typecheck
```

`npm run typecheck` runs `tsc --noEmit` against `tsconfig.json` (`checkJs`,
`strict`). It emits nothing — it only reports type errors.

### Supply-chain notes

`typescript` is the only npm package and it is **dev-only** — it is never
imported by the browser code and nothing from `node_modules/` is served.

- **Pinned exact version** (`typescript: "5.9.3"` in `package.json`, no `^`). The
  5.x line is the pure-JavaScript compiler with **zero dependencies**: the whole
  install is one auditable package, no native binaries. (TypeScript 7+ ships
  per-platform native binary sub-packages; we intentionally stay on 5.x.)
- **`package-lock.json` is committed** and includes the tarball URL and a
  `sha512` integrity hash. Use `npm ci` (not `npm install`) to install exactly
  what the lockfile pins.
- **`.npmrc` sets `ignore-scripts=true`**, so no install/postinstall lifecycle
  scripts run — for this package or any future one.
- To avoid the registry entirely you can vendor it: `npm pack typescript@5.9.3`,
  commit the `.tgz`, and point `package.json` at `file:./typescript-5.9.3.tgz`.

## Home Assistant

TravelMap can also be installed as a Home Assistant App. See
`home-assistant/README.md` for the manifest, Dockerfile, and publishing
instructions.
