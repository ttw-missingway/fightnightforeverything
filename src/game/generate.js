import { choice, sample, randInt, rollStat, uid, chance, clamp, rand } from './util.js'
import { newPlayer, newCharacter } from './model.js'
import { seedTakes } from './takes.js'
import { PERSONAL_KEYS, SOCIAL_KEYS, ARCHETYPES, GENDERS, TEMPERAMENTS, SOCIAL_TEMPERAMENTS, STAT_UNIT } from './constants.js'
import {
  FIRST_NAMES, LAST_NAMES, ALIASES, CHARACTER_NAMES, MOVE_NAME_PARTS,
  ELITE_ALIASES, FOODS, STARTER_GAMES, APPEARANCES, CATCHPHRASES,
  GAME_TITLE_PARTS, ARCADE_NAME_PARTS, STAGE_IDEAS, TOURNAMENT_NAME_PARTS,
} from './names.js'
import { newStage } from './model.js'
import { deriveVoice } from './dialogue.js'
import { applyArchetypeKit, STAGE_VIBES } from './design.js'
import { selectableChars } from './forms.js'

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
    // ONE favorite each, from the whole catalog — carrying it is your call.
    otherGames: sample(STARTER_GAMES, 1),
    foods: sample(FOODS, 1),
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
// Everyone lives in the same sparse stat economy as created players now: a
// temperament row, a social row, and a tier-sized budget of points. Filler
// budgets sit below a created cast's, filler never rolls "talent", and no
// filler stat exceeds 3 points — the user's players are the only people in
// the world built past that.
const CEILING_TIERS = [
  { key: 'spectator', weight: 46, budget: [4, 8] },
  { key: 'regular', weight: 32, budget: [8, 12] },
  { key: 'prospect', weight: 15, budget: [12, 16] },
  { key: 'talent', weight: 7, budget: [16, 20] },
]
const NPC_STAT_CAP = 3 // points per stat — a created specialist always outclasses

function rollCeilingTier(isNpc) {
  // Filler never rolls "talent" — the raw material of a world champion only
  // walks in as someone the user chose to create. Passers-through top out as
  // solid prospects: real opponents, never the story.
  const tiers = isNpc ? CEILING_TIERS.filter((t) => t.key !== 'talent') : CEILING_TIERS
  const total = tiers.reduce((s, t) => s + t.weight, 0)
  let r = randInt(1, total)
  for (const t of tiers) { r -= t.weight; if (r <= 0) return t }
  return tiers[1]
}

export function generatePlayer(save, overrides = {}) {
  // Sparse temperament build: pick rows, then spend the tier's budget — most
  // of it leaning into the temperament, the rest scattered. Same economy the
  // user builds in, so filler and cast are commensurable opponents.
  const isNpc = !!overrides.npc
  const tier = rollCeilingTier(isNpc)
  const trow = choice(TEMPERAMENTS)
  const srow = choice(SOCIAL_TEMPERAMENTS)
  const pu = {}, su = {}
  for (const k of PERSONAL_KEYS) pu[k] = 0
  for (const k of SOCIAL_KEYS) su[k] = 0
  for (const k of trow.stats) pu[k] = 1 // the free temperament points
  for (const k of srow.stats) su[k] = 1
  const cap = isNpc ? NPC_STAT_CAP : 5
  let budget = randInt(tier.budget[0], tier.budget[1])
  let guard = 200
  while (budget > 0 && guard-- > 0) {
    // Lean into who they are: most points chase the temperament rows.
    const roll = rand()
    let bag, key
    if (roll < 0.5) { bag = pu; key = choice(trow.stats) }
    else if (roll < 0.65) { bag = su; key = choice(srow.stats) }
    else if (roll < 0.9) { bag = pu; key = choice(PERSONAL_KEYS) }
    else { bag = su; key = choice(SOCIAL_KEYS) }
    if (bag[key] < cap) { bag[key]++; budget-- }
  }
  const personal = {}, social = {}
  for (const k of PERSONAL_KEYS) personal[k] = pu[k] * STAT_UNIT
  for (const k of SOCIAL_KEYS) social[k] = su[k] * STAT_UNIT
  // The old hygiene joke lives here now: the rare passer-through who makes the
  // whole room edge toward the door. Warnable, fixable, never one of YOURS.
  const slob = isNpc ? chance(0.07) : false
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
  const player = newPlayer({
    firstName: first,
    lastName: last,
    alias,
    gender: choice(GENDERS),
    description: choice(APPEARANCES),
    createdBy: 'cpu',
    temperament: trow.key,
    socialTemperament: srow.key,
    personal,
    social,
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
    otherGames: sample(STARTER_GAMES, 1),
    foods: sample(FOODS, 1),
    slob,
    ...overrides,
  })
  // Everyone walks in with something to argue about. Without this, filler only
  // ever forms opinions by LOSING, so the whole room ends up believing exactly
  // one thing: that everything is broken.
  seedTakes(save, player)
  return player
}

// Seed the WHOLE finite cast up front. The roster is fixed the day the run
// begins. That model is retired: the cast the user cares about is the cast the
// user CREATED, and everyone else is filler who wanders in and out (see
// topUpNpcs). Kept as a no-op-ish shim so sandbox saves that lean on a fixed
// generated pool still work.
export function populateRoster(save) {
  const sandbox = save.settings.mode === 'sandbox'
  if (sandbox && save.settings.allowGeneratedPlayers) {
    const cpuCount = () => Object.values(save.players).filter((p) => p.createdBy === 'cpu').length
    let guard = 0
    while (cpuCount() < save.settings.maxGeneratedPlayers && guard++ < 200) {
      const p = generatePlayer(save)
      save.players[p.id] = p
    }
  }
  // Everyone walks in with opinions already formed. A roster that had to spend
  // a month working up to its first thought would have nothing to say.
  for (const p of Object.values(save.players)) {
    if (!(p.takes || []).length) seedTakes(save, p)
  }
}

// ---------- Filler: the faces that make an arcade feel like an arcade ----------
//
// The people you TRACK are the ones you made. Everyone else is generated on
// demand, drifts through for a while, and leaves without ceremony — they exist
// so the floor has opponents and the brackets have bodies, not so the user has
// 48 names to manage.
//
// Crucially, filler is a SUPPLY of candidates, not a guarantee of turnout: each
// one still rolls the same attendance check as a created player. A grimy,
// unknown, toxic arcade that can't pull a crowd doesn't get one handed to it,
// so tournaments really can come up short.

// How many strangers are plausibly in orbit of this arcade right now. Scales
// with how known and how liked the place is — the same pull that decides
// whether any individual walks in, applied to the size of the pool.
export function npcPoolTarget(save) {
  const known = clamp((save.stream?.hype ?? 0) / 120 + (save.arcade.ads?.length || 0) * 0.08, 0, 0.7)
  const draw = clamp((save.relevance ?? 55) / 100, 0.15, 1)
  const created = Object.values(save.players).filter((p) => !p.npc && !p.retired && !p.banished).length
  // A floor of bodies so a brand-new arcade isn't empty, scaling up as the
  // scene becomes something people have heard of.
  const base = 16 + Math.round(created * 1.1)
  return clamp(Math.round(base + 40 * draw * (0.6 + known)), 12, 60)
}

/**
 * Keep the filler pool near its target: generate newcomers to fill a gap, and
 * retire filler that's drifted away (nobody notices, by design). Called at the
 * top of every day.
 */
export function topUpNpcs(save, absDay) {
  if (save.settings.mode === 'sandbox' && !save.settings.allowGeneratedPlayers) return
  const npcs = Object.values(save.players).filter((p) => p.npc && !p.retired && !p.banished)

  // Churn: filler who hasn't been in for weeks has simply moved on. Anyone the
  // user has entangled with the cast (a team, a mentorship, a real rivalry)
  // sticks around — those are the ones who became part of the story.
  for (const p of npcs) {
    if (p.visitor) continue // a visiting crew leaves on its own schedule
    const last = p.npcLastSeenAbs ?? absDay
    const feuding = Object.values(p.relationships || {}).some((v) => v <= -45)
    const attached = feuding || p.teamId ||
      save.mentorships.some((m) => m.mentorId === p.id || m.studentId === p.id)
    // Loyalty is what keeps somebody coming back to the same room. A loyal
    // regular takes far longer to drift away, which is the other half of what
    // makes a Stoic-heavy scene durable.
    const patience = 45 + (p.personal?.loyalty || 0) * 6 + Math.floor(rand() * 30)
    if (!attached && absDay - last > patience) delete save.players[p.id]
  }

  const alive = Object.values(save.players).filter((p) => p.npc && !p.retired && !p.banished && !p.visitor).length
  const target = npcPoolTarget(save)
  // Trickle in rather than materialising a crowd — a scene fills up over weeks.
  let room = Math.min(target - alive, 3)
  let guard = 0
  while (room-- > 0 && guard++ < 10) {
    const p = generatePlayer(save, { npc: true, createdBy: 'cpu', npcLastSeenAbs: absDay })
    save.players[p.id] = p
  }
}

// The EVO elite roster is generated once per save and persists year to year,
// so the wider world stays internally consistent.
/**
 * The world field. Big enough that EVO is a real 64-player major rather than a
 * bracket everyone qualifies for by turning up — see EVO_FIELD in tournament.js.
 * A handful of gods, a tier of legends, and a long tail of killers who are
 * still miles better than anyone in your arcade.
 */
// Sixty-four so the field is full even in a year your arcade sends nobody —
// EVO is the world's tournament and it does not shrink to fit you.
export const EVO_ROSTER_SIZE = 64

export function generateEvoRoster(save, count = EVO_ROSTER_SIZE) {
  const roster = []
  const usedAliases = new Set()
  for (let i = 0; i < count; i++) {
    let alias = ELITE_ALIASES[i % ELITE_ALIASES.length]
    if (usedAliases.has(alias)) alias = `${alias} ${randInt(2, 9)}`
    usedAliases.add(alias)
    const pool = selectableChars(save.game)
    const char = pool.length ? choice(pool) : null
    // Elites are strong but tiered: a few gods, many killers.
    // A WORLD, not a wall. When this list was twenty people it made sense for
    // every one of them to be a monster; at sixty-four it has to have a tail,
    // or the bottom of the world rankings sits permanently above the best
    // player a local scene can produce and the ladder is decoration.
    //
    // Measured (Phase 7 harness): a well-cultivated arcade player reaches
    // ~1600 elo and ~60 skill after three years. The `contender` band is set
    // to overlap exactly that — the bottom of the top 64 is somewhere a real
    // local hero can actually reach, and everything above it still isn't.
    const tier = i < 3 ? 'god' : i < 12 ? 'legend' : i < 32 ? 'killer' : 'contender'
    const skill = tier === 'god' ? randInt(76, 86)
      : tier === 'legend' ? randInt(66, 78)
      : tier === 'killer' ? randInt(56, 70)
      : randInt(46, 60)
    const elo = tier === 'god' ? randInt(2200, 2450)
      : tier === 'legend' ? randInt(2000, 2250)
      : tier === 'killer' ? randInt(1750, 2000)
      : randInt(1430, 1760)
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
    // The floors here have to sit BELOW the contender band or the yearly drift
    // quietly compresses the tail of the world back out of a local player's
    // reach — which is exactly what it was doing: a 1700 floor rebuilt the wall
    // every New Year no matter how the roster was generated.
    e.skill = Math.max(42, Math.min(90, e.skill + randInt(-3, 3)))
    e.elo = Math.max(1400, e.elo + randInt(-40, 50))
    const pool = selectableChars(save.game)
    if (chance(0.08) && pool.length) {
      e.mainCharId = choice(pool).id
    }
  }
}
