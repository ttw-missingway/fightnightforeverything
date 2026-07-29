// Save-scoped seeded randomness (mulberry32).
//
// fight.js has carried the comment "the engine must never touch Math.random"
// since narration seeds existed; this module makes that true for the whole
// engine. Every helper in util.js (rand, randInt, choice, chance, shuffle,
// uid) draws from ONE bound stream, and the stream lives on the save —
// `save.rng = { seed, state }` — so a run replays identically from any point:
// same save, same next draw, in the browser and in the headless harness alike.
//
// mulberry32's whole state is a single uint32 that advances by a fixed
// increment per draw, which is why the stream can be stored on the save and
// resumed across sessions without replaying the draws that got it there.
//
// Binding: engine entry points (startDay, simHour, tournament runners,
// populateRoster, …) call bindRng(save) on entry. Until anything is bound —
// menu-time UI rolling portraits, fresh ids for a save that doesn't exist yet
// — draws come from an ephemeral entropy-seeded stream instead. Entropy is
// allowed ONLY when seeding a stream; it never reaches a draw directly.

const GOLDEN = 0x6d2b79f5

// One mulberry32 output for a given (already advanced) state.
function drawFrom(state) {
  let t = state
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

// Seeding a stream is the one moment randomness may come from outside.
function freshSeed() {
  return (((Date.now() & 0xffffffff) ^ ((Math.random() * 0xffffffff) | 0)) >>> 0) || 1
}

export function newRngState(seed) {
  const s = (seed ?? freshSeed()) >>> 0 || 1
  return { seed: s, state: s | 0 }
}

// The stream draws currently come from. Module-level rather than threaded
// through every call because the engine is synchronous and single-threaded:
// whoever bound last owns the draws until someone else binds.
let current = null

/**
 * Bind the save's stream (creating it on saves that predate one). Returns the
 * stream. The stream object IS save.rng, so every draw advances the save in
 * place and persists with it — no write-back step to forget.
 */
export function bindRng(save) {
  if (!save) return current
  if (!save.rng || typeof save.rng.state !== 'number') save.rng = newRngState()
  current = save.rng
  return current
}

/** Bind a bare stream (tests, or drawing outside any save on purpose). */
export function bindStream(stream) {
  current = stream
  return current
}

/** The next draw in [0, 1) from whatever is bound. */
export function nextRand() {
  if (!current) current = newRngState()
  current.state = (current.state + GOLDEN) | 0
  return drawFrom(current.state)
}
