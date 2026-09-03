# TravelMap - documentation

## What it is

A small Rust + vanilla-JS web app: an interactive SVG map of the US states,
plus freeform pins, tracked separately for two profiles ("me" and
"partner"). Data is stored in a single SQLite file.

## Configuration

| Option          | Description                                              |
| ---------------- | --------------------------------------------------------- |
| `me_name`        | Display name for the "me" profile (default `Me`).        |
| `partner_name`   | Display name for the "partner" profile (default `Partner`). |

These map to the app's `TRAVELMAP_ME` / `TRAVELMAP_PARTNER` environment
variables when run standalone (outside Home Assistant); see the project's
top-level `README.md` for that mode.

## Storage

The SQLite database lives at `/data/travelmap.db` inside the container,
which Home Assistant persists across restarts and app updates
automatically (the `/data` directory is always bind-mounted read-write for
every app - nothing to configure).

## Access / networking

This app is Ingress-only: it has no host port published, and is only
reachable through the Home Assistant frontend's own authenticated reverse
proxy (the sidebar panel / Settings -> Add-ons -> TravelMap -> Open Web UI).
It is not directly reachable on your LAN the way a plain `cargo run` or
Docker `-p` deployment would be.

**Important - no in-app authentication.** Once you're inside the Ingress
panel, TravelMap itself does not ask who you are or check any password:
anyone with access to that Home Assistant user account (or, in some HA
configurations, anyone on your local network who can reach Home Assistant
unauthenticated) can view and edit *both* profiles' data. This mirrors the
standalone app's existing design (see the top-level project `README.md`
and `src/router.rs`), which was already a deliberate choice for a
trusted-home-network, two-person app - it is simply now gated by whatever
access Home Assistant itself grants, rather than by your home network's
physical boundary. If your Home Assistant instance is exposed beyond your
own household (e.g. Nabu Casa remote access shared with others, or a
public URL), anyone with that access can edit your travel data. See the
top-level `home-assistant/README.md` for the open decision this raises.

## Updating

New versions are pulled like any other Home Assistant app update. The
SQLite schema is additive/self-migrating on start (see `src/db.rs` in the
main project), so no manual migration steps are expected.
