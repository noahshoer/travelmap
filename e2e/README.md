# TravelMap E2E tests

Browser tests driven by [Playwright](https://playwright.dev), covering the
real UI in a real browser: map rendering, click-to-toggle-visited (including
the deselect-on-second-click and record-for-partner cases), the Show/Me/
Partner/Both view filter, and the add-pin/delete-pin flow.

These tests launch their **own** instance of the Rust server on
`127.0.0.1:8099` against a scratch SQLite file under `e2e/.scratch/`
(wiped before every run). They never touch port 8080 or
`data/travelmap.db` — the real server and real data are left alone even if
it's running at the same time.

## One-time setup

```sh
npm install                    # installs @playwright/test (scripts are blocked by .npmrc, that's fine)
npx playwright install chromium   # downloads a local Chromium browser binary (not an npm package)
```

The `playwright install` step only needs to be run once per machine (or
whenever the pinned `@playwright/test` version changes). It downloads a
browser binary to `~/AppData/Local/ms-playwright` (or the platform
equivalent) — nothing is added to `node_modules` or `package-lock.json` by
this step.

## Running

```sh
npm run test:e2e
```

This runs `playwright test --config=e2e/playwright.config.ts`, which:

1. Wipes `e2e/.scratch/`.
2. Runs `cargo run --quiet` from the project root with `TRAVELMAP_ADDR`,
   `TRAVELMAP_DB`, `TRAVELMAP_ME`, and `TRAVELMAP_PARTNER` all pointed at the
   scratch port/DB/profile names, and waits for `/api/snapshot` to respond.
3. Runs the tests in `e2e/tests/` against that instance, single worker
   (tests share one backend/DB for the run, so each test either uses a state
   code no other test touches, or is fully self-contained).
4. Tears the server down when done.

## Debugging a failure

- `npx playwright show-report --config=e2e/playwright.config.ts` after a run
  shows the HTML report (traces are captured on failure).
- `npx playwright test --config=e2e/playwright.config.ts --ui` for the
  interactive UI mode.
