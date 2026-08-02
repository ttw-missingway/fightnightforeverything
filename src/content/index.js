// THE TEXT LAYER.
//
// Every authored sentence the player reads lives in this directory as JSON,
// not scattered through the engine as template literals. The rule is simple
// and worth keeping: `src/game/*.js` decides WHEN something is said and to
// whom; `src/content/*.json` decides what the words are. A file in here can be
// rewritten start to finish without touching a line of logic, and nothing in
// here can break the simulation — the worst a bad edit does is print oddly.
//
// See README.md in this directory for the format of each file.

import chronicle from './chronicle.json' with { type: 'json' }
import guides from './guides.json' with { type: 'json' }

/**
 * Fill {braces} from a data object. A missing key renders as an ellipsis
 * rather than as "undefined" or the raw placeholder — a line with a hole in it
 * is a content bug, and it should look like a pause, not like a crash.
 */
export function fill(template, data = {}) {
  if (typeof template !== 'string') return ''
  return template.replace(/\{(\w+)\}/g, (_, k) => (data[k] != null ? String(data[k]) : '…'))
}

/**
 * Pick a variant deterministically-at-random and fill it. `pick` is passed in
 * (rather than imported) so every caller keeps using the save's bound RNG —
 * reaching for Math.random here would fork the seeded stream and break
 * determinism, which is the one thing this layer must never do.
 */
export const fillOne = (variants, data, pick) =>
  fill(Array.isArray(variants) ? pick(variants) : variants, data)

// ---------- The chronicle ----------

/**
 * One chronicle line by key. The chronicle is the room's collective memory —
 * numberless, occasional, and the only feed a non-journalled event has — so
 * every line in it is authored, keyed, and editable in chronicle.json.
 *
 * An unknown key returns the key itself in brackets rather than throwing: a
 * typo in the content file should be obvious on screen and harmless in the
 * simulation.
 */
export function line(key, data = {}) {
  const t = chronicle[key]
  if (t == null) return `[missing line: ${key}]`
  return fill(t, data)
}

/** Does this key exist? For content tooling and tests. */
export const hasLine = (key) => chronicle[key] != null

export { chronicle, guides }
