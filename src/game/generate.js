import { choice, sample, randInt, rollStat, uid, chance } from './util.js'
import { newPlayer, newCharacter } from './model.js'
import { PERSONAL_KEYS, SOCIAL_KEYS, ARCHETYPES, GENDERS } from './constants.js'
import {
  FIRST_NAMES, LAST_NAMES, ALIASES, CHARACTER_NAMES, MOVE_NAME_PARTS,
  ELITE_ALIASES, FOODS, OTHER_GAMES, APPEARANCES, CATCHPHRASES,
  GAME_TITLE_PARTS, ARCADE_NAME_PARTS, STAGE_IDEAS, TOURNAMENT_NAME_PARTS,
} from './names.js'
import { newStage } from './model.js'
import { deriveVoice } from './dialogue.js'
import { applyArchetypeKit, STAGE_VIBES } from './design.js'

export function rollStatBlock(keys) {
  return Object.fromEntries(keys.map((k) => [k, rollStat()]))
}

// ---------- One-click randomizers for the creation screens ----------

export function generateGameTitle() {
  const base = `${choice(GAME_TITLE_PARTS.a)} ${choice(GAME_TITLE_PARTS.b)}`
  return chance(0.6) ? `${base} ${choice(GAME_TITLE_PARTS.c)}` : base
}

export function generateArcadeName() {
  return `${choice(ARCADE_NAME_PARTS.a)} ${choice(ARCADE_NAME_PARTS.b)}`
}

export function generateChannelName() {
  return `${choice(ARCADE_NAME_PARTS.a)}${choice(ARCADE_NAME_PARTS.b)}${choice(['TV', 'Live', 'FGC', 'Fights', 'Cast', 'HD'])}`
}

export function generateStage(existing = []) {
  const used = new Set(existing.map((s) => s.name))
  const fresh = STAGE_IDEAS.filter(([n]) => !used.has(n))
  const [name, description] = fresh.length ? choice(fresh) : choice(STAGE_IDEAS)
  return newStage({ name, description, vibe: choice(STAGE_VIBES) })
}

export function generateTournamentName() {
  return `${choice(TOURNAMENT_NAME_PARTS.a)} ${choice(TOURNAMENT_NAME_PARTS.b)}`
}

// Fresh identity for the player form's 🎲 button.
export function randomIdentity(save) {
  const taken = new Set(Object.values(save.players).map((p) => p.alias))
  const freeAliases = ALIASES.filter((a) => !taken.has(a))
  return {
    firstName: choice(FIRST_NAMES),
    lastName: choice(LAST_NAMES),
    alias: freeAliases.length ? choice(freeAliases) : `${choice(ALIASES)}${randInt(2, 99)}`,
    gender: choice(GENDERS),
    description: choice(APPEARANCES),
    catchphrase: choice(CATCHPHRASES),
  }
}

// Random tag/likes preferences for the player form's 🎲 button.
export function randomPreferences(save) {
  const tags = save.game.tags
  const pTags = save.game.playerTags || []
  const attracted = tags.length ? sample(tags, randInt(0, Math.min(2, tags.length))) : []
  const drawnTo = pTags.length ? sample(pTags, randInt(0, Math.min(2, pTags.length))) : []
  return {
    attractedTags: attracted,
    repelledTags: tags.length ? sample(tags.filter((t) => !attracted.includes(t)), randInt(0, 1)) : [],
    playerTags: pTags.length ? sample(pTags, randInt(0, Math.min(2, pTags.length))) : [],
    attractedPlayerTags: drawnTo,
    repelledPlayerTags: pTags.length ? sample(pTags.filter((t) => !drawnTo.includes(t)), randInt(0, 1)) : [],
    // Tastes span the whole catalog — a player can love a food/game whether or
    // not you stock it. Stocking what they like is the separate design choice.
    otherGames: sample(OTHER_GAMES, randInt(1, 3)),
    foods: sample(FOODS, randInt(1, 3)),
  }
}

export function generateCharacter(usedNames = new Set()) {
  const available = CHARACTER_NAMES.filter((n) => !usedNames.has(n))
  const name = available.length ? choice(available) : `${choice(MOVE_NAME_PARTS.prefix)} ${choice(CHARACTER_NAMES)}`
  const char = newCharacter({ name })
  // Generated fighters come out of an archetype kit: coherent moveset,
  // fitting stats, a fantasy — not random noise.
  applyArchetypeKit(char, choice(ARCHETYPES), [])
  char.description = '' // let the kit blurb show in the editor instead
  return char
}

// A generated player's latent CEILING tier. Most people who wander into an
// arcade are here to hang out, not to become a world champion — so the roster
// is deliberately top-light. A tier biases the stats that decide how high they
// can ever climb (aptitude/mastery), how hard they push (the intensity stats),
// how often they show up (spark), and their nerve on stage (composure). Only a
// handful roll "talent" — the raw material a cultivated run turns into an EVO
// threat. Everyone else plateaus no matter what. Target over 48: ~40 forgettable
// or casual, ~8 with real competitive potential, of whom 1–3 might ever win.
const CEILING_TIERS = [
  { key: 'spectator', weight: 46, range: [1, 4] },
  { key: 'regular', weight: 32, range: [3, 6] },
  { key: 'prospect', weight: 15, range: [5, 8] },
  { key: 'talent', weight: 7, range: [7, 10] },
]
const CEILING_STATS = ['spark', 'determination', 'dominance', 'mojo', 'xfactor', 'aptitude', 'mastery', 'composure']

function rollCeilingTier() {
  const total = CEILING_TIERS.reduce((s, t) => s + t.weight, 0)
  let r = randInt(1, total)
  for (const t of CEILING_TIERS) { r -= t.weight; if (r <= 0) return t }
  return CEILING_TIERS[1]
}

export function generatePlayer(save, overrides = {}) {
  const personal = rollStatBlock(PERSONAL_KEYS)
  const social = rollStatBlock(SOCIAL_KEYS)
  // Skew the ceiling stats by tier so the roster is top-light (see above). The
  // rest of the stats stay freely rolled, so personalities still vary within a
  // tier — a talented player can still be a slob with no sportsmanship.
  const tier = rollCeilingTier()
  for (const k of CEILING_STATS) personal[k] = randInt(tier.range[0], tier.range[1])
  const first = choice(FIRST_NAMES)
  const last = choice(LAST_NAMES)
  const taken = new Set(Object.values(save.players).map((p) => p.alias))
  const freeAliases = ALIASES.filter((a) => !taken.has(a))
  const alias = freeAliases.length ? choice(freeAliases) : `${choice(ALIASES)}${randInt(2, 99)}`
  const tags = save.game.tags
  const attracted = tags.length ? sample(tags, randInt(0, Math.min(2, tags.length))) : []
  const repelled = tags.length
    ? sample(tags.filter((t) => !attracted.includes(t)), randInt(0, 1))
    : []
  const pTags = save.game.playerTags || []
  const ownTags = pTags.length ? sample(pTags, randInt(0, Math.min(2, pTags.length))) : []
  const drawnTo = pTags.length ? sample(pTags, randInt(0, Math.min(2, pTags.length))) : []
  const putOffBy = pTags.length
    ? sample(pTags.filter((t) => !drawnTo.includes(t)), randInt(0, 1))
    : []
  return newPlayer({
    firstName: first,
    lastName: last,
    alias,
    gender: choice(GENDERS),
    description: choice(APPEARANCES),
    createdBy: 'cpu',
    personal,
    social, // rollStatBlock(SOCIAL_KEYS) now rolls `income` too
    voice: deriveVoice({ personal, social }),
    defaultMood: randInt(4, 7),
    mood: randInt(4, 7),
    catchphrase: choice(CATCHPHRASES),
    attractedTags: attracted,
    repelledTags: repelled,
    playerTags: ownTags,
    attractedPlayerTags: drawnTo,
    repelledPlayerTags: putOffBy,
    // Tastes span the whole catalog, not just what's stocked (see randomPreferences).
    otherGames: sample(OTHER_GAMES, randInt(1, 3)),
    foods: sample(FOODS, randInt(1, 3)),
    ...overrides,
  })
}

// Seed the WHOLE finite cast up front. The roster is fixed the day the run
// begins: consequential worlds fill to 48, sandbox honors the allow toggle +
// CPU cap. Everyone starts a stranger (isRegular=false) and DISCOVERS the
// arcade over time through the normal attendance ramp — so the early game still
// feels like a scene slowly forming. Nobody is ever generated again: once these
// people retire, they're gone, and running out of them ends the run.
export function populateRoster(save) {
  const sandbox = save.settings.mode === 'sandbox'
  if (sandbox && !save.settings.allowGeneratedPlayers) return
  const total = () => Object.keys(save.players).length
  const cpuCount = () => Object.values(save.players).filter((p) => p.createdBy === 'cpu').length
  const roomToGrow = sandbox
    ? () => cpuCount() < save.settings.maxGeneratedPlayers
    : () => total() < 48
  let guard = 0
  while (roomToGrow() && guard++ < 200) {
    const p = generatePlayer(save)
    save.players[p.id] = p
  }
}

// The EVO elite roster is generated once per save and persists year to year,
// so the wider world stays internally consistent.
export function generateEvoRoster(save, count = 20) {
  const roster = []
  const usedAliases = new Set()
  for (let i = 0; i < count; i++) {
    let alias = ELITE_ALIASES[i % ELITE_ALIASES.length]
    if (usedAliases.has(alias)) alias = `${alias} ${randInt(2, 9)}`
    usedAliases.add(alias)
    const char = save.game.characters.length ? choice(save.game.characters) : null
    // Elites are strong but tiered: a few gods, many killers.
    const tier = i < 3 ? 'god' : i < 10 ? 'legend' : 'killer'
    const skill = tier === 'god' ? randInt(92, 100) : tier === 'legend' ? randInt(82, 93) : randInt(72, 85)
    const elo = tier === 'god' ? randInt(2200, 2450) : tier === 'legend' ? randInt(2000, 2250) : randInt(1800, 2050)
    roster.push({
      id: uid('elite'),
      alias,
      firstName: choice(FIRST_NAMES),
      lastName: choice(LAST_NAMES),
      region: choice(['JP', 'KR', 'US-East', 'US-West', 'EU', 'BR', 'MX', 'SG']),
      tier,
      mainCharId: char ? char.id : null,
      skill,
      elo,
      titles: 0,
    })
  }
  return roster
}

// Elites drift slightly between years: slumps, breakouts, the occasional
// character switch — but the same people show up, which keeps EVO believable.
export function driftEvoRoster(save) {
  for (const e of save.evoRoster) {
    e.skill = Math.max(60, Math.min(100, e.skill + randInt(-3, 3)))
    e.elo = Math.max(1700, e.elo + randInt(-40, 50))
    if (chance(0.08) && save.game.characters.length) {
      e.mainCharId = choice(save.game.characters).id
    }
  }
}
