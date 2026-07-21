import { choice, sample, randInt, rollStat, uid, chance } from './util.js'
import { newPlayer, newCharacter, newMove } from './model.js'
import { PERSONAL_KEYS, SOCIAL_KEYS, ARCHETYPES, MOVE_TYPES, GENDERS } from './constants.js'
import {
  FIRST_NAMES, LAST_NAMES, ALIASES, CHARACTER_NAMES, MOVE_NAME_PARTS,
  ELITE_ALIASES, FOODS, OTHER_GAMES, APPEARANCES, CATCHPHRASES,
} from './names.js'

export function rollStatBlock(keys) {
  return Object.fromEntries(keys.map((k) => [k, rollStat()]))
}

export function generateMoveName() {
  return `${choice(MOVE_NAME_PARTS.prefix)} ${choice(MOVE_NAME_PARTS.suffix)}`
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
