// @ts-check
// Shared shape definitions. This module has no runtime code — it exists so the
// other files can reference these types from JSDoc comments and the editor's
// TypeScript language service can check them with zero tooling installed.

/**
 * @typedef {"me" | "partner"} Profile
 */

/**
 * @typedef {"me" | "partner" | "both"} ViewMode
 */

/**
 * A labeled marker placed by clicking the map. `x` and `y` are fractions of the
 * SVG viewBox (0..1), so they survive any on-screen scaling.
 * @typedef {Object} Pin
 * @property {number} id
 * @property {Profile} profile
 * @property {number} x
 * @property {number} y
 * @property {string} label
 */

/**
 * The full state of the world, as returned by `GET /api/snapshot`.
 * @typedef {Object} Snapshot
 * @property {{ me: string, partner: string }} names
 * @property {{ me: string[], partner: string[] }} visits  Lowercase state codes.
 * @property {Pin[]} pins
 */

export {};
