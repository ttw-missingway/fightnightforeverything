import { choice, sample, randInt, rollStat, uid, chance, clamp, rand } from './util.js'
import { bindRng } from './rng.js'
import { newPlayer, newCharacter, ensureSpirit, rollSpiritMagnitudes, spiritCeilOf } from './model.js'
import { seedTakes } from './takes.js'
import { PERSONAL_KEYS, SOCIAL_KEYS, ARCHETYPES, TEMPERAMENTS, SOCIAL_TEMPERAMENTS, STAT_UNIT, SPIRITS } from './constants.js'
import {
  FIRST_NAMES, LAST_NAMES, ALIASES, CHARACTER_NAMES, MOVE_NAME_PARTS,
  ELITE_ALIASES, FOODS, STARTER_GAMES, APPEARANCES, CATCHPHRASES,
  GAME_TITLE_PARTS, ARCADE_NAME_PARTS, STAGE_IDEAS, TOURNAMENT_NAME_PARTS,
  NAME_POOLS, NAME_MIX,
} from './names.js'
import { rollCountry, countryCluster, migrateRegion } from './geo.js'
import { PALETTE_KEYS } from './palettes.js'
import { countryCode } from './flags.js'
import { newStage } from './model.js'
import { deriveVoice } from './dialogue.js'
import { applyArchetypeKit, STAGE_VIBES } from './design.js'
import { selectableChars } from './forms.js'
import { charPower } from './patch.js'
import { rollCareerClock } from './career.js'

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


// ---------- Who people are: gender and names that make sense ----------

/**
 * Weighted, not uniform. `choice(GENDERS)` made a third of the world
 * non-binary, which reads as generated the moment you meet three players.
 */
export function rollGender() {
  // 60 / 30 / 10 — Dylan's call: not a mirror of reality's 99-to-1, but based
  // in it. An arcade full of women reads generated; an arcade with none reads
  // wrong in the other direction.
  const r = rand()
  return r < 0.6 ? 'man' : r < 0.9 ? 'woman' : 'non-binary'
}

/** Resolve a cluster-or-mix key to a concrete name pool key. */
function resolveCluster(key) {
  const mix = NAME_MIX[key]
  if (!mix) return NAME_POOLS[key] ? key : 'EN'
  let r = rand()
  for (const [k, w] of Object.entries(mix)) {
    r -= w
    if (r <= 0) return k === 'ANY' ? choice(Object.keys(NAME_POOLS)) : k
  }
  return 'EN'
}

/**
 * A first/last name appropriate to a COUNTRY and a gender. Both names come
 * from the same cluster, so a Japanese elite is Japanese all the way through
 * rather than half a coin flip.
 */
export function identityForCountry(code, gender = null) {
  const g = gender || rollGender()
  const cluster = resolveCluster(countryCluster(code))
  const pool = NAME_POOLS[cluster]
  const firsts = g === 'woman' ? pool.f : g === 'man' ? pool.m : (chance(0.5) ? pool.m : pool.f)
  // `heritage` is the cluster the name came from, persisted so the FACE picks
  // from the same well (see FACE_GUIDE in components/art.js). One roll decides
  // both: a Kenji Tanaka in Los Angeles reads East Asian on the mugshot too,
  // and an arcade in Osaka never hands its regulars mismatched faces.
  return { gender: g, firstName: choice(firsts), lastName: choice(pool.last), heritage: cluster }
}

/** The name cluster an arcade's own walk-ins draw from: its country's. */
export function arcadeCountryOf(save) {
  return countryCode(save?.arcade?.country) || 'US'
}

// Fresh identity for the player form's 🎲 button.
export function randomIdentity(save) {
  const taken = new Set(Object.values(save.players).map((p) => p.alias))
  const freeAliases = ALIASES.filter((a) => !taken.has(a))
  const who = identityForCountry(arcadeCountryOf(save))
  return {
    ...who,
    alias: freeAliases.length ? choice(freeAliases) : `${choice(ALIASES)}${randInt(2, 99)}`,
    facePalette: choice(PALETTE_KEYS),
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

/**
 * A sparse temperament build: pick rows, then spend a budget — most of it
 * leaning into the temperament, the rest scattered. The one economy everyone
 * is built in, so filler, cast and world elites are all commensurable.
 */
export function rollStatBuild(budget, cap = 5) {
  const trow = choice(TEMPERAMENTS)
  const srow = choice(SOCIAL_TEMPERAMENTS)
  const pu = {}, su = {}
  for (const k of PERSONAL_KEYS) pu[k] = 0
  for (const k of SOCIAL_KEYS) su[k] = 0
  for (const k of trow.stats) pu[k] = 1 // the free temperament points
  for (const k of srow.stats) su[k] = 1
  let left = budget
  let guard = 400
  while (left > 0 && guard-- > 0) {
    // Lean into who they are: most points chase the temperament rows.
    const roll = rand()
    let bag, key
    if (roll < 0.5) { bag = pu; key = choice(trow.stats) }
    else if (roll < 0.65) { bag = su; key = choice(srow.stats) }
    else if (roll < 0.9) { bag = pu; key = choice(PERSONAL_KEYS) }
    else { bag = su; key = choice(SOCIAL_KEYS) }
    if (bag[key] < cap) { bag[key]++; left-- }
  }
  const personal = {}, social = {}
  for (const k of PERSONAL_KEYS) personal[k] = pu[k] * STAT_UNIT
  for (const k of SOCIAL_KEYS) social[k] = su[k] * STAT_UNIT
  return { temperament: trow.key, socialTemperament: srow.key, personal, social }
}

export function generatePlayer(save, overrides = {}) {
  const isNpc = !!overrides.npc
  // THE PRODIGY (P5). Filler is deliberately incapable of greatness — a
  // passer-through tops out as a solid opponent and never as the story. But a
  // lineage that runs for fifteen years needs a way for the story to CONTINUE
  // when the cast that started it ages out, and "the owner may create six
  // people on day one, ever" is not one. So once in a long while somebody
  // walks in with the real thing, flagged loudly, and taking them on is the
  // succession decision Act 3 is asking about. Rare on purpose: see
  // maybeProdigyArrives for how seldom.
  const prodigy = !!overrides.prodigy
  const tier = prodigy ? CEILING_TIERS.find((t) => t.key === 'talent') : rollCeilingTier(isNpc)
  const build = rollStatBuild(randInt(tier.budget[0], tier.budget[1]), isNpc && !prodigy ? NPC_STAT_CAP : 5)
  const { personal, social } = build
  const trow = TEMPERAMENTS.find((t) => t.key === build.temperament)
  const srow = SOCIAL_TEMPERAMENTS.find((t) => t.key === build.socialTemperament)

  // The old hygiene joke lives here now: the rare passer-through who makes the
  // whole room edge toward the door. Warnable, fixable, never one of YOURS.
  const slob = isNpc ? chance(0.07) : false
  // Walk-ins are LOCAL: an arcade in Osaka fills with Japanese regulars, one
  // in São Paulo with Brazilians. The diversity card lives in the country
  // mixes themselves (see NAME_MIX), not in ignoring geography.
  const who = identityForCountry(arcadeCountryOf(save))
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
    firstName: who.firstName,
    lastName: who.lastName,
    alias,
    gender: who.gender,
    heritage: who.heritage,
    // Everyone gets their OWN palette. A roster where all thirty portraits are
    // Game Boy green reads as a themed set; thirty different palettes read as
    // thirty people who each brought their own photo.
    facePalette: choice(PALETTE_KEYS),
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
    ceilingTier: tier.key, // what they could ever become — the scouting read
    ...overrides,
  })
  // Everyone walks in with something to argue about. Without this, filler only
  // ever forms opinions by LOSING, so the whole room ends up believing exactly
  // one thing: that everything is broken.
  seedTakes(save, player)
  // Everyone has a shape, filler included — a passer-through with a Guru's
  // spirit quietly makes the room better, which is exactly the kind of person
  // an owner learns to spot and keep.
  ensureSpirit(player)
  return player
}

// Seed the WHOLE finite cast up front. The roster is fixed the day the run
// begins. That model is retired: the cast the user cares about is the cast the
// user CREATED, and everyone else is filler who wanders in and out (see
// topUpNpcs). Kept as a no-op-ish shim so sandbox saves that lean on a fixed
// generated pool still work.
export function populateRoster(save) {
  bindRng(save)
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
export const EVO_ROSTER_SIZE = 80

/**
 * What each rung of the world is worth, in one table, because generation and
 * the yearly drift have to agree about it. They did not: drift clamped skill
 * to 90 while the top of the roster was generated above that, so every New
 * Year quietly sanded the gods back down and the world got easier the longer a
 * lineage went on.
 *
 * THE TOP OF THIS TABLE TRACKS WHAT A MAXED BUILD CAN REACH. These bands were
 * set when a well-cultivated arcade player finished three years at ~60 skill,
 * so gods at 76-86 were untouchable. Once banked creation points actually
 * rebuilt the cast and the ceiling read the whole stat block, cultivated
 * players started arriving at 77-86 — peers of the world number one — and a
 * first-lineage local hero could win EVO. A god has to sit above a fully
 * maxed, fully cultivated build, or the whole roguelike loop resolves in two
 * runs.
 *
 * The `contender` band is the one that must stay REACHABLE: the bottom of the
 * top 64 is somewhere a real local hero can get to, and everything above it
 * still isn't.
 */
export const ELITE_TIERS = {
  god: { skill: [89, 97], elo: [2350, 2600] },
  legend: { skill: [79, 89], elo: [2100, 2350] },
  killer: { skill: [65, 80], elo: [1800, 2100] },
  contender: { skill: [48, 64], elo: [1430, 1780] },
}

/**
 * How an elite carries themselves — it decides who they PLAY, not how well.
 *
 *   loyalist    — married to the character. Patches come and go; they stay.
 *   meta-chaser — plays whatever the balance sheet says is best this month.
 *   lab-monster — plays something weird and knows it deeper than anyone.
 *   showman     — plays whatever makes the crowd loudest.
 *   veteran     — settled years ago; moves only when truly forced.
 *
 * charLoyalty is the practical number: the chance per YEAR that they resist
 * the pull toward the top of the tier list (see gravitateElites).
 */
export const ELITE_PERSONAS = [
  { key: 'loyalist', loyalty: 0.95 },
  { key: 'meta-chaser', loyalty: 0.15 },
  { key: 'lab-monster', loyalty: 0.85 },
  { key: 'showman', loyalty: 0.5 },
  { key: 'veteran', loyalty: 0.8 },
]

/**
 * A regional-ladder competitor (P4) — the national scene between your room and
 * the world list. Deliberately lighter than an elite: no persona, no spirit,
 * no stat card. They are not characters, they are the RUNG — a 64-deep board
 * of names your players climb on the way to being anybody, and the open elo
 * pool that lets a sealed room's average actually rise (REVISION §2.6,
 * plateau). How strong the board is comes from the caller via `band`, because
 * that is the run-shaping fact of your address: a US board's top rivals the
 * world's contender tail, a long-tail country's board is winnable in year two.
 */
export function makeRegionalCompetitor(save, { country, band, usedAliases = new Set() }) {
  let alias = choice(ELITE_ALIASES)
  let guard = 40
  while (usedAliases.has(alias) && guard-- > 0) alias = choice(ELITE_ALIASES)
  if (usedAliases.has(alias)) alias = `${alias} ${randInt(2, 9)}`
  usedAliases.add(alias)
  const pool = selectableChars(save.game)
  return {
    id: uid('rc'),
    alias,
    ...identityForCountry(country),
    region: country,
    tier: 'regional',
    facePalette: choice(PALETTE_KEYS),
    mainCharId: pool.length ? choice(pool).id : null,
    skill: randInt(band.skill[0], band.skill[1]),
    elo: randInt(band.elo[0], band.elo[1]),
    titles: 0,
    age: randInt(17, 33),
    ...rollCareerClock(),
  }
}

/** One world-class player, made from scratch — a whole person, not a row. */
export function makeElite(save, { tier, usedAliases = new Set() } = {}) {
  let alias = choice(ELITE_ALIASES)
  let guard = 40
  while (usedAliases.has(alias) && guard-- > 0) alias = choice(ELITE_ALIASES)
  if (usedAliases.has(alias)) alias = `${alias} ${randInt(2, 9)}`
  usedAliases.add(alias)
  const pool = selectableChars(save.game)
  const char = pool.length ? choice(pool) : null
  const band = ELITE_TIERS[tier] || ELITE_TIERS.contender
  const region = rollCountry(rand)
  const persona = choice(ELITE_PERSONAS)
  const who = identityForCountry(region)
  const elite = {
    id: uid('elite'),
    alias,
    ...who,
    region,
    tier,
    persona: persona.key,
    charLoyalty: persona.loyalty,
    facePalette: choice(PALETTE_KEYS),
    description: choice(APPEARANCES),
    catchphrase: choice(CATCHPHRASES),
    // The card. Elites are built in the SAME sparse economy as everyone else,
    // sized to the tenet that a hundred-point pool is a god: these stats are
    // what the dossier shows and what the narration reads (x-factor spikes,
    // composure under pressure) — match RESOLUTION stays skill+elo, so the
    // difficulty calibration doesn't move.
    ...rollStatBuild(ELITE_BUILD_BUDGET[tier] ? randInt(...ELITE_BUILD_BUDGET[tier]) : 20),
    mainCharId: char ? char.id : null,
    skill: randInt(band.skill[0], band.skill[1]),
    elo: randInt(band.elo[0], band.elo[1]),
    titles: 0,
    // The world ages too (P5). A god is someone who has already had the years
    // to become one; the contender tail is where the prodigies are, which is
    // what makes the bottom of the list the interesting part of it.
    age: tier === 'god' || tier === 'legend' ? randInt(24, 32)
      : tier === 'killer' ? randInt(21, 30) : randInt(17, 27),
    ...rollCareerClock(),
    ...rollEliteSpirit(tier),
  }
  // Their career is the proof of their ceiling: a god who measures 96 cannot
  // carry a skill cap of 78. Reconciled upward, never down.
  if (elite.spiritCeil.skill < elite.skill) {
    elite.spiritCeil.skill = Math.min(100, elite.skill + randInt(1, 4))
  }
  return elite
}

/**
 * An elite's spirit, consistent with what their career already proves. The
 * top of the world is mostly skill-primary — you do not become a god on a
 * Healer's ordering — while the contender tail is every shape. The skill roll
 * is reconciled upward to at least their measured skill: their existence IS
 * the evidence of their ceiling. P5 makes these live (offscreen eureka);
 * until then the fields exist so radiance and the world model read one shape.
 */
function rollEliteSpirit(tier) {
  const skillFirst = ['hero', 'outlaw', 'king']
  const pool = tier === 'god' || tier === 'legend'
    ? skillFirst
    : tier === 'killer'
      ? [...skillFirst, ...skillFirst, 'guru', 'fool', 'healer']
      : SPIRITS.map((s) => s.key)
  const spirit = choice(pool)
  const rolls = rollSpiritMagnitudes()
  return { spirit, spiritRolls: rolls, spiritCeil: spiritCeilOf(spirit, rolls) }
}

/** Creation-point pools by tier — gods read like the maxed builds they are. */
const ELITE_BUILD_BUDGET = {
  god: [62, 80],
  legend: [46, 62],
  killer: [32, 46],
  contender: [18, 32],
}

export function generateEvoRoster(save, count = EVO_ROSTER_SIZE) {
  bindRng(save)
  const roster = []
  const usedAliases = new Set()
  for (let i = 0; i < count; i++) {
    // Elites are strong but tiered: a few gods, many killers, and — now that
    // the roster runs to eighty against a sixty-four-place ranking — a tail
    // that has to fight its way ONTO the list at all.
    const tier = i < 3 ? 'god' : i < 12 ? 'legend' : i < 32 ? 'killer' : 'contender'
    roster.push(makeElite(save, { tier, usedAliases }))
  }
  return roster
}

/**
 * Old saves carry elites from before the atlas: bloc regions, no gender, no
 * persona, sixty-four of them. Bring them into the new world without touching
 * the parts a player would notice — alias, elo, skill and titles all stay.
 */
export function repairEvoRoster(save) {
  bindRng(save)
  if (!save.evoRoster) return
  // Players from before heritage existed pick the face pool their arcade's
  // country would have rolled them — names stay untouched.
  for (const p of Object.values(save.players || {})) {
    p.heritage ??= identityForCountry(arcadeCountryOf(save), p.gender).heritage
    p.facePalette ??= choice(PALETTE_KEYS)
  }
  const usedAliases = new Set(save.evoRoster.map((e) => e.alias))
  for (const e of save.evoRoster) {
    const before = e.region
    // Rows without a gender predate the atlas — for them AF/ME mean the old
    // blocs, not Afghanistan and Montenegro. See migrateRegion.
    e.region = migrateRegion(e.region, rand, { legacy: !e.gender })
    if (!e.gender || before !== e.region) {
      // A remapped region means the old name was rolled for the wrong place.
      Object.assign(e, identityForCountry(e.region, e.gender))
    }
    if (!e.persona) {
      const persona = choice(ELITE_PERSONAS)
      e.persona = persona.key
      e.charLoyalty = persona.loyalty
    }
    e.heritage ??= identityForCountry(e.region, e.gender).heritage
    e.facePalette ??= choice(PALETTE_KEYS)
    e.description ??= choice(APPEARANCES)
    e.catchphrase ??= choice(CATCHPHRASES)
    if (!e.personal) {
      Object.assign(e, rollStatBuild(ELITE_BUILD_BUDGET[e.tier] ? randInt(...ELITE_BUILD_BUDGET[e.tier]) : 20))
    }
    // Elites from before the spirit layer get a shape now (P1). Reconcile the
    // skill roll upward to their measured skill — their career is the proof.
    if (!e.spirit) Object.assign(e, rollEliteSpirit(e.tier))
    if (e.spiritCeil && e.spiritCeil.skill < (e.skill || 0)) {
      e.spiritCeil.skill = Math.min(100, (e.skill || 0) + randInt(1, 4))
    }
  }
  while (save.evoRoster.length < EVO_ROSTER_SIZE) {
    save.evoRoster.push(makeElite(save, { tier: 'contender', usedAliases }))
  }
}

// Elites drift slightly between years: slumps, breakouts, the occasional
// character switch — but the same people show up, which keeps EVO believable.

/**
 * The world plays without you. A handful of unwatchable background sets a day
 * among the eighty — locals, money matches, invitationals nobody streams —
 * so the ladder SHIFTS: the top 64 is under pressure from below all the time
 * instead of holding still between EVOs. Standard elo at a small K keeps the
 * churn honest (zero-sum) and the whiplash mild.
 *
 * Returns the day's genuine shocks so the caller can put them in the feed.
 */
export function worldMatchesDaily(save) {
  const roster = save.evoRoster || []
  if (roster.length < 2) return []
  const sorted = [...roster].sort((a, b) => b.elo - a.elo)
  const upsets = []
  const sets = randInt(2, 4)
  for (let n = 0; n < sets; n++) {
    // Near-neighbours play: the scene sorts itself the way ladders actually
    // do, by people fighting the people around them.
    const i = randInt(0, sorted.length - 1)
    const span = randInt(1, 8) * (chance(0.5) ? 1 : -1)
    const j = clamp(i + span, 0, sorted.length - 1)
    if (i === j) continue
    const a = sorted[i], b = sorted[j]
    const perf = (e) => e.skill * 0.75 + (e.elo - 1200) / 40 + rand() * 6
    const pa = 1 / (1 + Math.pow(10, -(perf(a) - perf(b)) / 22))
    const aWins = chance(pa)
    const w = aWins ? a : b
    const l = aWins ? b : a
    const expected = 1 / (1 + Math.pow(10, (l.elo - w.elo) / 400))
    const delta = Math.round(16 * (1 - expected))
    w.elo += delta
    l.elo -= delta
    const winProb = aWins ? pa : 1 - pa
    if (winProb < 0.25 && sorted.indexOf(l) < 12) upsets.push({ winner: w, loser: l })
  }
  return upsets
}

export function driftEvoRoster(save) {
  for (const e of save.evoRoster) {
    // The world REGRESSES TOWARD ITS TIER, it does not random-walk.
    //
    // A random walk with a hard clamp only ever loses: your scene beats elites
    // at EVO and during invasions, that rating is written back, and nothing
    // ever put it back. Measured across six runs of one lineage the top three
    // of the world fell 2489 → 2372 and stayed there, so a late lineage was
    // fighting a world its own earlier runs had worn down — a path to a
    // champion that has nothing to do with how good your players got.
    //
    // Real scenes don't work that way. The people at the top keep playing each
    // other, new talent arrives, and somebody who got knocked off goes back to
    // the lab. So each year closes a quarter of the gap back to where that rung
    // of the world belongs, and the noise rides on top of that.
    const band = ELITE_TIERS[e.tier] || ELITE_TIERS.contender
    const midSkill = (band.skill[0] + band.skill[1]) / 2
    const midElo = (band.elo[0] + band.elo[1]) / 2
    e.skill = clamp(Math.round(e.skill + (midSkill - e.skill) * 0.25 + randInt(-3, 3)), 40, 99)
    e.elo = Math.max(1400, Math.round(e.elo + (midElo - e.elo) * 0.25 + randInt(-40, 50)))
  }
  gravitateElites(save)

  // ---- The career arc, offscreen (P5) ----
  //
  // §0: "elites run the eureka machine offscreen at a cheap rate, age, and
  // retire; new prodigies enter every year. Otherwise an endless game consumes
  // its own world." The band regression above is the BACKBONE and stays
  // untouched — it is what stops your cast from permanently wearing the world
  // down, and it carries the §1.6 difficulty calibration. This rides on top of
  // it as a per-person modulation: a 22-year-old killer drifts above their
  // band's middle toward the ceiling their spirit allows, a 34-year-old drifts
  // below it. Aggregate band shape holds; individual careers stop being flat.
  for (const e of save.evoRoster) {
    e.age = (e.age ?? 25) + 1
    const past = (e.age ?? 25) - (e.peakAge ?? 28)
    const ceil = e.spiritCeil?.skill ?? 99
    if (past < 0) {
      // Still climbing: the cheap offscreen eureka, bounded by their spirit.
      const room = Math.max(0, ceil - e.skill)
      e.skill = clamp(Math.round(e.skill + Math.min(room, randInt(0, 2))), 40, 99)
    } else if (past > 1) {
      e.skill = clamp(Math.round(e.skill - Math.min(3, (past - 1) * 0.5)), 40, 99)
    }
  }

  // PROMOTION AND RELEGATION (P6). Every retiree is replaced by a CONTENDER,
  // so without this the roster's tier composition ratchets downward: gods and
  // legends leave, contenders arrive, and nobody ever moves up. Measured over
  // fifteen years that alone walked the world champion from skill 98 to 77
  // and slid metric 1's world ratio with it — the band regression above was
  // faithfully pulling each elite toward a tier that was itself decaying.
  // Real scenes promote: a contender who keeps growing becomes a killer, and
  // a killer who keeps growing becomes a name. Tier follows skill.
  // Tiered by RANK, not by absolute skill, so the pyramid keeps the shape
  // generateEvoRoster designed (3 gods, 9 legends, 20 killers, the rest a
  // tail). An absolute threshold let thirteen people be gods at once, which
  // inflates the whole top of the ladder; a rank cut makes "god" mean what it
  // says — the three best players alive — and is self-correcting forever.
  {
    const bySkill = [...save.evoRoster].sort((a, b) => b.skill - a.skill)
    bySkill.forEach((e, i) => {
      e.tier = i < 3 ? 'god' : i < 12 ? 'legend' : i < 32 ? 'killer' : 'contender'
    })
  }

  // TURNOVER — now driven by the clock rather than by weakness. Careers end
  // because they run out of years, which is why the name that drops off the
  // list is sometimes still a great one, and why the tail is full of young
  // people on the way up rather than a permanent underclass.
  const usedAliases = new Set(save.evoRoster.map((x) => x.alias))
  const leaving = []
  for (const e of save.evoRoster) {
    const overdue = (e.age ?? 25) - (e.hangUpAge ?? 36)
    if (overdue >= 0 && chance(clamp(0.2 + overdue * 0.16, 0.2, 0.9))) leaving.push(e)
  }
  // The world always turns over a little, even in a year when nobody's clock
  // ran out — otherwise a lucky cohort ages in lockstep and the list freezes.
  if (leaving.length < 2) {
    const byElo = [...save.evoRoster].sort((a, b) => a.elo - b.elo)
    for (const e of byElo.slice(0, 2 - leaving.length)) if (!leaving.includes(e)) leaving.push(e)
  }
  for (const e of leaving) {
    const i = save.evoRoster.indexOf(e)
    if (i < 0) continue
    // PRODIGIES ENTER. A replacement is a young unknown with room to grow into
    // — makeElite already rolls the spirit ceiling that decides how far.
    const rookie = makeElite(save, { tier: 'contender', usedAliases })
    rookie.age = randInt(16, 21)
    save.evoRoster[i] = rookie
  }
}

/**
 * Top players gravitate toward top-tier characters — that is what being a
 * pro means. Each persona resists the pull differently (see ELITE_PERSONAS):
 * the meta-chaser re-mains within a season of a patch, the loyalist basically
 * never, the lab-monster actively prefers the thing nobody else plays.
 */
export function gravitateElites(save) {
  const pool = selectableChars(save.game)
  if (!pool.length) return
  const powered = pool
    .map((c) => ({ id: c.id, power: charPower(save.game, c.id) }))
    .sort((a, b) => b.power - a.power)
  const top = powered.slice(0, Math.max(2, Math.ceil(powered.length / 3)))
  const bottom = powered.slice(-Math.max(2, Math.ceil(powered.length / 4)))
  for (const e of save.evoRoster) {
    if (chance(e.charLoyalty ?? 0.7)) continue
    if (e.persona === 'lab-monster') {
      e.mainCharId = choice(bottom).id
      continue
    }
    // The better the player, the harder the pull toward the top of the sheet.
    const pullTop = e.tier === 'god' || e.tier === 'legend' ? 0.8 : 0.55
    e.mainCharId = chance(pullTop) ? choice(top).id : choice(powered).id
  }
}
