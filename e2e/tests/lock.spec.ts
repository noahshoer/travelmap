import { expect, test } from "@playwright/test";

test("locking blocks edits until unlocked again", async ({ page }) => {
  await page.goto("/");

  const lockButton = page.locator("#lock-toggle");
  const meProfile = page.locator('#edit-switch input[value="me"]');
  const idaho = page.locator("#map svg g.state > path.id"); // unused by other specs

  await expect(lockButton).toHaveText("🔓 Unlocked");
  await expect(meProfile).toBeEnabled();

  await lockButton.click();
  await expect(lockButton).toHaveText("🔒 Locked");
  await expect(lockButton).toHaveAttribute("aria-pressed", "true");
  // Note: `#edit-switch` (the <fieldset>) is disabled too, but Playwright's
  // toBeDisabled() doesn't reliably report state on <fieldset> itself in this
  // version -- assert on the actual controls, which is what matters anyway.
  await expect(meProfile).toBeDisabled();
  await expect(page.locator("#pin-mode")).toBeDisabled();

  // A click on the map while locked must not record a visit.
  await idaho.click();
  await expect(idaho).not.toHaveClass(/v-me|v-partner|v-both/);

  await lockButton.click();
  await expect(lockButton).toHaveText("🔓 Unlocked");
  await expect(meProfile).toBeEnabled();

  // Unlocked again: the same click now records normally.
  await idaho.click();
  await expect(idaho).toHaveClass(/v-me/);

  // Leave editing unlocked so later tests in this run aren't affected.
});
