import { choice, sample, randInt, rollStat, uid, chance } from './util.js'
import { newPlayer, newCharacter, newMove } from './model.js'
import { PERSONAL_KEYS, SOCIAL_KEYS, ARCHETYPES, MOVE_TYPES, GENDERS } from './constants.js'
import {
  FIRST_NAMES, LAST_NAMES, ALIASES, CHARACTER_NAMES, MOVE_NAME_PARTS,
  ELITE_ALIASES, FOODS, OTHER_GAMES, APPEARANCES, CATCHPHRASES,
  GAME_TITLE_PARTS, ARCADE_NAME_PARTS, STAGE_IDEAS, TOURNAMENT_NAME_PARTS,
  TECHNIQUE_NAME_PARTS,
} from './names.js'
import { newStage, newTechnique, setMatchup } from './model.js'

export function rollStatBlock(keys) {
  return Object.fromEntries(keys.map((k) => [k, rollStat()]))
}

export function generateMoveName() {
  return `${choice(MOVE_NAME_PARTS.prefix)} ${choice(MOVE_NAME_PARTS.suffix)}`
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
  return newStage({ name, description })
}

const TECH_DESCRIPTIONS = [
  'Squeezes extra frames out of a cancel window almost nobody knows exists.',
  'A timing-strict input that converts a stray hit into full damage.',
  'Turns a defensive option into a surprise offensive tool.',
  'Abuses a movement quirk to approach from an angle the game never intended.',
  'A resource trick that banks meter where others would burn it.',
  'A defensive escape that only works if you buffer it a beat early.',
  'A setup that looks unsafe on paper and is completely airtight in practice.',
  'Milks a knockdown for one extra guess the opponent never gets used to.',
]

// charId: undefined = random scope, null = general, otherwise that character.
export function generateTechnique(save, charId = undefined) {
  const chars = save.game.characters
  let scope = charId
  if (scope === undefined) scope = chars.length > 0 && chance(0.5) ? choice(chars).id : null
  return newTechnique({
    name: `${choice(TECHNIQUE_NAME_PARTS.prefix)} ${choice(TECHNIQUE_NAME_PARTS.suffix)}`,
    charId: scope,
    difficulty: randInt(2, 9),
    xp: randInt(3, 12),
    description: choice(TECH_DESCRIPTIONS),
  })
}

export function generateTournamentName() {
  return `${choice(TOURNAMENT_NAME_PARTS.a)} ${choice(TOURNAMENT_NAME_PARTS.b)}`
}

// Randomize every character pair: mostly close matchups, a few lopsided ones.
export function randomizeMatchups(game) {
  for (let i = 0; i < game.characters.length; i++) {
    for (let j = i + 1; j < game.characters.length; j++) {
      const spread = chance(0.15) ? randInt(10, 20) : randInt(0, 10)
      const sign = chance(0.5) ? 1 : -1
      setMatchup(game, game.characters[i].id, game.characters[j].id, 50 + sign * spread)
    }
  }
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
    otherGames: sample(save.arcade.otherGames.length ? save.arcade.otherGames : OTHER_GAMES, randInt(1, 3)),
    foods: sample(save.arcade.foods.length ? save.arcade.foods : FOODS, randInt(1, 3)),
  }
}

export function generateCharacter(usedNames = new Set()) {
  const available = CHARACTER_NAMES.filter((n) => !usedNames.has(n))
  const name = available.length ? choice(available) : `${choice(MOVE_NAME_PARTS.prefix)} ${choice(CHARACTER_NAMES)}`
  const moves = Array.from({ length: randInt(3, 5) }, () =>
    newMove({ name: generateMoveName(), type: choice(MOVE_TYPES) }))
  return newCharacter({
    name,
    archetype: choice(ARCHETYPES),
    difficulty: randInt(2, 9),
    popularity: randInt(2, 9),
    moves,
  })
}

export function generatePlayer(save, overrides = {}) {
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
    personal: rollStatBlock(PERSONAL_KEYS),
    social: rollStatBlock(SOCIAL_KEYS),
    defaultMood: randInt(4, 7),
    mood: randInt(4, 7),
    catchphrase: choice(CATCHPHRASES),
    attractedTags: attracted,
    repelledTags: repelled,
    playerTags: ownTags,
    attractedPlayerTags: drawnTo,
    repelledPlayerTags: putOffBy,
    otherGames: sample(save.arcade.otherGames.length ? save.arcade.otherGames : OTHER_GAMES, randInt(1, 3)),
    foods: sample(save.arcade.foods.length ? save.arcade.foods : FOODS, randInt(1, 3)),
    ...overrides,
  })
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
