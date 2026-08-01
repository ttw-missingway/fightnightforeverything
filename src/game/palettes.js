// The portrait palettes, as plain data.
//
// Lives in game/ rather than next to the art loader because GENERATION picks a
// palette — every person who walks through the door gets their own — and the
// engine has to stay runnable in plain node, where import.meta.glob doesn't
// exist. components/art.js imports this list and filters it down to whatever
// is actually on disk.

export const FACE_PALETTES = [
  { key: 'gameboy', label: 'Game Boy' },
  { key: 'noir', label: 'Black & White' },
  { key: 'sepia', label: 'Sepia' },
  { key: 'anaglyph', label: 'Red & Blue' },
  { key: 'virtualboy', label: 'Virtual Boy' },
  { key: 'amber', label: 'Amber CRT' },
  { key: 'terminal', label: 'Green Terminal' },
  { key: 'synthwave', label: 'Synthwave' },
  { key: 'ice', label: 'Ice' },
  { key: 'blossom', label: 'Blossom' },
  { key: 'sunset', label: 'Sunset' },
  { key: 'grape', label: 'Grape' },
]

/**
 * THE ONLY META LAYER (REVISION §6). Prestige-as-power was deprecated in P0 —
 * a returning lineage never starts stronger — which left the game with nothing
 * to carry between runs except the record books. These are what it carries
 * instead: things to LOOK at, earned by proving something, granting no
 * advantage whatsoever. That is the whole design constraint. A palette cannot
 * win you a bracket, so it can be as rare as it likes.
 *
 * `unlock` names an achievements.js unlock key; a palette without one is
 * available from the first day.
 */
export const PALETTE_UNLOCKS = {
  synthwave: 'pal-synthwave',
  ice: 'pal-ice',
  blossom: 'pal-blossom',
  sunset: 'pal-sunset',
  grape: 'pal-grape',
  virtualboy: 'pal-virtualboy',
}

/** Palettes with no unlock gate — everything a first run can pick. */
export const isPaletteFree = (key) => !PALETTE_UNLOCKS[key]

export const PALETTE_KEYS = FACE_PALETTES.map((p) => p.key)
export const DEFAULT_PALETTE = 'gameboy'

/**
 * "Every portrait picks its own" — the default, and what makes a roster look
 * like a room full of people rather than a themed set. The Settings screen can
 * override it with a single palette for anyone who wants the uniform look.
 */
export const MIXED_PALETTE = 'mixed'

export const isPalette = (key) => PALETTE_KEYS.includes(key)
