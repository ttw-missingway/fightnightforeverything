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

export const PALETTE_KEYS = FACE_PALETTES.map((p) => p.key)
export const DEFAULT_PALETTE = 'gameboy'

/**
 * "Every portrait picks its own" — the default, and what makes a roster look
 * like a room full of people rather than a themed set. The Settings screen can
 * override it with a single palette for anyone who wants the uniform look.
 */
export const MIXED_PALETTE = 'mixed'

export const isPalette = (key) => PALETTE_KEYS.includes(key)
