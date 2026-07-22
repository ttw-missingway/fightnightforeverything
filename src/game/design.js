// Game-design content: full movelists with frame data, archetype kits,
// combo generation, and stage vibes — designing a character here should
// feel like designing a character in a real fighting game.
//
// Move shape (all frames at 60fps, damage on a ~1000-health scale):
//   { id, name, type, slot: 'normal'|'special'|'super',
//     startup, active, recovery, onBlock, damage, chip, meterCost, duration }
// duration (seconds) only matters for set up / trap / install.

import { uid, choice, sample, randInt, chance } from './util.js'

// Realistic generation ranges per move type: [startup, active, recovery,
// onBlock, damage, chip, meterCost, duration]
const FRAME_TEMPLATES = {
  'light': { startup: [4, 6], active: [2, 3], recovery: [6, 10], onBlock: [-2, 2], damage: [30, 50], chip: [0, 0], meterCost: 0, duration: 0 },
  'melee': { startup: [7, 11], active: [2, 5], recovery: [12, 18], onBlock: [-5, 0], damage: [60, 90], chip: [0, 0], meterCost: 0, duration: 0 },
  'heavy': { startup: [12, 18], active: [3, 6], recovery: [18, 28], onBlock: [-9, -2], damage: [100, 150], chip: [0, 5], meterCost: 0, duration: 0 },
  'projectile': { startup: [10, 16], active: [1, 1], recovery: [20, 32], onBlock: [-4, 3], damage: [50, 80], chip: [8, 15], meterCost: 0, duration: 0 },
  'anti-air': { startup: [4, 8], active: [4, 8], recovery: [20, 32], onBlock: [-14, -6], damage: [80, 120], chip: [0, 0], meterCost: 0, duration: 0 },
  'command grab': { startup: [5, 10], active: [2, 4], recovery: [26, 40], onBlock: [-20, -12], damage: [140, 200], chip: [0, 0], meterCost: 0, duration: 0 },
  'counter': { startup: [1, 5], active: [10, 20], recovery: [24, 34], onBlock: [-12, -6], damage: [100, 140], chip: [0, 0], meterCost: 0, duration: 0 },
  'set up': { startup: [15, 25], active: [1, 1], recovery: [18, 30], onBlock: [2, 8], damage: [0, 40], chip: [0, 5], meterCost: 0, duration: [3, 8] },
  'trap': { startup: [12, 20], active: [1, 1], recovery: [15, 25], onBlock: [-2, 4], damage: [60, 100], chip: [5, 10], meterCost: 0, duration: [4, 10] },
  'install': { startup: [5, 12], active: [1, 1], recovery: [10, 20], onBlock: [0, 0], damage: [0, 0], chip: [0, 0], meterCost: [25, 50], duration: [8, 15] },
  'movement': { startup: [1, 5], active: [1, 3], recovery: [5, 15], onBlock: [0, 0], damage: [0, 0], chip: [0, 0], meterCost: 0, duration: 0 },
  'super': { startup: [5, 12], active: [4, 10], recovery: [30, 50], onBlock: [-24, -12], damage: [250, 400], chip: [30, 60], meterCost: 100, duration: 0 },
}

const pick = (range) => Array.isArray(range) ? randInt(range[0], range[1]) : range

/**
 * Generate believable frame data for a move type. speedBias shifts startup
 * and recovery (negative = faster archetype), damageBias scales damage.
 */
export function generateMoveData(type, { speedBias = 0, damageBias = 1 } = {}) {
  const t = FRAME_TEMPLATES[type] || FRAME_TEMPLATES['melee']
  return {
    startup: Math.max(1, pick(t.startup) + speedBias),
    active: pick(t.active),
    recovery: Math.max(3, pick(t.recovery) + speedBias * 2),
    onBlock: pick(t.onBlock),
    damage: Math.round(pick(t.damage) * damageBias),
    chip: pick(t.chip),
    meterCost: pick(t.meterCost),
    duration: pick(t.duration),
  }
}

export function makeMove(name, type, opts = {}) {
  return { id: uid('move'), name, type, slot: opts.slot || (type === 'super' ? 'super' : 'special'), ...generateMoveData(type, opts) }
}

// The universal normal suite every character gets, flavored by archetype pace.
const NORMALS = [
  ['Standing Jab', 'light'],
  ['Quick Poke', 'melee'],
  ['Sweep', 'melee'],
  ['Heavy Starter', 'heavy'],
  ['Jumping Arc', 'melee'],
]

// How each archetype's body feels: startup shift and damage scale.
const ARCHETYPE_PACE = {
  'Shoto': { speedBias: 0, damageBias: 1 },
  'Grappler': { speedBias: 2, damageBias: 1.25 },
  'Zoner': { speedBias: 1, damageBias: 0.9 },
  'Rushdown': { speedBias: -2, damageBias: 0.85 },
  'Charge': { speedBias: 1, damageBias: 1.1 },
  'Puppet': { speedBias: 0, damageBias: 0.8 },
  'Setplay': { speedBias: 0, damageBias: 0.9 },
  'Footsies': { speedBias: -1, damageBias: 1 },
  'Mix-up': { speedBias: -1, damageBias: 0.9 },
  'Glass Cannon': { speedBias: -1, damageBias: 1.35 },
  'All-Rounder': { speedBias: 0, damageBias: 1 },
  'Big Body': { speedBias: 3, damageBias: 1.3 },
}

// Themed move-name pools per type, for the per-type 🎲 buttons.
export const MOVE_NAMES_BY_TYPE = {
  'projectile': ['Ki Bolt', 'Sonic Edge', 'Vermilion Wave', 'Null Sphere', 'Ash Cloud', 'Piercing Howl'],
  'melee': ['Spiral Knuckle', 'Rift Palm', 'Twin Viper', 'Iron Verse', 'Crescent Hook', 'Gut Check'],
  'light': ['Needle Flurry', 'Quicksilver Jab', 'Triple Sting', 'Paper Cut', 'Static Peck'],
  'heavy': ['Mountain Cleaver', 'Widow Maker', 'Seismic Slam', 'Judgment Drop', 'Anvil Song'],
  'set up': ['Spider Lattice', "Dead Man's Corner", 'Puppet Strings', 'Chessboard', 'Rain Check'],
  'trap': ['Bear Cage', 'Landmine Waltz', 'Venus Snare', 'Glass Garden', 'Tripwire Tango'],
  'anti-air': ['Sky Piercer', 'Heaven Denial', 'Meteor Catch', 'No Fly Zone', 'Zenith Cutter'],
  'command grab': ['Gravedigger', 'Orbital Hug', 'Debt Collector', 'Last Dance', 'Cyclone Suplex'],
  'counter': ['Mirror Debt', 'Receipt', 'Polite Refusal', 'Echo Parry', 'Grudge Keeper'],
  'install': ['Limit Break', 'Second Sunrise', 'Bloodline Awakening', 'Overclock', 'Eclipse Mode'],
  'movement': ['Ghost Step', 'Vapor Trail', 'Blink Cancel', 'Moonwalk', 'Rift Skip'],
  'super': ['Grand Finale', 'Thousand Cranes', 'Apocalypse Bloom', 'Curtain Call', 'Big Bang Encore'],
}

export function generateMoveNameForType(type) {
  return choice(MOVE_NAMES_BY_TYPE[type] || MOVE_NAMES_BY_TYPE['melee'])
}

// Archetype kits: fantasy, stat ranges, tags, and the SPECIAL move loadout
// (normals + a super come from the universal suite).
export const ARCHETYPE_KITS = {
  'Shoto': {
    blurb: 'The measuring stick. Fireball, anti-air, honest buttons — wins with fundamentals.',
    difficulty: [3, 5], popularity: [6, 9], tags: ['honest', 'classic'],
    specials: [['Ki Bolt', 'projectile'], ['Zenith Cutter', 'anti-air'], ['Spiral Knuckle', 'melee']],
    super: ['Grand Finale', 'super'],
  },
  'Grappler': {
    blurb: 'One touch, one health bar. Slow walk forward, terrifying once close.',
    difficulty: [4, 7], popularity: [3, 6], tags: ['big damage', 'monster'],
    specials: [['Gravedigger', 'command grab'], ['Anvil Song', 'heavy'], ['Bear Cage', 'trap']],
    super: ['Cyclone Suplex', 'super'],
  },
  'Zoner': {
    blurb: 'The screen belongs to them. Death by a thousand chip points.',
    difficulty: [5, 8], popularity: [2, 5], tags: ['cheap', 'technical'],
    specials: [['Vermilion Wave', 'projectile'], ['Ash Cloud', 'projectile'], ['Tripwire Tango', 'trap'], ['No Fly Zone', 'anti-air']],
    super: ['Thousand Cranes', 'super'],
  },
  'Rushdown': {
    blurb: 'Never blocks, never breathes. The opponent plays defense until they lose.',
    difficulty: [4, 7], popularity: [6, 9], tags: ['flashy', 'cool'],
    specials: [['Vapor Trail', 'movement'], ['Twin Viper', 'melee'], ['Triple Sting', 'light']],
    super: ['Curtain Call', 'super'],
  },
  'Charge': {
    blurb: 'Patience as a weapon. Holds back, then punishes everything at once.',
    difficulty: [4, 6], popularity: [3, 6], tags: ['classic', 'honest'],
    specials: [['Sonic Edge', 'projectile'], ['Sky Piercer', 'anti-air'], ['Seismic Slam', 'heavy']],
    super: ['Big Bang Encore', 'super'],
  },
  'Puppet': {
    blurb: 'Two characters, one health bar, endless nightmares for both players.',
    difficulty: [8, 10], popularity: [3, 6], tags: ['technical', 'anime'],
    specials: [['Puppet Strings', 'set up'], ['Spider Lattice', 'set up'], ['Blink Cancel', 'movement']],
    super: ['Apocalypse Bloom', 'super'],
  },
  'Setplay': {
    blurb: 'One knockdown starts the blender. Escape rooms sold separately.',
    difficulty: [6, 9], popularity: [4, 7], tags: ['cheap', 'technical'],
    specials: [["Dead Man's Corner", 'set up'], ['Venus Snare', 'trap'], ['Eclipse Mode', 'install']],
    super: ['Grand Finale', 'super'],
  },
  'Footsies': {
    blurb: 'Wins the fight an inch at a time. Every whiffed button is a funeral.',
    difficulty: [5, 8], popularity: [4, 7], tags: ['honest', 'classic'],
    specials: [['Receipt', 'counter'], ['Ghost Step', 'movement'], ['Crescent Hook', 'melee']],
    super: ['Judgment Drop', 'super'],
  },
  'Mix-up': {
    blurb: 'Left, right, low, grab — a coin flip where they own the coin.',
    difficulty: [5, 8], popularity: [5, 8], tags: ['flashy', 'creepy'],
    specials: [['Moonwalk', 'movement'], ['Debt Collector', 'command grab'], ['Glass Garden', 'trap']],
    super: ['Curtain Call', 'super'],
  },
  'Glass Cannon': {
    blurb: 'Melts health bars and folds like paper. Every round is a heart attack.',
    difficulty: [6, 9], popularity: [5, 8], tags: ['big damage', 'anime'],
    specials: [['Bloodline Awakening', 'install'], ['Widow Maker', 'heavy'], ['Rift Skip', 'movement']],
    super: ['Apocalypse Bloom', 'super'],
  },
  'All-Rounder': {
    blurb: 'A tool for everything, a weakness nowhere, a personality optional.',
    difficulty: [2, 4], popularity: [5, 8], tags: ['honest'],
    specials: [['Ki Bolt', 'projectile'], ['Meteor Catch', 'anti-air'], ['Echo Parry', 'counter']],
    super: ['Grand Finale', 'super'],
  },
  'Big Body': {
    blurb: 'Covers half the screen just by standing there. Armor through it and smile.',
    difficulty: [3, 6], popularity: [3, 6], tags: ['monster', 'big damage'],
    specials: [['Mountain Cleaver', 'heavy'], ['Orbital Hug', 'command grab'], ['Heaven Denial', 'anti-air']],
    super: ['Last Dance', 'super'],
  },
}

// The comprehensive movelist: universal normals + kit specials + a super,
// all with archetype-paced frame data.
export function buildMovelist(archetype) {
  const pace = ARCHETYPE_PACE[archetype] || ARCHETYPE_PACE['All-Rounder']
  const kit = ARCHETYPE_KITS[archetype] || ARCHETYPE_KITS['All-Rounder']
  const moves = NORMALS.map(([name, type]) => makeMove(name, type, { ...pace, slot: 'normal' }))
  for (const [name, type] of kit.specials) moves.push(makeMove(name, type, pace))
  moves.push(makeMove(kit.super[0], 'super', pace))
  return moves
}

// ---------- Combos ----------

const COMBO_NAMES = {
  a: ['Bread and Butter', 'Corner Carry', 'Meter Dump', 'Touch of Death', 'The Standard',
    'Dizzy Loop', 'Wall Splat Special', 'Highway Robbery', 'Checkmate', 'The Vortex',
    'Full Course', 'Taxes', 'The Blender', 'Curtains'],
}

// Damage scaling per combo hit: later hits count less, like a real fighter.
const COMBO_SCALING = [1, 0.8, 0.65, 0.5, 0.4, 0.3]

export function comboDamage(char, combo) {
  const moves = combo.moveIds
    .map((id) => (char.moves || []).find((m) => m.id === id))
    .filter(Boolean)
  return Math.round(moves.reduce((s, m, i) => s + (m.damage || 0) * (COMBO_SCALING[i] ?? 0.25), 0))
}

export function comboRoute(char, combo) {
  return combo.moveIds
    .map((id) => (char.moves || []).find((m) => m.id === id)?.name)
    .filter(Boolean)
    .join(' ▸ ')
}

/**
 * Generate a plausible route: starter (light/melee) into damage, optionally
 * ending in the super. Named from the pool.
 */
export function generateCombo(char, existingNames = []) {
  const mv = char.moves || []
  if (mv.length < 3) return null
  const starters = mv.filter((m) => ['light', 'melee'].includes(m.type) && (m.startup ?? 9) <= 10)
  const mids = mv.filter((m) => ['melee', 'heavy', 'projectile', 'anti-air'].includes(m.type))
  const enders = mv.filter((m) => ['heavy', 'super', 'command grab', 'anti-air'].includes(m.type))
  const route = []
  route.push(starters.length ? choice(starters) : choice(mv))
  const midPicks = sample(mids.filter((m) => !route.includes(m)), randInt(1, 2))
  route.push(...midPicks)
  const ender = enders.filter((m) => !route.includes(m))
  if (ender.length && chance(0.8)) route.push(choice(ender))
  if (route.length < 3) return null
  const free = COMBO_NAMES.a.filter((n) => !existingNames.includes(n))
  return {
    id: uid('combo'),
    name: free.length ? choice(free) : `${choice(COMBO_NAMES.a)} II`,
    moveIds: route.map((m) => m.id),
  }
}

// Apply a kit to a character: stats in range, FULL movelist, starter combos.
export function applyArchetypeKit(char, archetype, gameTags = []) {
  const kit = ARCHETYPE_KITS[archetype]
  if (!kit) return
  char.archetype = archetype
  char.difficulty = randInt(kit.difficulty[0], kit.difficulty[1])
  char.popularity = randInt(kit.popularity[0], kit.popularity[1])
  if (!char.description) char.description = kit.blurb
  char.moves = buildMovelist(archetype)
  char.combos = []
  for (let i = 0; i < 2; i++) {
    const c = generateCombo(char, char.combos.map((x) => x.name))
    if (c) char.combos.push(c)
  }
  const applicable = kit.tags.filter((t) => gameTags.includes(t))
  if (applicable.length) char.tags = [...new Set([...(char.tags || []), ...applicable])]
}

// Backfill frame data onto a legacy move that predates the overhaul.
export function migrateMove(move) {
  if (move.startup != null) return move
  return { ...move, slot: move.slot || (move.type === 'super' ? 'super' : 'special'), ...generateMoveData(move.type) }
}

export const STAGE_VIBES = ['hype', 'serene', 'ominous', 'industrial', 'festival', 'desolate']
