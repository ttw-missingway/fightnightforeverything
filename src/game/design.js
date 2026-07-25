// Game-design content: full movelists, archetype kits, combo generation, and
// stage vibes — designing a character here should feel like designing a
// character in a real fighting game.
//
// MOVES ARE DESCRIBED, NOT NUMBERED (the 2026-07-25 descriptor overhaul).
// The authored surface is `move.d` — a set of plain-language choices:
//
//   d: { form, damage, chip, startup, recovery, onBlock, guard, cost,
//        duration, effects: [{ trigger, effect }] }
//
// Frame data and damage are DERIVED from those choices by `resolveMove` and
// materialised back onto the move as the same `startup/damage/onBlock/...`
// fields everything downstream already reads. So balance.js, fight.js and
// patch.js need no rewriting — the numbers simply stop being hand-written.
// Never hand-edit the numeric fields: change `d` and re-resolve, or they
// drift out of sync with what the character actually says it is.
//
// Move shape (frames at 60fps, damage on a ~1000-health scale):
//   { id, name, type, slot: 'normal'|'special'|'super', d,
//     startup, active, recovery, onBlock, damage, chip, meterCost, duration }
// duration (seconds) only matters for set up / trap / install.

import { uid, choice, randInt, chance } from './util.js'
import { comboScalingOf } from './rules.js'

// ---------- The authored vocabulary ----------
// Ordered weakest → strongest, because generation and patching both walk
// these lists by index.

export const DAMAGE_TIERS = ['none', 'light', 'normal', 'heavy', 'huge']
export const CHIP_TIERS = ['none', 'light', 'normal', 'big']
export const SPEED_TIERS = ['instant', 'fast', 'average', 'slow', 'very slow']
export const BLOCK_TIERS = ['very punishable', 'punishable', 'minus', 'even', 'plus', 'plus-big']
export const COST_TIERS = ['none', 'light', 'half bar', 'full bar']
// How it has to be blocked. The high/low guessing game is the engine of
// fighting-game offence: an overhead beats crouching block, a low beats
// standing block, and owning a fast one of each is what a mix-up character IS.
export const GUARD_TIERS = ['overhead', 'mid', 'low', 'unblockable']
// How far the hitbox actually goes. Reach is the other half of footsies: a
// long, safe poke controls the ground without ever touching anyone, and a
// point-blank button means you have to earn your way in first.
export const REACH_TIERS = ['point-blank', 'short', 'normal', 'long', 'full-screen']
export const DURATION_TIERS = ['none', 'brief', 'normal', 'long']

// Damage and chip are RELATIVE to what the move kind is for: a super with
// "normal" damage still hits far harder than a jab with "huge".
const DAMAGE_MULT = { none: 0, light: 0.65, normal: 1, heavy: 1.4, huge: 1.85 }
const CHIP_MULT = { none: 0, light: 0.5, normal: 1, big: 1.8 }
// Frames are universal, so these are absolute.
const STARTUP_F = { instant: 4, fast: 7, average: 11, slow: 16, 'very slow': 22 }
const RECOVERY_F = { instant: 6, fast: 11, average: 18, slow: 26, 'very slow': 36 }
const BLOCK_F = { 'plus-big': 6, plus: 2, even: 0, minus: -4, punishable: -10, 'very punishable': -18 }
const COST_F = { none: 0, light: 25, 'half bar': 50, 'full bar': 100 }
const DURATION_S = { none: 0, brief: 3, normal: 6, long: 11 }
// Expressed as a 0-100 slice of the screen.
const REACH_F = { 'point-blank': 10, short: 30, normal: 50, long: 72, 'full-screen': 100 }

// What each kind of move is worth before its descriptors modify it, and the
// pace it naturally comes out at. The startup/recovery defaults matter as
// much as the damage: without them every move sits at 'average' and a jab
// stops being a jab.
const KIND_BASE = {
  'light': { damage: 42, chip: 0, active: 2, startup: 'instant', recovery: 'instant', guard: 'mid', reach: 'short' },
  'melee': { damage: 75, chip: 0, active: 3, startup: 'fast', recovery: 'average', guard: 'mid', reach: 'normal' },
  'heavy': { damage: 125, chip: 3, active: 4, startup: 'slow', recovery: 'slow', guard: 'mid', reach: 'long' },
  'projectile': { damage: 65, chip: 11, active: 1, startup: 'average', recovery: 'slow', guard: 'mid', reach: 'full-screen' },
  'anti-air': { damage: 100, chip: 0, active: 6, startup: 'fast', recovery: 'slow', guard: 'mid', reach: 'short' },
  'command grab': { damage: 170, chip: 0, active: 3, startup: 'fast', recovery: 'very slow', guard: 'unblockable', reach: 'point-blank' },
  'counter': { damage: 120, chip: 0, active: 14, startup: 'instant', recovery: 'slow', guard: 'mid', reach: 'short' },
  'set up': { damage: 20, chip: 3, active: 1, startup: 'slow', recovery: 'slow', guard: 'mid', reach: 'normal' },
  'trap': { damage: 80, chip: 8, active: 1, startup: 'slow', recovery: 'average', guard: 'mid', reach: 'normal' },
  'install': { damage: 0, chip: 0, active: 1, startup: 'fast', recovery: 'average', guard: 'mid', reach: 'point-blank' },
  'movement': { damage: 0, chip: 0, active: 2, startup: 'instant', recovery: 'fast', guard: 'mid', reach: 'normal' },
  'super': { damage: 320, chip: 45, active: 7, startup: 'fast', recovery: 'very slow', guard: 'mid', reach: 'normal' },
}

/**
 * The shape a move of each kind can take. Pure flavour for the sim's maths,
 * but it's what the narration and the VFX read, so a burrowing projectile
 * and a beam never describe themselves the same way.
 */
export const MOVE_FORMS = {
  'projectile': ['fireball', 'arcing lob', 'rolling', 'burrowing', 'beam', 'boomerang', 'homing', 'multi-hit'],
  'melee': ['straight', 'hooking', 'spinning', 'lunging', 'rekka'],
  'light': ['jab', 'poke', 'flurry', 'stiff-arm'],
  'heavy': ['overhead smash', 'wind-up swing', 'body check', 'ground pound'],
  'anti-air': ['rising uppercut', 'flip kick', 'shoulder charge', 'air throw'],
  'command grab': ['spinning piledriver', 'chokeslam', 'run-up snatch', 'air grab', 'basic throw'],
  'counter': ['parry', 'armour absorb', 'reversal throw', 'reflect'],
  'set up': ['minion summon', 'ground rune', 'lingering orb', 'clone'],
  'trap': ['bear trap', 'landmine', 'tripwire', 'delayed bomb', 'web'],
  'install': ['power aura', 'weapon draw', 'transformation', 'stance change'],
  'movement': ['dash', 'teleport', 'air dash', 'roll', 'wall jump'],
  'super': ['cinematic grab', 'screen-filling beam', 'rushdown barrage', 'unblockable slam'],
}

export const EFFECT_TRIGGERS = ['on activate', 'on contact', 'on block', 'on whiff', 'after a duration']
export const EFFECT_KINDS = [
  'explode', 'stun the opponent', 'steal meter', 'launch into the air', 'wall bounce',
  'break armour', 'drain health', 'teleport behind them', 'summon a minion', 'poison',
  'freeze them in place', 'hard knockdown', 'build extra meter', 'become invincible',
]

// An effect clause is real power, so it feeds the derived numbers a little.
const EFFECT_POWER = 0.06

export function defaultDescriptors(type) {
  const forms = MOVE_FORMS[type] || MOVE_FORMS['melee']
  return {
    form: forms[0],
    damage: KIND_BASE[type]?.damage ? 'normal' : 'none',
    chip: KIND_BASE[type]?.chip ? 'normal' : 'none',
    startup: KIND_BASE[type]?.startup ?? 'average',
    recovery: KIND_BASE[type]?.recovery ?? 'average',
    guard: KIND_BASE[type]?.guard ?? 'mid',
    reach: KIND_BASE[type]?.reach ?? 'normal',
    onBlock: 'minus',
    cost: type === 'super' ? 'full bar' : 'none',
    duration: ['set up', 'trap', 'install'].includes(type) ? 'normal' : 'none',
    effects: [],
  }
}

/**
 * Turn the authored description into the numbers the engine runs on. This is
 * the single source of truth for what a move actually does.
 */
export function resolveMove(move) {
  const type = move.type
  const base = KIND_BASE[type] || KIND_BASE['melee']
  const d = { ...defaultDescriptors(type), ...(move.d || {}) }
  const effectBoost = 1 + (d.effects?.length || 0) * EFFECT_POWER
  return {
    startup: STARTUP_F[d.startup] ?? 11,
    active: base.active,
    recovery: RECOVERY_F[d.recovery] ?? 18,
    onBlock: BLOCK_F[d.onBlock] ?? -4,
    damage: Math.round(base.damage * (DAMAGE_MULT[d.damage] ?? 1) * effectBoost),
    chip: Math.round(base.chip * (CHIP_MULT[d.chip] ?? 1)),
    meterCost: COST_F[d.cost] ?? 0,
    duration: DURATION_S[d.duration] ?? 0,
    range: REACH_F[d.reach] ?? 50,
  }
}

/** Write the derived numbers onto a move. Call after ANY change to `d`. */
export function applyMoveDescriptors(move) {
  move.d = { ...defaultDescriptors(move.type), ...(move.d || {}) }
  Object.assign(move, resolveMove(move))
  return move
}

// Nearest key in a value table — how legacy numbers find their tier.
function nearestKey(table, value) {
  let best = null
  let bestGap = Infinity
  for (const [k, v] of Object.entries(table)) {
    const gap = Math.abs(v - value)
    if (gap < bestGap) { bestGap = gap; best = k }
  }
  return best
}

/**
 * The inverse: bucket a hand-numbered legacy move into the nearest
 * descriptors, so saves made before the overhaul come across intact.
 */
export function describeMove(move) {
  const type = move.type
  const base = KIND_BASE[type] || KIND_BASE['melee']
  const forms = MOVE_FORMS[type] || MOVE_FORMS['melee']
  return {
    form: forms[0],
    damage: base.damage ? nearestKey(DAMAGE_MULT, (move.damage ?? base.damage) / base.damage) : 'none',
    chip: base.chip ? nearestKey(CHIP_MULT, (move.chip ?? 0) / base.chip) : (move.chip ? 'normal' : 'none'),
    startup: nearestKey(STARTUP_F, move.startup ?? 11),
    recovery: nearestKey(RECOVERY_F, move.recovery ?? 18),
    onBlock: nearestKey(BLOCK_F, move.onBlock ?? -4),
    cost: nearestKey(COST_F, move.meterCost ?? 0),
    duration: nearestKey(DURATION_S, move.duration ?? 0),
    guard: KIND_BASE[type]?.guard ?? 'mid',
    reach: KIND_BASE[type]?.reach ?? 'normal',
    effects: [],
  }
}

// ---------- Character body: how much punishment, and how big a target ----------

export const VITALITY_TIERS = ['glass', 'light', 'normal', 'heavy', 'tank']
export const SIZE_TIERS = ['tiny', 'small', 'normal', 'big', 'boss']

const VITALITY_MULT = { glass: 0.76, light: 0.88, normal: 1, heavy: 1.14, tank: 1.3 }
// Bigger bodies eat longer combos and move worse; small ones are slippery.
const SIZE_MOD = {
  tiny: { comboEase: -0.14, mobility: 14, grab: -0.18 },
  small: { comboEase: -0.07, mobility: 7, grab: -0.08 },
  normal: { comboEase: 0, mobility: 0, grab: 0 },
  big: { comboEase: 0.08, mobility: -8, grab: 0.1 },
  boss: { comboEase: 0.16, mobility: -16, grab: 0.2 },
}

/** How much of a standard health bar this character carries. */
export function healthMultOf(char) {
  return VITALITY_MULT[char?.vitality] ?? 1
}

export function sizeModOf(char) {
  return SIZE_MOD[char?.size] ?? SIZE_MOD.normal
}

// ---------- Generation ----------

// Shift a tier by n steps along its ordered list, clamped at the ends.
function shiftTier(list, tier, n) {
  const i = list.indexOf(tier)
  if (i < 0) return tier
  return list[Math.max(0, Math.min(list.length - 1, i + n))]
}

/**
 * Damage shifts get their own helper because 'none' is a DELIBERATE choice —
 * it's what movement and install moves are — not somewhere a move that hurts
 * should ever slide into. Without this floor a single light nerf takes a jab
 * from 29 damage to 0, and generation can roll a 0-damage super.
 */
function shiftDamage(tier, n, kindDealsDamage) {
  if (!kindDealsDamage) return shiftTier(DAMAGE_TIERS, tier, n)
  const scale = DAMAGE_TIERS.slice(1) // light..huge — never 'none'
  return shiftTier(scale, tier === 'none' ? 'light' : tier, n)
}

/**
 * Roll a believable description for a move of this type. speedBias shifts
 * the frame tiers (negative = a faster archetype), damageBias the damage tier.
 */
export function generateDescriptors(type, { speedBias = 0, damageBias = 1 } = {}) {
  const d = defaultDescriptors(type)
  const forms = MOVE_FORMS[type] || MOVE_FORMS['melee']
  d.form = choice(forms)
  // Bias converted to whole tier steps, with a little natural variance.
  const frameStep = Math.round(speedBias / 2) + (chance(0.25) ? (chance(0.5) ? 1 : -1) : 0)
  const dmgStep = Math.round((damageBias - 1) * 3) + (chance(0.25) ? (chance(0.5) ? 1 : -1) : 0)
  d.damage = shiftDamage(d.damage, dmgStep, !!KIND_BASE[type]?.damage)
  d.startup = shiftTier(SPEED_TIERS, d.startup, frameStep)
  d.recovery = shiftTier(SPEED_TIERS, d.recovery, frameStep + (chance(0.3) ? 1 : 0))
  // Safety on block roughly tracks how committal the move is.
  const commit = { 'command grab': -2, 'super': -2, 'anti-air': -2, heavy: -1, 'set up': 1, trap: 1, light: 1 }[type] ?? 0
  d.onBlock = shiftTier(BLOCK_TIERS, 'minus', commit + (chance(0.4) ? (chance(0.5) ? 1 : -1) : 0))
  // Strikes occasionally come out as a real overhead or low; everything else
  // stays on its kind's default (a fireball is not an overhead).
  if (['melee', 'heavy', 'light'].includes(type) && chance(0.35)) {
    d.guard = chance(0.5) ? 'overhead' : 'low'
  }
  // Reach drifts a notch either way — that's the difference between a poke
  // character and someone who has to work their way in. Only a projectile may
  // sit at full-screen; a melee swing that crosses the stage is nonsense.
  if (chance(0.4)) {
    const drifted = shiftTier(REACH_TIERS, d.reach, chance(0.5) ? 1 : -1)
    d.reach = (drifted === 'full-screen' && type !== 'projectile') ? 'long' : drifted
  }
  if (['set up', 'trap', 'install'].includes(type)) d.duration = choice(['brief', 'normal', 'long'])
  if (type === 'install') d.cost = choice(['light', 'half bar'])
  // A minority of moves carry a rider — that's what makes a kit memorable.
  if (chance(type === 'trap' || type === 'set up' ? 0.75 : 0.28)) {
    d.effects = [{ trigger: choice(EFFECT_TRIGGERS), effect: choice(EFFECT_KINDS) }]
  }
  return d
}

/** Legacy shim: the numeric block for a freshly described move. */
export function generateMoveData(type, opts = {}) {
  const d = generateDescriptors(type, opts)
  return { d, ...resolveMove({ type, d }) }
}

export function makeMove(name, type, opts = {}) {
  return { id: uid('move'), name, type, slot: opts.slot || (type === 'super' ? 'super' : 'special'), ...generateMoveData(type, opts) }
}

// The universal normal suite every character gets, flavored by archetype pace.
// The universal suite every character carries, and the roles they play: a
// fast check, a neutral button, a low, a big button, an overhead, and a throw.
// That's a complete high/low/throw guessing game before a single special.
const NORMALS = [
  ['Standing Jab', 'light', 'mid'],
  ['Quick Poke', 'melee', 'mid'],
  ['Sweep', 'melee', 'low'],
  ['Heavy Starter', 'heavy', 'mid'],
  ['Jumping Arc', 'melee', 'overhead'],
  ['Throw', 'command grab', 'unblockable'],
]

// The throw is universal and deliberately weak — it exists to beat block, not
// to win rounds, and it's what the `throwTech` rule acts on.
const THROW_D = { damage: 'light', reach: 'point-blank', startup: 'fast', recovery: 'average', form: 'basic throw' }

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
  'Weapon Master': { speedBias: 1, damageBias: 1.05 },
  'Aerial': { speedBias: -1, damageBias: 0.9 },
  'Stance Switch': { speedBias: 0, damageBias: 1 },
  'Counter-Puncher': { speedBias: 0, damageBias: 1.15 },
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

// Archetype kits: fantasy, stat ranges, tags, and the loadout. Every special
// is now DESCRIBED, not just typed — the descriptors are what make a Zoner
// feel like a Zoner, so each one is authored rather than rolled. `normals`
// biases the universal suite (a Weapon Master's buttons all reach; a
// Grappler's do not).
export const ARCHETYPE_KITS = {
  'Shoto': {
    blurb: 'The measuring stick. Fireball, anti-air, honest buttons — wins with fundamentals.',
    difficulty: [3, 5], popularity: [6, 9], tags: ['honest', 'classic'],
    specials: [
      ['Ki Bolt', 'projectile', { form: 'fireball', damage: 'normal', chip: 'normal', reach: 'full-screen', startup: 'average', recovery: 'average', onBlock: 'minus' }],
      ['Zenith Cutter', 'anti-air', { form: 'rising uppercut', damage: 'heavy', startup: 'instant', recovery: 'very slow', onBlock: 'very punishable', effects: [{ trigger: 'on contact', effect: 'launch into the air' }] }],
      ['Spiral Knuckle', 'melee', { form: 'lunging', damage: 'normal', reach: 'long', startup: 'average', recovery: 'slow', onBlock: 'punishable' }],
      ['Step Feint', 'movement', { form: 'dash', startup: 'instant', recovery: 'fast' }],
    ],
    super: ['Grand Finale', 'super', { form: 'rushdown barrage', damage: 'heavy', reach: 'normal' }],
  },
  'Grappler': {
    blurb: 'One touch, one health bar. Slow walk forward, terrifying once close.',
    difficulty: [4, 7], popularity: [3, 6], tags: ['big damage', 'monster'],
    normals: { reach: 'short' },
    specials: [
      ['Gravedigger', 'command grab', { form: 'spinning piledriver', damage: 'huge', reach: 'point-blank', startup: 'fast', recovery: 'very slow', effects: [{ trigger: 'on contact', effect: 'hard knockdown' }] }],
      ['Anvil Song', 'heavy', { form: 'body check', damage: 'heavy', reach: 'short', startup: 'slow', recovery: 'slow', onBlock: 'minus', effects: [{ trigger: 'on activate', effect: 'break armour' }] }],
      ['Bear Cage', 'trap', { form: 'bear trap', damage: 'normal', duration: 'long', startup: 'slow', onBlock: 'even' }],
      ['Iron Advance', 'movement', { form: 'roll', startup: 'fast', recovery: 'average' }],
    ],
    super: ['Cyclone Suplex', 'super', { form: 'cinematic grab', damage: 'huge', reach: 'point-blank', chip: 'none' }],
  },
  'Zoner': {
    blurb: 'The screen belongs to them. Death by a thousand chip points.',
    difficulty: [5, 8], popularity: [2, 5], tags: ['cheap', 'technical'],
    specials: [
      ['Vermilion Wave', 'projectile', { form: 'beam', damage: 'normal', chip: 'big', reach: 'full-screen', startup: 'slow', recovery: 'slow', onBlock: 'even' }],
      ['Ash Cloud', 'projectile', { form: 'arcing lob', damage: 'light', chip: 'normal', reach: 'full-screen', startup: 'average', recovery: 'average', onBlock: 'plus' }],
      ['Tripwire Tango', 'trap', { form: 'tripwire', damage: 'light', duration: 'long', onBlock: 'plus', effects: [{ trigger: 'on contact', effect: 'freeze them in place' }] }],
      ['No Fly Zone', 'anti-air', { form: 'flip kick', damage: 'normal', reach: 'normal', startup: 'fast', recovery: 'slow', onBlock: 'punishable' }],
    ],
    super: ['Thousand Cranes', 'super', { form: 'screen-filling beam', damage: 'normal', chip: 'big', reach: 'full-screen' }],
  },
  'Rushdown': {
    blurb: 'Never blocks, never breathes. The opponent plays defense until they lose.',
    difficulty: [4, 7], popularity: [6, 9], tags: ['flashy', 'cool'],
    normals: { reach: 'short' },
    specials: [
      ['Vapor Trail', 'movement', { form: 'air dash', startup: 'instant', recovery: 'instant' }],
      ['Twin Viper', 'melee', { form: 'rekka', damage: 'normal', reach: 'normal', startup: 'fast', recovery: 'fast', onBlock: 'plus' }],
      ['Triple Sting', 'light', { form: 'flurry', damage: 'light', reach: 'short', startup: 'instant', recovery: 'fast', onBlock: 'plus' }],
      ['Skyfall Heel', 'heavy', { form: 'ground pound', damage: 'normal', guard: 'overhead', reach: 'short', startup: 'average', recovery: 'average', onBlock: 'minus' }],
    ],
    super: ['Curtain Call', 'super', { form: 'rushdown barrage', damage: 'normal', reach: 'short' }],
  },
  'Charge': {
    blurb: 'Patience as a weapon. Holds back, then punishes everything at once.',
    difficulty: [4, 6], popularity: [3, 6], tags: ['classic', 'honest'],
    specials: [
      ['Sonic Edge', 'projectile', { form: 'rolling', damage: 'normal', chip: 'normal', reach: 'full-screen', startup: 'average', recovery: 'fast', onBlock: 'plus' }],
      ['Sky Piercer', 'anti-air', { form: 'rising uppercut', damage: 'heavy', startup: 'instant', recovery: 'very slow', onBlock: 'very punishable' }],
      ['Seismic Slam', 'heavy', { form: 'wind-up swing', damage: 'heavy', reach: 'long', startup: 'very slow', recovery: 'slow', onBlock: 'punishable', effects: [{ trigger: 'on contact', effect: 'wall bounce' }] }],
      ['Bulwark', 'counter', { form: 'armour absorb', damage: 'normal', startup: 'instant', recovery: 'slow' }],
    ],
    super: ['Big Bang Encore', 'super', { form: 'screen-filling beam', damage: 'heavy', reach: 'long' }],
  },
  'Puppet': {
    blurb: 'Two characters, one health bar, endless nightmares for both players.',
    difficulty: [8, 10], popularity: [3, 6], tags: ['technical', 'anime'],
    specials: [
      ['Puppet Strings', 'set up', { form: 'minion summon', damage: 'light', duration: 'long', startup: 'slow', onBlock: 'plus', effects: [{ trigger: 'after a duration', effect: 'summon a minion' }] }],
      ['Spider Lattice', 'set up', { form: 'lingering orb', damage: 'light', duration: 'normal', onBlock: 'plus-big' }],
      ['Blink Cancel', 'movement', { form: 'teleport', startup: 'instant', recovery: 'average' }],
      ['Marionette Snap', 'melee', { form: 'spinning', damage: 'normal', reach: 'long', startup: 'average', recovery: 'average', onBlock: 'minus' }],
    ],
    super: ['Apocalypse Bloom', 'super', { form: 'screen-filling beam', damage: 'normal', reach: 'long' }],
  },
  'Setplay': {
    blurb: 'One knockdown starts the blender. Escape rooms sold separately.',
    difficulty: [6, 9], popularity: [4, 7], tags: ['cheap', 'technical'],
    specials: [
      ["Dead Man's Corner", 'set up', { form: 'ground rune', damage: 'light', duration: 'normal', onBlock: 'even', effects: [{ trigger: 'after a duration', effect: 'explode' }] }],
      ['Venus Snare', 'trap', { form: 'delayed bomb', damage: 'normal', duration: 'normal', onBlock: 'even', effects: [{ trigger: 'on contact', effect: 'hard knockdown' }] }],
      ['Eclipse Mode', 'install', { form: 'stance change', cost: 'half bar', duration: 'long', startup: 'fast' }],
      ['Grave Marker', 'melee', { form: 'straight', damage: 'normal', guard: 'low', reach: 'normal', startup: 'fast', recovery: 'average', onBlock: 'even' }],
    ],
    super: ['Grand Finale', 'super', { form: 'unblockable slam', damage: 'heavy', reach: 'short' }],
  },
  'Footsies': {
    blurb: 'Wins the fight an inch at a time. Every whiffed button is a funeral.',
    difficulty: [5, 8], popularity: [4, 7], tags: ['honest', 'classic'],
    normals: { reach: 'long' },
    specials: [
      ['Receipt', 'counter', { form: 'parry', damage: 'heavy', startup: 'instant', recovery: 'average' }],
      ['Ghost Step', 'movement', { form: 'dash', startup: 'instant', recovery: 'instant' }],
      ['Crescent Hook', 'melee', { form: 'hooking', damage: 'normal', reach: 'long', startup: 'fast', recovery: 'average', onBlock: 'even' }],
      ['Low Cut', 'melee', { form: 'straight', damage: 'normal', guard: 'low', reach: 'long', startup: 'fast', recovery: 'average', onBlock: 'minus' }],
    ],
    super: ['Judgment Drop', 'super', { form: 'cinematic grab', damage: 'heavy', reach: 'long' }],
  },
  'Mix-up': {
    blurb: 'Left, right, low, grab — a coin flip where they own the coin.',
    difficulty: [5, 8], popularity: [5, 8], tags: ['flashy', 'creepy'],
    specials: [
      ['Moonwalk', 'movement', { form: 'teleport', startup: 'instant', recovery: 'fast' }],
      ['Debt Collector', 'command grab', { form: 'run-up snatch', damage: 'heavy', reach: 'short', startup: 'fast', recovery: 'slow' }],
      ['Glass Garden', 'trap', { form: 'web', damage: 'light', duration: 'normal', onBlock: 'plus' }],
      ['False Step', 'melee', { form: 'lunging', damage: 'normal', guard: 'overhead', reach: 'normal', startup: 'fast', recovery: 'average', onBlock: 'even' }],
    ],
    super: ['Curtain Call', 'super', { form: 'unblockable slam', damage: 'heavy', reach: 'short' }],
  },
  'Glass Cannon': {
    blurb: 'Melts health bars and folds like paper. Every round is a heart attack.',
    difficulty: [6, 9], popularity: [5, 8], tags: ['big damage', 'anime'],
    specials: [
      ['Bloodline Awakening', 'install', { form: 'transformation', cost: 'half bar', duration: 'normal', startup: 'fast' }],
      ['Widow Maker', 'heavy', { form: 'overhead smash', damage: 'huge', guard: 'overhead', reach: 'normal', startup: 'slow', recovery: 'very slow', onBlock: 'very punishable' }],
      ['Rift Skip', 'movement', { form: 'teleport', startup: 'fast', recovery: 'slow' }],
      ['Hemorrhage', 'melee', { form: 'straight', damage: 'heavy', reach: 'normal', startup: 'fast', recovery: 'slow', onBlock: 'punishable', effects: [{ trigger: 'on contact', effect: 'drain health' }] }],
    ],
    super: ['Apocalypse Bloom', 'super', { form: 'rushdown barrage', damage: 'huge', reach: 'normal' }],
  },
  'All-Rounder': {
    blurb: 'A tool for everything, a weakness nowhere, a personality optional.',
    difficulty: [2, 4], popularity: [5, 8], tags: ['honest'],
    specials: [
      ['Ki Bolt', 'projectile', { form: 'fireball', damage: 'normal', chip: 'normal', reach: 'full-screen', startup: 'average', recovery: 'average', onBlock: 'minus' }],
      ['Meteor Catch', 'anti-air', { form: 'flip kick', damage: 'normal', startup: 'fast', recovery: 'slow', onBlock: 'punishable' }],
      ['Echo Parry', 'counter', { form: 'parry', damage: 'normal', startup: 'instant', recovery: 'average' }],
      ['Sure Step', 'movement', { form: 'dash', startup: 'fast', recovery: 'fast' }],
    ],
    super: ['Grand Finale', 'super', { form: 'rushdown barrage', damage: 'normal', reach: 'normal' }],
  },
  'Big Body': {
    blurb: 'Covers half the screen just by standing there. Armor through it and smile.',
    difficulty: [3, 6], popularity: [3, 6], tags: ['monster', 'big damage'],
    normals: { reach: 'long' },
    specials: [
      ['Mountain Cleaver', 'heavy', { form: 'wind-up swing', damage: 'huge', reach: 'long', startup: 'very slow', recovery: 'very slow', onBlock: 'punishable' }],
      ['Orbital Hug', 'command grab', { form: 'chokeslam', damage: 'heavy', reach: 'short', startup: 'average', recovery: 'very slow' }],
      ['Heaven Denial', 'anti-air', { form: 'shoulder charge', damage: 'heavy', reach: 'long', startup: 'fast', recovery: 'slow', onBlock: 'punishable' }],
      ['Immovable', 'counter', { form: 'armour absorb', damage: 'normal', startup: 'instant', recovery: 'average' }],
    ],
    super: ['Last Dance', 'super', { form: 'unblockable slam', damage: 'huge', reach: 'short' }],
  },

  // ---------- new archetypes ----------

  'Weapon Master': {
    blurb: 'Hits you from a postcode away. Disjointed steel, and nothing at all up close.',
    difficulty: [4, 7], popularity: [5, 8], tags: ['honest', 'cool'],
    normals: { reach: 'long' },
    specials: [
      ['Reaper Arc', 'melee', { form: 'spinning', damage: 'normal', reach: 'long', startup: 'fast', recovery: 'average', onBlock: 'plus' }],
      ['Halberd Line', 'heavy', { form: 'wind-up swing', damage: 'heavy', reach: 'long', startup: 'slow', recovery: 'slow', onBlock: 'minus' }],
      ['Low Sweep Blade', 'melee', { form: 'straight', damage: 'normal', guard: 'low', reach: 'long', startup: 'average', recovery: 'average', onBlock: 'even' }],
      ['Skyward Guard', 'anti-air', { form: 'shoulder charge', damage: 'normal', reach: 'long', startup: 'fast', recovery: 'slow', onBlock: 'punishable' }],
      ['Pommel Check', 'light', { form: 'stiff-arm', damage: 'light', reach: 'point-blank', startup: 'fast', recovery: 'fast', onBlock: 'minus' }],
    ],
    super: ['Executioner\'s Mark', 'super', { form: 'cinematic grab', damage: 'heavy', reach: 'long' }],
  },
  'Aerial': {
    blurb: 'Fights from above and lands on the wrong side of you. Blocking low is a guess.',
    difficulty: [5, 8], popularity: [6, 9], tags: ['flashy', 'anime'],
    specials: [
      ['Sky Anchor', 'movement', { form: 'air dash', startup: 'instant', recovery: 'fast' }],
      ['Falling Star', 'heavy', { form: 'ground pound', damage: 'normal', guard: 'overhead', reach: 'short', startup: 'fast', recovery: 'average', onBlock: 'plus' }],
      ['Hover Snare', 'command grab', { form: 'air grab', damage: 'heavy', reach: 'short', startup: 'fast', recovery: 'slow' }],
      ['Cloudbreaker', 'anti-air', { form: 'flip kick', damage: 'normal', startup: 'instant', recovery: 'average', onBlock: 'minus' }],
    ],
    super: ['Terminal Velocity', 'super', { form: 'rushdown barrage', damage: 'heavy', guard: 'overhead', reach: 'short' }],
  },
  'Stance Switch': {
    blurb: 'Two characters wearing one costume. Learn both or lose to both.',
    difficulty: [7, 10], popularity: [4, 7], tags: ['technical', 'cool'],
    specials: [
      ['Open Guard', 'install', { form: 'stance change', cost: 'light', duration: 'long', startup: 'instant' }],
      ['Closed Guard', 'install', { form: 'stance change', cost: 'light', duration: 'long', startup: 'instant' }],
      ['Form Break', 'melee', { form: 'rekka', damage: 'normal', reach: 'normal', startup: 'fast', recovery: 'average', onBlock: 'even' }],
      ['Reversal Palm', 'counter', { form: 'reversal throw', damage: 'normal', startup: 'instant', recovery: 'slow' }],
    ],
    super: ['Both Hands', 'super', { form: 'rushdown barrage', damage: 'heavy', reach: 'normal' }],
  },
  'Counter-Puncher': {
    blurb: 'Does nothing until you do something. Then does everything.',
    difficulty: [6, 9], popularity: [4, 7], tags: ['honest', 'technical'],
    normals: { reach: 'normal' },
    specials: [
      ['Read the Room', 'counter', { form: 'parry', damage: 'heavy', startup: 'instant', recovery: 'slow', effects: [{ trigger: 'on contact', effect: 'stun the opponent' }] }],
      ['Return to Sender', 'counter', { form: 'reflect', damage: 'normal', startup: 'instant', recovery: 'slow' }],
      ['Punish Window', 'melee', { form: 'straight', damage: 'heavy', reach: 'normal', startup: 'fast', recovery: 'slow', onBlock: 'punishable' }],
      ['Patience', 'movement', { form: 'roll', startup: 'fast', recovery: 'fast' }],
    ],
    super: ['The Last Word', 'super', { form: 'cinematic grab', damage: 'huge', reach: 'short' }],
  },
}

// The comprehensive movelist: universal normals + kit specials + a super, all
// carrying the archetype's authored descriptors.
export function buildMovelist(archetype) {
  const pace = ARCHETYPE_PACE[archetype] || ARCHETYPE_PACE['All-Rounder']
  const kit = ARCHETYPE_KITS[archetype] || ARCHETYPE_KITS['All-Rounder']
  const build = (name, type, slot, d) => {
    const m = makeMove(name, type, { ...pace, ...(slot ? { slot } : {}) })
    m.d = { ...m.d, ...d }
    return applyMoveDescriptors(m)
  }
  // Normals take the archetype's reach bias, then their own role on top.
  // The archetype's reach bias applies to the swinging normals only — even a
  // spear user's jab is a jab, and a long fast jab is a balance disaster.
  const moves = NORMALS.map(([name, type, guard]) => build(name, type, 'normal', {
    ...(type === 'light' ? {} : (kit.normals || {})),
    guard,
    // Normals keep their kind's reach (or the archetype's bias) rather than
    // drifting — they're the shared baseline, and random reach on the
    // universal suite muddies the spacing identity the specials establish.
    reach: (type === 'light' ? null : kit.normals?.reach) ?? KIND_BASE[type]?.reach ?? 'normal',
    ...(name === 'Throw' ? THROW_D : {}),
  }))
  for (const [name, type, d] of kit.specials) moves.push(build(name, type, null, d || {}))
  const [sName, sType, sD] = kit.super
  moves.push(build(sName, sType, 'super', sD || {}))
  return moves
}

// ---------- Combos ----------

const COMBO_NAMES = {
  a: ['Bread and Butter', 'Corner Carry', 'Meter Dump', 'Touch of Death', 'The Standard',
    'Dizzy Loop', 'Wall Splat Special', 'Highway Robbery', 'Checkmate', 'The Vortex',
    'Full Course', 'Taxes', 'The Blender', 'Curtains'],
}

// Damage scaling per combo hit: later hits count less, like a real fighter.
export const COMBO_SCALING = [1, 0.8, 0.65, 0.5, 0.4, 0.3]

// How much advantage a move leaves when it CONNECTS. Hitstun beats blockstun,
// and the heavier the hit the longer they're stuck — which is the whole
// reason a combo is possible at all.
// Tuned so that block advantage is the LEVER: a move left at 'minus' won't
// link into anything, nudging it to 'even' or 'plus' opens real routes up.
// That's the whole point of the combo builder — the frame choices decide
// what's possible, rather than every route being a free special-cancel.
const HIT_BONUS = { none: 3, light: 5, normal: 7, heavy: 9, huge: 11 }
// Riders that leave them helpless buy a much bigger window.
const EXTENDER = /launch|wall bounce|hard knockdown|stun|freeze/i

export function onHitOf(move) {
  const tier = move.d?.damage ?? 'normal'
  const extra = (move.d?.effects || []).some((e) => EXTENDER.test(e.effect)) ? 7 : 0
  return (move.onBlock ?? -4) + (HIT_BONUS[tier] ?? 5) + extra
}

/**
 * Can `to` actually come out after `from` connects?
 *   cancel  — a normal cancelled into a special (or a special into a super).
 *             Fighting games let you skip the recovery, so it always works.
 *   links   — the advantage on hit covers the next move's startup.
 *   counter — only as a counter-hit, where the window is a few frames longer.
 *   no      — they're simply not connected; the opponent recovers first.
 */
export function linkStatus(from, to) {
  if (!from || !to) return 'no'
  const fromSlot = from.slot || 'special'
  const toSlot = to.slot || 'special'
  if (fromSlot === 'normal' && (toSlot === 'special' || toSlot === 'super')) return 'cancel'
  if (fromSlot === 'special' && toSlot === 'super') return 'cancel'
  const adv = onHitOf(from)
  const startup = to.startup ?? 11
  if (adv >= startup) return 'links'
  if (adv + 4 >= startup) return 'counter'
  return 'no'
}

export const LINK_LABEL = {
  cancel: 'cancels',
  links: 'links',
  counter: 'counter-hit only',
  no: "doesn't link",
}

/** The moves of a route, in order, skipping any that were deleted. */
export function comboMoves(char, combo) {
  return (combo.moveIds || [])
    .map((id) => (char.moves || []).find((m) => m.id === id))
    .filter(Boolean)
}

/** The link status between each consecutive pair. Length = moves - 1. */
export function comboLinks(char, combo) {
  const moves = comboMoves(char, combo)
  return moves.slice(1).map((m, i) => linkStatus(moves[i], m))
}

/**
 * Damage for a route — and it STOPS at the first broken link, because a
 * combo that drops isn't a combo. This is what makes the frame data the
 * designer authored actually matter.
 */
export function comboDamage(char, combo, rules = null) {
  const moves = comboMoves(char, combo)
  // How hard later hits are docked is a GAME rule, not a per-character one.
  const scaling = rules ? comboScalingOf(rules) : COMBO_SCALING
  let total = 0
  for (let i = 0; i < moves.length; i++) {
    if (i > 0 && linkStatus(moves[i - 1], moves[i]) === 'no') break
    total += (moves[i].damage || 0) * (scaling[i] ?? scaling[scaling.length - 1])
  }
  return Math.round(total)
}

export function comboRoute(char, combo) {
  return combo.moveIds
    .map((id) => (char.moves || []).find((m) => m.id === id)?.name)
    .filter(Boolean)
    .join(' ▸ ')
}

/**
 * One-click balance shortcut: shove a whole kit up or down the power curve.
 * direction: 'buff' | 'nerf'; magnitude: 'light' | 'heavy'. Mutates and
 * returns the char; combos read the moves' damage, so they follow along.
 *
 * This now moves DESCRIPTORS and re-resolves, never the numbers directly —
 * editing the numbers would leave a move claiming "light damage" while
 * hitting for heavy. That makes it coarser than the old percentage nudge: a
 * tier is a real step, so 'light' is one notch of damage and safety, and
 * 'heavy' leans on the frames too.
 */
export function adjustCharacterPower(char, direction = 'buff', magnitude = 'light') {
  const sign = direction === 'nerf' ? -1 : 1 // +1 stronger, -1 weaker
  const heavy = magnitude === 'heavy'
  for (const m of char.moves || []) {
    const d = { ...defaultDescriptors(m.type), ...(m.d || {}) }
    d.damage = shiftDamage(d.damage, sign, !!KIND_BASE[m.type]?.damage)
    d.onBlock = shiftTier(BLOCK_TIERS, d.onBlock, sign)
    if (heavy) {
      // Faster is stronger, so a buff walks the frame tiers DOWN the list.
      d.startup = shiftTier(SPEED_TIERS, d.startup, -sign)
      d.recovery = shiftTier(SPEED_TIERS, d.recovery, -sign)
      if (d.cost !== 'none') d.cost = shiftTier(COST_TIERS, d.cost, -sign)
    }
    m.d = d
    applyMoveDescriptors(m)
  }
  return char
}

/**
 * Generate a plausible route: starter (light/melee) into damage, optionally
 * ending in the super. Named from the pool.
 */
export function generateCombo(char, existingNames = []) {
  const mv = char.moves || []
  if (mv.length < 3) return null
  const starters = mv.filter((m) => ['light', 'melee'].includes(m.type) && (m.startup ?? 9) <= 11)
  const route = [starters.length ? choice(starters) : choice(mv)]
  // Only extend with moves that ACTUALLY connect from the previous one —
  // a generated route has to obey the same frame rules a hand-built one does.
  const target = randInt(3, 4)
  for (let guard = 0; route.length < target && guard < 24; guard++) {
    const last = route[route.length - 1]
    const options = mv.filter((m) => !route.includes(m) && linkStatus(last, m) !== 'no')
    if (!options.length) break
    // Land on something worth ending on when the route is nearly done.
    const enders = options.filter((m) => ['heavy', 'super', 'command grab'].includes(m.type))
    const finishing = route.length >= target - 1 && enders.length && chance(0.75)
    route.push(finishing ? choice(enders) : choice(options))
  }
  // Two hits into a special is a real combo; one move is not.
  if (route.length < 2) return null
  const free = COMBO_NAMES.a.filter((n) => !existingNames.includes(n))
  return {
    id: uid('combo'),
    name: free.length ? choice(free) : `${choice(COMBO_NAMES.a)} II`,
    moveIds: route.map((m) => m.id),
  }
}

// The body an archetype tends to come in: [vitality, size]. Grapplers are
// walls, glass cannons are not, and both of those are the point of them.
const ARCHETYPE_BODY = {
  'Grappler': ['heavy', 'big'],
  'Big Body': ['tank', 'boss'],
  'Glass Cannon': ['glass', 'small'],
  'Rushdown': ['light', 'small'],
  'Zoner': ['light', 'normal'],
  'Puppet': ['light', 'small'],
  'Mix-up': ['light', 'small'],
  'Charge': ['heavy', 'normal'],
  'Setplay': ['normal', 'normal'],
  'Footsies': ['normal', 'normal'],
  'Shoto': ['normal', 'normal'],
  'All-Rounder': ['normal', 'normal'],
  'Weapon Master': ['normal', 'normal'],
  'Aerial': ['light', 'small'],
  'Stance Switch': ['normal', 'normal'],
  'Counter-Puncher': ['heavy', 'normal'],
}

// Apply a kit to a character: stats in range, FULL movelist, starter combos.
export function applyArchetypeKit(char, archetype, gameTags = []) {
  const kit = ARCHETYPE_KITS[archetype]
  if (!kit) return
  char.archetype = archetype
  char.difficulty = randInt(kit.difficulty[0], kit.difficulty[1])
  char.popularity = randInt(kit.popularity[0], kit.popularity[1])
  if (!char.description) char.description = kit.blurb
  const [vit, size] = ARCHETYPE_BODY[archetype] || ARCHETYPE_BODY['All-Rounder']
  // Mostly the archetype's build, occasionally a notch off it — a small
  // grappler or an unusually sturdy zoner is a character, not a bug.
  char.vitality = chance(0.25) ? shiftTier(VITALITY_TIERS, vit, chance(0.5) ? 1 : -1) : vit
  char.size = chance(0.25) ? shiftTier(SIZE_TIERS, size, chance(0.5) ? 1 : -1) : size
  char.moves = buildMovelist(archetype)
  char.combos = []
  for (let i = 0; i < 2; i++) {
    const c = generateCombo(char, char.combos.map((x) => x.name))
    if (c) char.combos.push(c)
  }
  const applicable = kit.tags.filter((t) => gameTags.includes(t))
  if (applicable.length) char.tags = [...new Set([...(char.tags || []), ...applicable])]
}

/**
 * Bring a legacy move up to the current shape. Two generations to handle:
 * moves with no frame data at all (pre-2026-07-22), and hand-numbered moves
 * with no descriptors (pre-2026-07-25). The latter get their numbers read
 * back into the nearest tiers and then RE-DERIVED, so `d` and the numbers
 * agree — the numbers snap slightly, which is the cost of having one source
 * of truth.
 */
export function migrateMove(move) {
  const slot = move.slot || (move.type === 'super' ? 'super' : 'special')
  if (move.startup == null && !move.d) {
    return { ...move, slot, ...generateMoveData(move.type) }
  }
  if (!move.d) {
    const next = { ...move, slot, d: describeMove(move) }
    return Object.assign(next, resolveMove(next))
  }
  return move.slot ? move : { ...move, slot }
}

export const STAGE_VIBES = ['hype', 'serene', 'ominous', 'industrial', 'festival', 'desolate']
