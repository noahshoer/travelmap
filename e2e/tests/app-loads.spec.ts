import { expect, test } from "@playwright/test";

test("map, legend, and controls render with no console errors", async ({ page }) => {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (err) => pageErrors.push(err.message));

  await page.goto("/");

  // The map is inlined SVG; wait for state shapes to actually be painted in.
  const statePaths = page.locator("#map svg g.state > path");
  await expect(statePaths.first()).toBeVisible();
  await expect(statePaths).toHaveCount(51); // 50 states + DC

  // Legend swatches.
  await expect(page.locator(".legend .swatch.v-me")).toBeVisible();
  await expect(page.locator(".legend .swatch.v-partner")).toBeVisible();
  await expect(page.locator(".legend .swatch.v-both")).toBeVisible();
  await expect(page.locator(".legend .swatch.swatch-pin")).toBeVisible();

  // Controls.
  await expect(page.locator('#view-switch input[value="both"]')).toBeChecked();
  await expect(page.locator('#edit-switch input[value="me"]')).toBeChecked();
  await expect(page.locator("#pin-mode")).not.toBeChecked();

  // Names from the snapshot got applied.
  await expect(page.locator('[data-name="me"]').first()).toHaveText("E2E Me");
  await expect(page.locator('[data-name="partner"]').first()).toHaveText("E2E Partner");

  expect(consoleErrors, `console errors: ${consoleErrors.join("; ")}`).toEqual([]);
  expect(pageErrors, `page errors: ${pageErrors.join("; ")}`).toEqual([]);
});
