// @ts-check
// UI controller: load the map, keep a local copy of the snapshot, wire the
// switches and dialog, and send edits to the backend.
//
// Types live in ./types.js, referenced via inline `import(...)` in JSDoc.
//
// There is no login step — anyone who can load this page can edit it. That's
// intentional: this app is meant to run on a trusted home network for two
// people.

import {
  loadMap,
  getStateElements,
  paintStates,
  paintPins,
  eventToNormalized,
  stateCode,
} from "./map.js";

/**
 * @typedef {Object} UiState
 * @property {import("./types.js").ViewMode} view
 * @property {import("./types.js").Profile} profile
 * @property {boolean} pinMode
 * @property {import("./types.js").Snapshot | null} snapshot
 */

/** @type {UiState} */
const ui = {
  view: "both",
  profile: "me",
  pinMode: false,
  snapshot: null,
};

/** @type {SVGSVGElement} */
let svg;
/** @type {Map<string, SVGPathElement>} */
let stateEls = new Map();

const $ = (/** @type {string} */ sel) => {
  const el = document.querySelector(sel);
  if (!el) throw new Error(`missing element: ${sel}`);
  return el;
};

const statusEl = $("#status");
const pinDialog = /** @type {HTMLDialogElement} */ ($("#pin-dialog"));
const pinLabelInput = /** @type {HTMLInputElement} */ ($("#pin-label"));
const pinModeBox = /** @type {HTMLInputElement} */ ($("#pin-mode"));

function setStatus(/** @type {string} */ msg) {
  statusEl.textContent = msg;
}

// --- backend calls ----------------------------------------------------------

/**
 * @param {string} method
 * @param {string} path
 * @param {unknown} [body]
 * @returns {Promise<Response>}
 */
async function api(method, path, body) {
  const res = await fetch(path, {
    method,
    headers: body === undefined ? {} : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}`);
  return res;
}

async function refresh() {
  const res = await api("GET", "api/snapshot");
  ui.snapshot = /** @type {import("./types.js").Snapshot} */ (await res.json());
  applyNames(ui.snapshot.names);
  render();
}

function render() {
  if (!ui.snapshot) return;
  paintStates(stateEls, ui.snapshot, ui.view);
  paintPins(svg, ui.snapshot.pins, ui.view, (pin) => {
    onPinActivate(pin).catch((err) => {
      setStatus(`That didn't work: ${err instanceof Error ? err.message : String(err)}`);
    });
  });
}

// --- names ----------------------------------------------------------------

function applyNames(/** @type {{me: string, partner: string}} */ names) {
  document.querySelectorAll('[data-name="me"]').forEach((n) => (n.textContent = names.me));
  document
    .querySelectorAll('[data-name="partner"]')
    .forEach((n) => (n.textContent = names.partner));
}

// --- map interaction ----------------------------------------------------

/** @returns {Promise<string | null>} the pin label, or null if cancelled */
function askPinLabel() {
  pinLabelInput.value = "";
  pinDialog.showModal();
  return new Promise((resolve) => {
    pinDialog.addEventListener(
      "close",
      () => resolve(pinDialog.returnValue === "ok" ? pinLabelInput.value.trim() : null),
      { once: true },
    );
  });
}

async function onMapClick(/** @type {MouseEvent} */ ev) {
  if (!ui.snapshot) return;
  const target = ev.target;
  const path = target instanceof Element ? target.closest("path") : null;
  const isState =
    path && path.parentElement instanceof Element && path.parentElement.classList.contains("state");

  if (ui.pinMode) {
    const at = eventToNormalized(svg, ev);
    if (!at) return;
    const label = await askPinLabel();
    if (label === null) return;
    await api("POST", "api/pins", { profile: ui.profile, x: at.x, y: at.y, label });
    await refresh();
    setStatus(`Added pin${label ? ` "${label}"` : ""}.`);
    return;
  }

  if (!isState || !path) return;
  const code = stateCode(path);
  if (!code) return;
  const visited = ui.snapshot.visits[ui.profile].includes(code);
  await api("POST", "api/visits", {
    profile: ui.profile,
    state_code: code,
    visited: !visited,
  });
  await refresh();
}

async function onPinActivate(/** @type {import("./types.js").Pin} */ pin) {
  if (!confirm(`Delete pin "${pin.label || "(no label)"}"?`)) return;
  await api("DELETE", `api/pins/${pin.id}`);
  await refresh();
  setStatus("Pin deleted.");
}

// --- wiring -------------------------------------------------------------

function wireControls() {
  document.querySelectorAll('input[name="view"]').forEach((el) => {
    el.addEventListener("change", (ev) => {
      const t = /** @type {HTMLInputElement} */ (ev.target);
      if (t.checked) {
        ui.view = /** @type {import("./types.js").ViewMode} */ (t.value);
        render();
      }
    });
  });

  document.querySelectorAll('input[name="profile"]').forEach((el) => {
    el.addEventListener("change", (ev) => {
      const t = /** @type {HTMLInputElement} */ (ev.target);
      if (t.checked) ui.profile = /** @type {import("./types.js").Profile} */ (t.value);
    });
  });

  pinModeBox.addEventListener("change", () => {
    ui.pinMode = pinModeBox.checked;
    document.body.classList.toggle("pin-mode", ui.pinMode);
  });
}

async function main() {
  try {
    svg = await loadMap(/** @type {HTMLElement} */ ($("#map")));
    stateEls = getStateElements(svg);
    svg.addEventListener("click", (ev) => {
      onMapClick(ev).catch((err) => {
        setStatus(`That didn't work: ${err instanceof Error ? err.message : String(err)}`);
      });
    });
    wireControls();
    await refresh();
  } catch (err) {
    setStatus(`Could not start: ${err instanceof Error ? err.message : String(err)}`);
  }
}

void main();
