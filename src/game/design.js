// Game-design content: archetype kits, themed move names per type, and
// stage vibes — so building a fighter feels like building a fighter.

import { choice, sample, randInt } from './util.js'
import { newMove } from './model.js'

// Themed move-name fragments per move type, for the per-type 🎲 buttons.
export const MOVE_NAMES_BY_TYPE = {
  'projectile': ['Ki Bolt', 'Sonic Edge', 'Vermilion Wave', 'Null Sphere', 'Ash Cloud', 'Piercing Howl'],
  'melee': ['Spiral Knuckle', 'Rift Palm', 'Twin Viper', 'Iron Verse', 'Crescent Hook', 'Gut Check'],
  'light': ['Needle Flurry', 'Quicksilver Jab', 'Triple Sting', 'Paper Cut', 'Static Peck'],
  'heavy': ['Mountain Cleaver', 'Widow Maker', 'Seismic Slam', 'Judgment Drop', 'Anvil Song'],
  'set up': ['Spider Lattice', 'Dead Man\'s Corner', 'Puppet Strings', 'Chessboard', 'Rain Check'],
  'trap': ['Bear Cage', 'Landmine Waltz', 'Venus Snare', 'Glass Garden', 'Tripwire Tango'],
  'anti-air': ['Sky Piercer', 'Heaven Denial', 'Meteor Catch', 'No Fly Zone', 'Zenith Cutter'],
  'command grab': ['Gravedigger', 'Orbital Hug', 'Debt Collector', 'Last Dance', 'Cyclone Suplex'],
  'counter': ['Mirror Debt', 'Receipt', 'Polite Refusal', 'Echo Parry', 'Grudge Keeper'],
  'install': ['Limit Break', 'Second Sunrise', 'Bloodline Awakening', 'Overclock', 'Eclipse Mode'],
  'movement': ['Ghost Step', 'Vapor Trail', 'Blink Cancel', 'Moonwalk', 'Rift Skip'],
  'super': ['Grand Finale', 'Thousand Cranes', 'Apocalypse Bloom', 'Curtain Call', 'Big Bang Encore'],
}

export function generateMoveNameForType(type) {
  const pool = MOVE_NAMES_BY_TYPE[type] || MOVE_NAMES_BY_TYPE['melee']
  return choice(pool)
}

// An archetype kit: everything a designer needs to start from a fantasy and
// tweak, instead of staring at empty fields.
export const ARCHETYPE_KITS = {
  'Shoto': {
    blurb: 'The measuring stick. Fireball, anti-air, honest buttons — wins with fundamentals.',
    difficulty: [3, 5], popularity: [6, 9], tags: ['honest', 'classic'],
    moves: [
      ['Ki Bolt', 'projectile'], ['Zenith Cutter', 'anti-air'], ['Spiral Knuckle', 'melee'],
      ['Quicksilver Jab', 'light'], ['Grand Finale', 'super'],
    ],
  },
  'Grappler': {
    blurb: 'One touch, one health bar. Slow walk forward, terrifying once close.',
    difficulty: [4, 7], popularity: [3, 6], tags: ['big damage', 'monster'],
    moves: [
      ['Gravedigger', 'command grab'], ['Anvil Song', 'heavy'], ['Bear Cage', 'trap'],
      ['Gut Check', 'melee'], ['Cyclone Suplex', 'super'],
    ],
  },
  'Zoner': {
    blurb: 'The screen belongs to them. Death by a thousand chip points.',
    difficulty: [5, 8], popularity: [2, 5], tags: ['cheap', 'technical'],
    moves: [
      ['Vermilion Wave', 'projectile'], ['Ash Cloud', 'projectile'], ['Tripwire Tango', 'trap'],
      ['No Fly Zone', 'anti-air'], ['Thousand Cranes', 'super'],
    ],
  },
  'Rushdown': {
    blurb: 'Never blocks, never breathes. The opponent plays defense until they lose.',
    difficulty: [4, 7], popularity: [6, 9], tags: ['flashy', 'cool'],
    moves: [
      ['Triple Sting', 'light'], ['Vapor Trail', 'movement'], ['Twin Viper', 'melee'],
      ['Crescent Hook', 'melee'], ['Curtain Call', 'super'],
    ],
  },
  'Charge': {
    blurb: 'Patience as a weapon. Holds back, then punishes everything at once.',
    difficulty: [4, 6], popularity: [3, 6], tags: ['classic', 'honest'],
    moves: [
      ['Sonic Edge', 'projectile'], ['Sky Piercer', 'anti-air'], ['Seismic Slam', 'heavy'],
      ['Static Peck', 'light'], ['Big Bang Encore', 'super'],
    ],
  },
  'Puppet': {
    blurb: 'Two characters, one health bar, endless nightmares for both players.',
    difficulty: [8, 10], popularity: [3, 6], tags: ['technical', 'anime'],
    moves: [
      ['Puppet Strings', 'set up'], ['Spider Lattice', 'set up'], ['Blink Cancel', 'movement'],
      ['Needle Flurry', 'light'], ['Apocalypse Bloom', 'super'],
    ],
  },
  'Setplay': {
    blurb: 'One knockdown starts the blender. Escape rooms sold separately.',
    difficulty: [6, 9], popularity: [4, 7], tags: ['cheap', 'technical'],
    moves: [
      ['Dead Man\'s Corner', 'set up'], ['Venus Snare', 'trap'], ['Rain Check', 'set up'],
      ['Rift Palm', 'melee'], ['Eclipse Mode', 'install'],
    ],
  },
  'Footsies': {
    blurb: 'Wins the fight an inch at a time. Every whiffed button is a funeral.',
    difficulty: [5, 8], popularity: [4, 7], tags: ['honest', 'classic'],
    moves: [
      ['Crescent Hook', 'melee'], ['Paper Cut', 'light'], ['Receipt', 'counter'],
      ['Ghost Step', 'movement'], ['Judgment Drop', 'heavy'],
    ],
  },
  'Mix-up': {
    blurb: 'Left, right, low, grab — a coin flip where they own the coin.',
    difficulty: [5, 8], popularity: [5, 8], tags: ['flashy', 'creepy'],
    moves: [
      ['Moonwalk', 'movement'], ['Debt Collector', 'command grab'], ['Twin Viper', 'melee'],
      ['Glass Garden', 'trap'], ['Curtain Call', 'super'],
    ],
  },
  'Glass Cannon': {
    blurb: 'Melts health bars and folds like paper. Every round is a heart attack.',
    difficulty: [6, 9], popularity: [5, 8], tags: ['big damage', 'anime'],
    moves: [
      ['Bloodline Awakening', 'install'], ['Widow Maker', 'heavy'], ['Rift Skip', 'movement'],
      ['Piercing Howl', 'projectile'], ['Apocalypse Bloom', 'super'],
    ],
  },
  'All-Rounder': {
    blurb: 'A tool for everything, a weakness nowhere, a personality optional.',
    difficulty: [2, 4], popularity: [5, 8], tags: ['honest'],
    moves: [
      ['Ki Bolt', 'projectile'], ['Iron Verse', 'melee'], ['Meteor Catch', 'anti-air'],
      ['Echo Parry', 'counter'], ['Grand Finale', 'super'],
    ],
  },
  'Big Body': {
    blurb: 'Covers half the screen just by standing there. Armor through it and smile.',
    difficulty: [3, 6], popularity: [3, 6], tags: ['monster', 'big damage'],
    moves: [
      ['Mountain Cleaver', 'heavy'], ['Orbital Hug', 'command grab'], ['Seismic Slam', 'heavy'],
      ['Heaven Denial', 'anti-air'], ['Last Dance', 'super'],
    ],
  },
}

// Apply a kit to an existing character: stats in range, themed moves, tags
// (only tags that exist in the game's tag list are applied).
export function applyArchetypeKit(char, archetype, gameTags = []) {
  const kit = ARCHETYPE_KITS[archetype]
  if (!kit) return
  char.archetype = archetype
  char.difficulty = randInt(kit.difficulty[0], kit.difficulty[1])
  char.popularity = randInt(kit.popularity[0], kit.popularity[1])
  if (!char.description) char.description = kit.blurb
  char.moves = sample(kit.moves, Math.min(kit.moves.length, randInt(4, 5)))
    .map(([name, type]) => newMove({ name, type }))
  const applicable = kit.tags.filter((t) => gameTags.includes(t))
  if (applicable.length) char.tags = [...new Set([...(char.tags || []), ...applicable])]
}

export const STAGE_VIBES = ['hype', 'serene', 'ominous', 'industrial', 'festival', 'desolate']
