// @ts-check
// Everything that touches the inline SVG: loading it, finding the state shapes,
// recoloring them from a snapshot, and drawing the pin layer.
//
// Types live in ./types.js and are referenced via inline `import(...)` in JSDoc,
// so no runtime import of it is needed here.

const SVG_NS = "http://www.w3.org/2000/svg";

/**
 * Fetch `us-states.svg`, inline it into `host`, and return the <svg> element.
 * @param {HTMLElement} host
 * @returns {Promise<SVGSVGElement>}
 */
export async function loadMap(host) {
  const res = await fetch("web/us-states.svg");
  if (!res.ok) throw new Error(`could not load map svg (${res.status})`);
  const text = await res.text();
  const doc = new DOMParser().parseFromString(text, "image/svg+xml");
  const svg = doc.documentElement;
  if (!(svg instanceof SVGSVGElement)) throw new Error("map svg is malformed");
  const imported = /** @type {SVGSVGElement} */ (document.importNode(svg, true));
  host.replaceChildren(imported);
  return imported;
}

/**
 * The two-letter state code for a state path, or null if `el` isn't one.
 *
 * Reads `classList` rather than the raw `class` attribute: once a state has
 * been painted, its attribute also carries `v-me`/`v-partner`/`v-both`
 * (see `paintStates`), so the attribute string is no longer just the code.
 * @param {Element} el
 * @returns {string | null}
 */
export function stateCode(el) {
  for (const cls of el.classList) {
    if (/^[a-z]{2}$/.test(cls)) return cls;
  }
  return null;
}

/**
 * Map of lowercase state code -> its <path> element.
 * @param {SVGSVGElement} svg
 * @returns {Map<string, SVGPathElement>}
 */
export function getStateElements(svg) {
  /** @type {Map<string, SVGPathElement>} */
  const out = new Map();
  svg.querySelectorAll("g.state > path").forEach((el) => {
    const code = stateCode(el);
    if (code && el instanceof SVGPathElement) out.set(code, el);
  });
  return out;
}

/**
 * Recolor every state according to who has visited it and the current view.
 * @param {Map<string, SVGPathElement>} stateEls
 * @param {import("./types.js").Snapshot} snapshot
 * @param {import("./types.js").ViewMode} view
 */
export function paintStates(stateEls, snapshot, view) {
  const me = new Set(snapshot.visits.me);
  const partner = new Set(snapshot.visits.partner);

  for (const [code, el] of stateEls) {
    el.classList.remove("v-me", "v-partner", "v-both");
    const inMe = me.has(code);
    const inPartner = partner.has(code);

    if (view === "me" && inMe) el.classList.add("v-me");
    else if (view === "partner" && inPartner) el.classList.add("v-partner");
    else if (view === "both") {
      if (inMe && inPartner) el.classList.add("v-both");
      else if (inMe) el.classList.add("v-me");
      else if (inPartner) el.classList.add("v-partner");
    }
  }
}

/**
 * Ensure the pin layer group exists and sits on top of everything.
 * @param {SVGSVGElement} svg
 * @returns {SVGGElement}
 */
function pinLayer(svg) {
  const existing = svg.querySelector("g.pins");
  const layer =
    existing instanceof SVGGElement
      ? existing
      : /** @type {SVGGElement} */ (document.createElementNS(SVG_NS, "g"));
  layer.setAttribute("class", "pins");
  svg.appendChild(layer); // move to end -> drawn last -> on top
  return layer;
}

/**
 * Redraw all pins visible in the current view.
 * @param {SVGSVGElement} svg
 * @param {import("./types.js").Pin[]} pins
 * @param {import("./types.js").ViewMode} view
 * @param {(pin: import("./types.js").Pin) => void} onPinActivate
 */
export function paintPins(svg, pins, view, onPinActivate) {
  const layer = pinLayer(svg);
  layer.replaceChildren();
  const { width, height } = svg.viewBox.baseVal;

  for (const pin of pins) {
    if (view !== "both" && pin.profile !== view) continue;

    const g = document.createElementNS(SVG_NS, "g");
    g.setAttribute("class", `pin pin-${pin.profile}`);
    g.setAttribute("transform", `translate(${pin.x * width} ${pin.y * height})`);
    g.dataset.id = String(pin.id);

    const dot = document.createElementNS(SVG_NS, "circle");
    dot.setAttribute("r", "5");
    g.appendChild(dot);

    const title = document.createElementNS(SVG_NS, "title");
    title.textContent = pin.label || "(no label)";
    g.appendChild(title);

    g.addEventListener("click", (ev) => {
      ev.stopPropagation();
      onPinActivate(pin);
    });
    layer.appendChild(g);
  }
}

/**
 * Convert a pointer event to normalized viewBox coordinates (0..1), or null if
 * the point is outside the map.
 * @param {SVGSVGElement} svg
 * @param {MouseEvent} ev
 * @returns {{ x: number, y: number } | null}
 */
export function eventToNormalized(svg, ev) {
  const ctm = svg.getScreenCTM();
  if (!ctm) return null;
  const pt = svg.createSVGPoint();
  pt.x = ev.clientX;
  pt.y = ev.clientY;
  const local = pt.matrixTransform(ctm.inverse());
  const { width, height } = svg.viewBox.baseVal;
  const x = local.x / width;
  const y = local.y / height;
  if (x < 0 || x > 1 || y < 0 || y > 1) return null;
  return { x, y };
}
