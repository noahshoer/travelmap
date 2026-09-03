import { expect, test } from "@playwright/test";

// Each test below uses a state code no other test touches, so tests stay
// independent even though they share one backend/DB for the whole run.

test("clicking an unvisited state marks it visited in the active profile's color", async ({
  page,
}) => {
  await page.goto("/");
  const wyoming = page.locator("#map svg g.state > path.wy");

  await expect(wyoming).not.toHaveClass(/v-me|v-partner|v-both/);
  await wyoming.click();
  await expect(wyoming).toHaveClass(/v-me/);
});

test("clicking that same state again deselects it", async ({ page }) => {
  // Regression test: web/map.js used to read the raw `class` attribute
  // instead of `classList` to find a state's code. Once a state carried a
  // `v-me`/`v-partner`/`v-both` class, the second click sent a garbled
  // (space-joined) `state_code` to the backend, the server 422'd, and the
  // click silently no-op'd -- so a visited state could never be turned back
  // off. This clicks the same state twice and asserts it really comes back
  // to fully unvisited, not just that a request went out.
  await page.goto("/");
  const montana = page.locator("#map svg g.state > path.mt");

  await expect(montana).not.toHaveClass(/v-me|v-partner|v-both/);

  await montana.click();
  await expect(montana).toHaveClass(/v-me/);

  await montana.click();
  await expect(montana).not.toHaveClass(/v-me|v-partner|v-both/);
  // And the class attribute itself should be back to just the bare code,
  // not something garbled like "mt v-me" left behind.
  await expect(montana).toHaveClass("mt");
});

test("recording the other profile on an already-visited state turns it green (both)", async ({
  page,
}) => {
  // Other half of the same bug: the *second* profile's visit on an
  // already-visited state used to silently fail for the identical reason.
  await page.goto("/");
  const utah = page.locator("#map svg g.state > path.ut");

  await utah.click(); // visited by "me" (default profile)
  await expect(utah).toHaveClass(/v-me/);

  await page.locator('#edit-switch input[value="partner"]').check();
  await utah.click(); // now visited by "partner" too
  await expect(utah).toHaveClass(/v-both/);
  await expect(utah).not.toHaveClass(/v-me/);
});
