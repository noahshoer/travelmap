// @ts-check
// Pinch-to-zoom and drag-to-pan for the map, aimed at the touchscreen this app
// runs on under Home Assistant's dashboard. Applies a plain CSS transform to
// the <svg> element; it never touches the SVG's own coordinate system, so
// every existing hit-test and `getScreenCTM()`-based calculation in map.js
// keeps working unmodified — the browser resolves both against the actual
// rendered (post-transform) geometry.

const MIN_SCALE = 1;
const MAX_SCALE = 6;
/** Screen pixels a pointer must move before a gesture counts as a drag/pinch
 * rather than a tap — used to swallow the click that would otherwise follow. */
const MOVE_THRESHOLD = 6;
/** Minimum overlap (px) kept between the map and its container when panning. */
const MIN_OVERLAP = 60;

const clamp = (/** @type {number} */ v, /** @type {number} */ lo, /** @type {number} */ hi) =>
  Math.min(hi, Math.max(lo, v));

/**
 * Wire up pinch-zoom + drag-pan on `svg`, using pointer events captured on
 * `container` (its parent). Multi-touch is handled via the Pointer Events API,
 * which — unlike mouse events — assigns every simultaneous touch its own
 * pointerId, so tracking a `Map` of active pointers gives us both single-finger
 * pan and two-finger pinch for free.
 * @param {HTMLElement} container
 * @param {SVGSVGElement} svg
 */
export function enablePanZoom(container, svg) {
  /** @type {Map<number, { x: number, y: number }>} */
  const pointers = new Map();
  let scale = 1;
  let tx = 0;
  let ty = 0;
  let pinchDist = 0;
  let moved = false;

  function apply() {
    svg.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`;
  }

  function activePoints() {
    return [...pointers.values()];
  }

  function distance() {
    const [a, b] = activePoints();
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  function midpoint() {
    const [a, b] = activePoints();
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  }

  /** Nudge tx/ty so the map keeps at least MIN_OVERLAP px inside the container. */
  function clampPan() {
    const rect = svg.getBoundingClientRect();
    const cRect = container.getBoundingClientRect();
    if (rect.right < cRect.left + MIN_OVERLAP) tx += cRect.left + MIN_OVERLAP - rect.right;
    if (rect.left > cRect.right - MIN_OVERLAP) tx += cRect.right - MIN_OVERLAP - rect.left;
    if (rect.bottom < cRect.top + MIN_OVERLAP) ty += cRect.top + MIN_OVERLAP - rect.bottom;
    if (rect.top > cRect.bottom - MIN_OVERLAP) ty += cRect.bottom - MIN_OVERLAP - rect.top;
  }

  container.addEventListener("pointerdown", (ev) => {
    // Pointer capture is deferred to the first real move (below): grabbing it
    // immediately here would retarget the plain-tap `click` that follows a
    // no-movement pointerdown/pointerup to `container` itself, so it would
    // never reach the state-path/pin element it's supposed to bubble through.
    pointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    moved = false;
    if (pointers.size === 2) pinchDist = distance();
  });

  container.addEventListener("pointermove", (ev) => {
    if (!pointers.has(ev.pointerId)) return;
    const prev = pointers.get(ev.pointerId);
    const dx = ev.clientX - (prev?.x ?? ev.clientX);
    const dy = ev.clientY - (prev?.y ?? ev.clientY);
    pointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    if (!moved && (Math.abs(dx) > MOVE_THRESHOLD || Math.abs(dy) > MOVE_THRESHOLD)) {
      moved = true;
      for (const id of pointers.keys()) {
        try {
          container.setPointerCapture(id);
        } catch {
          // Pointer may already be gone; capturing is just an optimization.
        }
      }
    }

    if (pointers.size === 2) {
      const dist = distance();
      const prevScale = scale;
      scale = clamp(scale * (dist / pinchDist), MIN_SCALE, MAX_SCALE);
      pinchDist = dist;
      const ratio = scale / prevScale;

      const mid = midpoint();
      const rect = svg.getBoundingClientRect();
      const fracX = (mid.x - rect.left) / rect.width;
      const fracY = (mid.y - rect.top) / rect.height;
      tx += mid.x - fracX * rect.width * ratio - rect.left;
      ty += mid.y - fracY * rect.height * ratio - rect.top;
      clampPan();
      apply();
    } else if (pointers.size === 1) {
      tx += dx;
      ty += dy;
      clampPan();
      apply();
    }
  });

  function endPointer(/** @type {PointerEvent} */ ev) {
    pointers.delete(ev.pointerId);
    if (pointers.size >= 2) pinchDist = distance();
  }
  container.addEventListener("pointerup", endPointer);
  container.addEventListener("pointercancel", endPointer);

  // A drag/pinch still ends in a native `click` on whatever's under the last
  // finger lifted. Swallow it in the capture phase (before it reaches the
  // state-path or pin handlers) so panning never also toggles a state or
  // drops/deletes a pin.
  container.addEventListener(
    "click",
    (ev) => {
      if (!moved) return;
      moved = false;
      ev.stopPropagation();
      ev.preventDefault();
    },
    true,
  );
}
