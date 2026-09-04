import { expect, test } from "@playwright/test";

test("dragging the map without zooming in does not pan or clip it", async ({ page }) => {
  // Regression test: clampPan() used to only guarantee a minimum overlap
  // between the map and its container, not that panning was actually
  // possible. At the default scale (1, fully fit to its container) that let
  // a plain drag slide the map around anyway, revealing the container's own
  // background as a border on one side while clipping map content on the
  // other -- with nothing extra to see, since the map already exactly fills
  // its container when not zoomed in. Dragging now must be a no-op until the
  // map is actually zoomed in past scale 1.
  await page.goto("/");
  const svg = page.locator("#map svg");
  const before = await svg.boundingBox();

  const box = await page.locator("#map").boundingBox();
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;

  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx, cy - 150, { steps: 10 });
  await page.mouse.up();

  const after = await svg.boundingBox();
  expect(after).toEqual(before);
});
