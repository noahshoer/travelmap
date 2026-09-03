import { expect, test } from "@playwright/test";

test("add a pin then delete it", async ({ page }) => {
  await page.goto("/");

  const pins = page.locator("#map svg g.pins > g.pin");
  await expect(pins).toHaveCount(0);

  // Toggle pin-drop mode.
  await page.locator("#pin-mode").check();
  await expect(page.locator("body")).toHaveClass(/pin-mode/);

  // Click anywhere on the map; in pin mode this opens the label dialog
  // instead of toggling a state's visited status.
  await page.locator("#map svg g.state > path").first().click();

  const dialog = page.locator("#pin-dialog");
  await expect(dialog).toBeVisible();
  await page.locator("#pin-label").fill("Grand Canyon");
  await page.getByRole("button", { name: "Add pin" }).click();

  await expect(pins).toHaveCount(1);
  await expect(pins.first()).toHaveAttribute("class", "pin pin-me");

  // Delete it: clicking a pin prompts a native confirm() dialog.
  page.once("dialog", (d) => d.accept());
  await pins.first().click();
  await expect(pins).toHaveCount(0);
});
