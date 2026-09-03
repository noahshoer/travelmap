import { expect, test } from "@playwright/test";

test("Show: Me / Partner / Both actually changes what's rendered", async ({ page }) => {
  await page.goto("/");
  const colorado = page.locator("#map svg g.state > path.co"); // will be "me"-visited
  const newMexico = page.locator("#map svg g.state > path.nm"); // will be "partner"-visited

  // Record Colorado for "me" (default profile).
  await colorado.click();
  // Switch profile and record New Mexico for "partner".
  await page.locator('#edit-switch input[value="partner"]').check();
  await newMexico.click();

  // Default view is "both": each shows its own single-profile color.
  await expect(colorado).toHaveClass(/v-me/);
  await expect(newMexico).toHaveClass(/v-partner/);

  // Switch to "me": only Colorado should carry a visited color.
  await page.locator('#view-switch input[value="me"]').check();
  await expect(colorado).toHaveClass(/v-me/);
  await expect(newMexico).not.toHaveClass(/v-me|v-partner|v-both/);

  // Switch to "partner": only New Mexico should carry a visited color.
  await page.locator('#view-switch input[value="partner"]').check();
  await expect(newMexico).toHaveClass(/v-partner/);
  await expect(colorado).not.toHaveClass(/v-me|v-partner|v-both/);

  // Back to "both": both are visible again.
  await page.locator('#view-switch input[value="both"]').check();
  await expect(colorado).toHaveClass(/v-me/);
  await expect(newMexico).toHaveClass(/v-partner/);
});
