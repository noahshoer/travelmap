// Playwright config for TravelMap's browser E2E suite.
//
// This launches its own throwaway instance of the Rust server (`cargo run`)
// on a non-default port, pointed at a scratch SQLite file under
// `e2e/.scratch/`, wired up with test-only profile names. It never binds
// :8080 and never touches `data/travelmap.db` — those belong to the real,
// currently-running instance with real travel data.
//
// The scratch DB is wiped (synchronously, below) before every full test run
// so tests start from a known-empty snapshot.

import { defineConfig, devices } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(here, "..");

const HOST = "127.0.0.1";
const PORT = 8099;
const SCRATCH_DIR = path.join(here, ".scratch");
const SCRATCH_DB = path.join(SCRATCH_DIR, "travelmap-e2e.db");

// Start every run from a clean database. This config module is loaded once
// by the runner process and again by each worker process; only the runner
// (which loads it before `webServer` starts) should actually wipe -- by the
// time a worker imports this, the server may already have the scratch DB
// file open, and deleting its parent directory out from under it fails with
// EPERM on Windows. Swallow that; the runner's wipe already happened.
if (!process.env.TEST_WORKER_INDEX) {
  fs.rmSync(SCRATCH_DIR, { recursive: true, force: true });
}

export default defineConfig({
  testDir: path.join(here, "tests"),
  // Keep all generated artifacts (traces, the HTML report) contained under
  // e2e/ instead of littering the project root.
  outputDir: path.join(here, "test-results"),
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: `http://${HOST}:${PORT}`,
    trace: "retain-on-failure",
  },
  webServer: {
    command: "cargo run --quiet",
    cwd: projectRoot,
    url: `http://${HOST}:${PORT}/api/snapshot`,
    reuseExistingServer: false,
    timeout: 120_000,
    stdout: "pipe",
    stderr: "pipe",
    env: {
      TRAVELMAP_ADDR: `${HOST}:${PORT}`,
      TRAVELMAP_DB: SCRATCH_DB,
      TRAVELMAP_ME: "E2E Me",
      TRAVELMAP_PARTNER: "E2E Partner",
      TRAVELMAP_WEB_DIR: path.join(projectRoot, "web"),
    },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
