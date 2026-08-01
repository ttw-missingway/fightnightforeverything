import { uid, clamp, rand } from './util.js'
import { newRngState, bindRng } from './rng.js'
import { newAttention } from './attention.js'
import { PERSONAL_KEYS, SOCIAL_KEYS, DEFAULT_FOOD_PRICE, DEFAULT_GAME_TOKENS, DAYS_PER_MONTH, absDayOf, OPENING_DAY, TEMPERAMENTS, SOCIAL_TEMPERAMENTS, STAT_UNIT, STAT_MAX_POINTS, SPIRITS, SPIRIT_AXES, SPIRIT_ROLL, spiritOf } from './constants.js'
import { deriveVoice } from './dialogue.js'
import { generateMoveData, migrateMove, generateCombo } from './design.js'
import { defaultRules, migrateRules } from './rules.js'
import { computeMatchups } from './balance.js'
import { pruneForms, formsOf, FORM_MOVE_TYPE } from './forms.js'
import { reskinFresh } from './skins.js'

export function newCharacter(partial = {}) {
  return {
    id: uid('char'),
    name: 'New Fighter',
    archetype: 'Shoto',
    spriteKey: null, // pixel-art sprite name (null = auto-pick by archetype)
    difficulty: 5, // 1-10, how hard to learn
    popularity: 5, // 1-10, how likely players gravitate to them
    vitality: 'normal', // glass|light|normal|heavy|tank — how big a health bar
    size: 'normal', // tiny|small|normal|big|boss — hurtbox, throw range, mobility
    description: '',
    moves: [], // full movelist with frame data — see design.js
    combos: [], // {id, name, moveIds} — named routes, used in narration
    tags: [], // strings from game.tags — players are attracted/repelled by these
    // The id of the character this one is a FORM of, or null for an ordinary
    // fighter. A form is unpickable — it's reached through a `form change`
    // move and lasts until the bell. See src/game/forms.js.
    formOf: null,
    // Cosmetic variants: [{id, name, spriteKey}]. Purely a different face on
    // the same fighter — never a separate entry on the tier list or the
    // chart. Players settle on one they like. See src/game/skins.js.
    skins: [],
    ...partial,
  }
}

export function newMove(partial = {}) {
  const type = partial.type || 'melee'
  return {
    id: uid('move'),
    name: 'New Move',
    type,
    slot: type === 'super' ? 'super' : 'special',
    ...generateMoveData(type),
    ...partial,
  }
}

export function newStage(partial = {}) {
  return { id: uid('stage'), name: 'New Stage', description: '', vibe: 'hype', bgKey: null, ...partial }
}

// Designed techniques are retired for now — all tech is discovered by the
// community (save.innovations). game.techniques survives in the schema so old
// saves load, but nothing authors or unlocks them anymore.

export function blankStats(keys, value = 5) {
  return Object.fromEntries(keys.map((k) => [k, value]))
}

/** The eureka spine's per-player state (REVISION §1). One bag, one shape. */
export function newEureka() {
  return {
    pressure: {}, // stat -> accumulated productive pressure
    sources: {}, // stat -> recent {absDay, why, amt} (capped ring) — the inspector's evidence
    threshold: 25, // pressure sum that arms a breakthrough; ×1.35 each time
    count: 0, // career breakthroughs
    perStat: {}, // stat -> times broken through (same-stat repeats escalate)
    crossRowBy: {}, // temperament-row key -> cross-row breakthroughs landed there
    pending: null, // {sinceAbs, candidates:[{stat,kind,pressure}]} — a user player waiting on YOU
    log: [], // {absDay, stat, kind, cross, forced} — the career's breakthrough record
    adversity: 0, // lifetime intake — metric 4 reads its cohort off this
    burnout: 0, // lifetime passion the split sent the other way
    purpleUntilAbs: 0, // the purple patch after a breakthrough
    feudSeen: [], // pair keys already counted as ruptures
    lastWeeklyAbs: 0, // weekly-channel bookkeeping (company, plateau)
    weekSkillMark: 0, // best skill at the last weekly check — plateau detection
  }
}

/** Roll the three hidden magnitudes: uniform on SPIRIT_ROLL, sorted desc. */
export function rollSpiritMagnitudes() {
  const [lo, hi] = SPIRIT_ROLL
  const rolls = [0, 0, 0].map(() => Math.round((lo + rand() * (hi - lo)) * 10) / 10)
  return rolls.sort((a, b) => b - a)
}

/** Map rolls through the spirit's order onto the three capped quantities. */
export function spiritCeilOf(spiritKey, rolls) {
  const spirit = spiritOf(spiritKey)
  if (!spirit || !rolls) return null
  const ceil = {}
  spirit.order.forEach((axis, i) => { ceil[SPIRIT_AXES[axis].caps] = rolls[i] })
  return ceil
}

/**
 * Give a player their spirit if they lack one, and keep the derived ceilings
 * consistent. The player chooses the SHAPE and the game rolls the MAGNITUDE —
 * so changing spirit (creation-window only) remaps the same rolls onto the
 * new order rather than rerolling; there is nothing to fish for.
 */
export function ensureSpirit(player, key = null) {
  if (key) player.spirit = key
  if (!player.spirit) player.spirit = SPIRITS[Math.floor(rand() * SPIRITS.length)].key
  if (!player.spiritRolls) player.spiritRolls = rollSpiritMagnitudes()
  player.spiritCeil = spiritCeilOf(player.spirit, player.spiritRolls)
  player.eureka ??= newEureka()
  player.community ??= 0
  return player
}

/**
 * One person's clock: how old they are, when they peak, and roughly when they
 * are done. See the `age` block in newPlayer for why this is rolled per person
 * rather than defaulted — a shared clock is the bulk-exodus bug (metric 5).
 *
 * Duplicated deliberately from career.js `rollAge`/`rollCareerClock`: career.js
 * imports model.js, so the reverse edge would close a cycle. If you change the
 * bands here, change them there.
 */
function rollLifeClock() {
  const r = rand()
  const age = r < 0.62 ? 16 + Math.floor(rand() * 7) : 23 + Math.floor(rand() * 9)
  const peakAge = 25 + Math.floor(rand() * 7)
  return { age, peakAge, hangUpAge: peakAge + 4 + Math.floor(rand() * 11) }
}

export function newPlayer(partial = {}) {
  return {
    id: uid('player'),
    firstName: 'New',
    lastName: 'Player',
    alias: '',
    gender: 'non-binary',
    heritage: null, // name cluster the identity rolled from — the face follows it
    facePalette: null, // their portrait's palette (null = derived from their id)
    description: '',
    catchphrase: '',
    spriteKey: null, // pixel-art sprite name (null = auto-pick from id)
    createdBy: 'user', // 'user' | 'cpu'
    // Filler. NPCs are generated on demand to populate the floor, live in
    // `players` so matchmaking/social/tournaments treat them like anyone else,
    // and are never surfaced as part of the cast the user tracks. They drift in
    // and out: stop showing up for long enough and they're gone for good.
    npc: false,
    npcLastSeenAbs: null, // absolute day they last walked in — drives churn
    // Disco-style creation: every stat starts EMPTY. A temperament row (one
    // competitive, one social) grants its stats a point each, and the rest is
    // point-buy. An unspent stat is a real flaw, not "average".
    personal: blankStats(PERSONAL_KEYS, 0),
    social: blankStats(SOCIAL_KEYS, 0), // includes `income` — spending money they walk in with
    temperament: null, // TEMPERAMENTS key — the competitive row they lead with
    socialTemperament: null, // SOCIAL_TEMPERAMENTS key
    // The third layer (REVISION §1.6): what they could become. Chosen at
    // creation, set in stone. The ROLLS are hidden and never surfaced — what
    // you discover over a career is the shape, through the journal, never a
    // number.
    spirit: null, // SPIRITS key
    spiritRolls: null, // [high, mid, low] — rolled once; a spirit change remaps, never rerolls
    spiritCeil: null, // {skill, community, popularity} — order mapped onto the rolls
    community: 0, // 0-100 — the scene's connective tissue, love-capped; see social.js
    eureka: newEureka(), // the breakthrough spine's per-player state — see eureka.js
    slob: false, // the rare filler quirk: the arcade is a small room, people notice
    defaultMood: 5,
    mood: 5,
    elo: 1200,
    glory: 0,
    respect: 0,
    mainCharId: null, // current character (rotates daily while exploring)
    pocketPicks: [], // secondary charIds they'll counterpick with in bad matchups
    // What they're CURRENTLY messing about with: {charId, reason, sinceAbs}.
    // Not a main and not a pocket — a reaction to something that happened (a
    // new release, a buff, the best player in the room). Played in casual sets
    // only; tournaments read mainCharId, so a toy never follows anyone into
    // bracket unless it earns the main slot first. See interest.js.
    currentInterest: null,
    settledMain: false, // false = still trying characters out before committing
    exploredChars: [], // charIds tried during the exploration phase
    lockedMain: false, // user pinned the main; sim won't switch it
    charSkill: {}, // charId -> 0..100
    knownTechniques: [], // technique ids (user-authored techniques)
    knownInnovations: [], // innovation ids (sim-created techniques)
    relationships: {}, // otherPlayerId -> -100..100
    h2h: {}, // otherPlayerId -> {w, l} lifetime head-to-head record
    memories: [], // {day, year, kind, text} — defining moments, capped (dialogue's shelf)
    // The first-person feed (journal.js). THE journal rule: a stat change is
    // announced here and nowhere else. Cast only — filler and elites keep
    // none; elites get fragments instead.
    journal: [], // {absDay, day, year, kind, text, deltas, thread}
    journalWritten: 0, // lifetime entries — metric 7 reads the rate off this
    threads: [], // open storylines: {id, kind, subjectId, openedAbs, closedAbs}
    met: {}, // otherId -> {firstDay, count} — who they've actually spoken to
    takes: [], // {topic, subject, stance, strength, formedAbs} — see takes.js
    said: [], // recent line ids, so they don't repeat themselves
    voice: null, // {energy, humor, speech, quirk} — derived from stats if null
    teamId: null,
    attractedTags: [],
    repelledTags: [],
    playerTags: [], // this player's own vibe tags (from game.playerTags)
    attractedPlayerTags: [], // drawn to people with these tags
    repelledPlayerTags: [], // put off by people with these tags
    charRecord: {}, // charId -> {w, l} lifetime record on that character
    form: [], // last 8 results, newest first: 'w' | 'l' — recent form, not lifetime
    otherGames: [],
    foods: [],
    wins: 0,
    losses: 0,
    tournamentWins: 0,
    evoTitles: 0, // EVO championships — the mark of a legend
    isRegular: false, // has discovered the arcade yet
    daysAttended: 0,
    // THE OTHER CLOCK (P5). Passion asks "do they still want this"; age asks
    // "can they still do it", and nothing tops age back up.
    //
    // ROLLED HERE, not defaulted here. A shared default is how metric 5's
    // bulk-exodus bug comes back: a cast that all peaks at 28 and hangs up at
    // 36 leaves in one clump, and the dispersion the metric measures goes to
    // zero. Every construction path — creation form, generated walk-in,
    // new-run reset — comes through newPlayer, so rolling at this one site is
    // what guarantees nobody shares a clock. (career.js has the same rolls as
    // rollCareerClock for callers that need them standalone; it cannot be
    // imported here without closing a module cycle.)
    ...rollLifeClock(),
    peakSkill: 0, // high-water mark; age erodes toward a floor under it, never past
    passion: 80, // 0-100 love for the game; erodes with tenure, refilled by wins/content
    belief: 0, // 0-100 earned stage composure — grows from streamed/marquee reps; the EVO "choke" factor
    popularity: 0, // 0-100 public profile — grows from being featured on stream; feeds passion
    roadGames: 0, // sets vs the outside world (circuit, EVO, pot outsiders) — the world ranks what it has SEEN
    banished: false, // kicked out for good — gone from the scene, not coming back
    banishedDay: null,
    banishedYear: null,
    retired: false, // burned out and walked away — inactive, kept for history
    retiredDay: null,
    retiredYear: null,
    ...partial,
  }
}

// A player's identity, stats, and tastes survive into a new world; their
// PROGRESS (elo, skills, relationships, records, teams) does not. Used by
// "start a new run" and by importing an exported player list into a new save.
// A main pinned at creation stays pinned; anything settled through play resets.
export function resetPlayerForNewRun(p) {
  return newPlayer({
    id: p.id,
    firstName: p.firstName,
    lastName: p.lastName,
    alias: p.alias,
    gender: p.gender,
    heritage: p.heritage || null,
    facePalette: p.facePalette || null,
    description: p.description,
    catchphrase: p.catchphrase,
    spriteKey: p.spriteKey || null,
    createdBy: p.createdBy,
    // Carry the filler flag. Without it newPlayer's `npc: false` default turned
    // every passer-through into a member of your cast on reset, and a roster
    // that should have been six people came back as seventy.
    npc: !!p.npc,
    // Spirit is identity — set in stone, so it crosses runs with the person.
    // The eureka STATE does not (that's progress); newPlayer starts it fresh.
    spirit: p.spirit || null,
    spiritRolls: p.spiritRolls ? [...p.spiritRolls] : null,
    spiritCeil: p.spirit && p.spiritRolls ? spiritCeilOf(p.spirit, p.spiritRolls) : null,
    personal: structuredClone(p.personal),
    social: structuredClone(p.social), // includes income
    voice: p.voice ? structuredClone(p.voice) : null,
    defaultMood: p.defaultMood,
    mood: p.defaultMood,
    mainCharId: p.lockedMain ? p.mainCharId : null,
    lockedMain: p.lockedMain,
    settledMain: !!p.lockedMain,
    exploredChars: p.lockedMain && p.mainCharId ? [p.mainCharId] : [],
    attractedTags: [...(p.attractedTags || [])],
    repelledTags: [...(p.repelledTags || [])],
    playerTags: [...(p.playerTags || [])],
    attractedPlayerTags: [...(p.attractedPlayerTags || [])],
    repelledPlayerTags: [...(p.repelledPlayerTags || [])],
    otherGames: [...(p.otherGames || [])],
    foods: [...(p.foods || [])],
  })
}

/**
 * Make any stat spread legal under the temperament point-buy: snap internal
 * values to the 0–5 point grid, adopt the rows the build already leans toward
 * as its temperaments (their stats get the free point), then shave the highest
 * stats until the spend fits the budget. Used for imported casts, generated
 * players, and anything else that didn't come through the creation form.
 */
/**
 * Can the cast still be edited?
 *
 * The rule was always "players lock in once the run has STARTED" — but it was
 * implemented as `mode === 'sandbox'`, which never checks whether a run has
 * started. That was fine while the only way into a consequential world was
 * through the creation wizard. Then resets arrived, and a reset produces
 * exactly the state the rule never anticipated: a brand-new run that has not
 * begun, whose cast is carried over, on a screen that is not the wizard.
 *
 * The result was that banked creation points became unspendable forever —
 * the game announced "N points to spend on player creation stats" and then
 * offered nowhere to spend them. The entire legacy economy was inert.
 *
 * So: the doors opening is what locks the roster. Until the first day has been
 * closed you can still set your crew up, which is true on day one of a fresh
 * world and true again the morning after a reset.
 */
export function rosterOpen(save) {
  if (!save) return false
  if (save.settings?.mode === 'sandbox') return true
  if (save.dayInProgress) return false
  return (save.economy?.history || []).length === 0
}

export function legalizeBuild(player, budgetUi) {
  const toUi = (v) => clamp(Math.round((v || 0) / STAT_UNIT), 0, STAT_MAX_POINTS)
  const pu = {}, su = {}
  for (const k of PERSONAL_KEYS) pu[k] = toUi(player.personal?.[k])
  for (const k of SOCIAL_KEYS) su[k] = toUi(player.social?.[k])

  const rowSum = (t, bag) => t.stats.reduce((s, k) => s + (bag[k] || 0), 0)
  const best = (list, bag) => list.reduce((a, b) => (rowSum(b, bag) > rowSum(a, bag) ? b : a))
  const temp = best(TEMPERAMENTS, pu)
  const soc = best(SOCIAL_TEMPERAMENTS, su)
  for (const k of temp.stats) pu[k] = Math.max(1, pu[k]) // the free row point
  for (const k of soc.stats) su[k] = Math.max(1, su[k])

  const granted = (k, bag) => (bag === pu ? temp : soc).stats.includes(k)
  const spent = () =>
    PERSONAL_KEYS.reduce((s, k) => s + pu[k], 0) + SOCIAL_KEYS.reduce((s, k) => s + su[k], 0)
    - temp.stats.length - soc.stats.length
  if (budgetUi != null) {
    let guard = 400
    while (spent() > budgetUi && guard-- > 0) {
      let bag = null, key = null, val = -1
      for (const k of PERSONAL_KEYS) { const floor = granted(k, pu) ? 1 : 0; if (pu[k] > floor && pu[k] > val) { val = pu[k]; bag = pu; key = k } }
      for (const k of SOCIAL_KEYS) { const floor = granted(k, su) ? 1 : 0; if (su[k] > floor && su[k] > val) { val = su[k]; bag = su; key = k } }
      if (!bag) break
      bag[key] -= 1
    }
  }
  player.temperament = temp.key
  player.socialTemperament = soc.key
  for (const k of PERSONAL_KEYS) player.personal[k] = pu[k] * STAT_UNIT
  for (const k of SOCIAL_KEYS) player.social[k] = su[k] * STAT_UNIT
  return player
}

/**
 * The roguelike spine: legacy points are earned by HITTING MILESTONES, not by
 * existing — a run that starts and dies banks nothing. Each key awards once per
 * run, lands a chronicle beat so the earn is felt, and pays out into prestige
 * when the run ends. Deeper runs → more points → stronger created players next
 * run. Losing is expected; the cast you can build grows anyway.
 */
// The bootstrap-rung allowance (EARLY_RUNGS, RUNG_ALLOWANCE) went to the
// deprecation lane with the rest of prestige-as-power — see docs/DEPRECATED.md
// and src/game/deprecated/rungs.js. Milestones still pay prestigePending;
// what died is points buying creation stats.

/**
 * The per-run counters that achievements are judged on.
 *
 * Achievements are mostly "did you do this WITHOUT the tool", and that is a
 * claim about a whole run, not about the state it happens to be in when a
 * check runs. A high-water mark or a never-touched flag is the only honest way
 * to ask it — you cannot read "never used idle mode" off a toggle that is
 * currently off. They live on the run, not on `prestige`, so a new run starts
 * the claim over.
 */
export function newTally() {
  return {
    // The counter
    foodSold: 0, // servings over the counter, all run
    foodRevenue: 0, // dollars taken at the counter, all run
    bestFoodNight: 0, // most servings in a single night
    // The floor
    cabinetPlays: 0, // turns taken on side cabinets
    cabinetTurnaways: 0, // people who wanted a turn and never got one
    fullFloorDays: 0, // consecutive days with four or more cabinets running
    // The books
    soloBlackDays: 0, // consecutive days with no staff AND a day that finished up
    blackStreak: 0, // consecutive days that didn't close in the red
    // The room
    peakToxicity: 0, // worst the room ever got
    peakHype: 0, // best the channel ever ran
    peakRelevance: 0, // highest national interest the game reached
    bestReception: 0, // best patch reception score landed
    evoWinYears: [], // years a player of YOURS won EVO — a dynasty is a streak here
    usedDiscipline: false, // any warning, separation or banishment
    usedAds: false, // any paid channel was ever running
    everRanked: false, // has anyone of yours EVER made the world top 64
  }
}

/** Add to a run counter (no-op on a save too old to have the bag). */
export function bump(save, key, n = 1) {
  if (!save?.tally) return
  save.tally[key] = (save.tally[key] || 0) + n
}

/** Raise a high-water counter, never lower it. */
export function bumpPeak(save, key, value) {
  if (!save?.tally) return
  if (value > (save.tally[key] || 0)) save.tally[key] = value
}

/**
 * How much a milestone pays the SECOND time a lineage reaches it.
 *
 * Milestones live on the save, so they reset with the run — which meant a
 * competent player collected the same flat stipend every single time, forever:
 * survive to year three, produce a star, win a bracket, make EVO top eight.
 * Measured, that was ~29 points a run whether the lineage was climbing or
 * treading water, and it put a fully maxed 114-point cast in your hands by the
 * fourth run with a world champion right behind it.
 *
 * Legacy points are supposed to pay for reaching somewhere NEW. So the first
 * lineage to take a player to skill 70 banks the full four; the fifth one to
 * do it banks one, because that is no longer the story of this lineage. The
 * ledger of what a lineage has ever done rides on `prestige.milestonesEver`,
 * which survives the reset the same way unlocks do.
 *
 * This is also what makes ADDING sources safe: a new milestone raises how high
 * a lineage can reach, not how much the treadmill pays.
 */
const REPEAT_SHARE = 1 / 3

/**
 * The pace of the whole legacy economy, in one number.
 *
 * Every `points` value passed to this function expresses what a milestone is
 * worth RELATIVE to the others — a bracket win against a world top 8 against
 * surviving to year three. This constant is what turns those relative worths
 * into a schedule, and it is the only thing that should move when the schedule
 * is wrong. Tuning fifteen individual awards to fix a pacing problem destroys
 * the relative ordering somebody sat down and thought about.
 *
 * It is set from the far end of the curve. A build cannot absorb more than 114
 * points (24 stats x STAT_MAX_POINTS, less the six free row points), so a
 * fully maxed cast IS the end of the legacy ladder, and how long it takes to
 * get there is the length of the whole game. At full price a competent lineage
 * banked ~30 a run and finished in four; at half it banks ~15 and finishes in
 * eight, which is where an EVO champion should live — rare, and the reward for
 * a lineage rather than a run.
 */
const LEGACY_PACE = 0.5

export function awardMilestone(save, key, points, text) {
  save.milestones ??= {}
  if (save.milestones[key]) return false
  save.milestones[key] = true
  save.prestige ??= {}
  save.prestige.milestonesEver ??= {}
  const repeat = !!save.prestige.milestonesEver[key]
  save.prestige.milestonesEver[key] = true
  const full = Math.max(1, Math.round(points * LEGACY_PACE))
  const paid = repeat ? Math.max(1, Math.round(full * REPEAT_SHARE)) : full
  save.prestigePending = (save.prestigePending || 0) + paid
  chronicle(save, '🏅', repeat
    ? `${text} (+${paid} legacy point${paid === 1 ? '' : 's'} — this lineage has been here before)`
    : `${text} (+${paid} legacy point${paid === 1 ? '' : 's'})`)
  return true
}

// Deep-clone a character under entirely fresh ids (character, moves, and the
// combo routes that reference them) — for importing a roster file into a game
// that already contains some of the same ids.
export function cloneCharacterFresh(char) {
  const c = structuredClone(char)
  c.id = uid('char')
  reskinFresh(c)
  const moveIdMap = {}
  for (const m of c.moves || []) {
    const fresh = uid('move')
    moveIdMap[m.id] = fresh
    m.id = fresh
  }
  for (const combo of c.combos || []) {
    combo.id = uid('combo')
    combo.moveIds = (combo.moveIds || []).map((id) => moveIdMap[id] || id)
  }
  return c
}

/**
 * The next free "<name> 2", "<name> 3"… so duplicating twice doesn't produce
 * two characters with the same name (players main them BY NAME in the codex
 * and the feed, and two Volts read as a bug).
 */
function nextFreeName(name, taken) {
  const base = String(name ?? 'Fighter').replace(/\s+\d+$/, '').trim() || 'Fighter'
  for (let n = 2; n < 500; n++) {
    const candidate = `${base} ${n}`
    if (!taken.has(candidate)) return candidate
  }
  return `${base} ${uid('n').slice(-4)}`
}

/**
 * A character cloned under entirely fresh ids, plus anything that only makes
 * sense alongside it. Returns { characters, id } for the caller to append —
 * pure, so the ids are decided once rather than inside a state updater.
 *
 * FORMS COME WITH IT. A copy of a form origin that still pointed at the
 * ORIGINAL's forms would be quietly broken: `formSwitchMoves` only accepts a
 * target belonging to that same character, so the duplicate's transformation
 * would resolve to nothing and the move would sit in the kit doing nothing.
 * Cloning the forms and repointing `becomes` keeps the copy a working unit.
 *
 * Duplicating a FORM instead just gives you a second form of the same origin.
 * Nothing switches into it yet, which the editor already flags — that's a
 * to-do the designer can see, not a silent failure.
 */
export function duplicateCharacter(game, charId) {
  const src = (game.characters || []).find((c) => c.id === charId)
  if (!src) return null
  const taken = new Set((game.characters || []).map((c) => c.name))
  const copy = cloneCharacterFresh(src)
  copy.name = nextFreeName(src.name, taken)
  taken.add(copy.name)

  const characters = [copy]
  const formIdMap = {}
  for (const form of formsOf(game, charId)) {
    const clone = cloneCharacterFresh(form)
    clone.name = nextFreeName(form.name, taken)
    clone.formOf = copy.id
    taken.add(clone.name)
    formIdMap[form.id] = clone.id
    characters.push(clone)
  }
  for (const m of copy.moves || []) {
    if (m.type === FORM_MOVE_TYPE && m.d?.becomes) {
      m.d = { ...m.d, becomes: formIdMap[m.d.becomes] ?? null }
    }
  }
  // …and the way back. A cloned form's return move still points at the
  // ORIGINAL origin, which would send the copy's transformation home to
  // somebody else's character.
  for (const clone of characters.slice(1)) {
    for (const m of clone.moves || []) {
      if (m.type === FORM_MOVE_TYPE && m.d?.becomes === src.id) {
        m.d = { ...m.d, becomes: copy.id }
      }
    }
  }
  return { characters, id: copy.id, formCount: characters.length - 1 }
}

export function newTeam(partial = {}) {
  return {
    id: uid('team'),
    name: 'New Team',
    acronym: 'NT',
    founderId: null,
    memberIds: [],
    foundedDay: 0,
    history: [], // {day, year, text} — joins, departures, wins, milestones
    ...partial,
  }
}

export function newTournamentEntry(partial = {}) {
  return {
    id: uid('tourney'),
    name: 'Weekly Rumble',
    type: 'singles', // 'singles' | 'teams'
    format: 'single', // singles only: 'single' | 'roundrobin' | 'doubleelim'
    cadence: 'weekly', // 'weekly' | 'monthly' | 'yearly'
    weekday: 0, // 0=Sunday .. 6=Saturday (weekly cadence)
    dayOfMonth: 1, // 1..28 (monthly cadence)
    dayOfYear: 28, // 1..336 (yearly cadence)
    size: 8, // bracket size: always a power of two; cancelled if it can't fill
    // How far past the house minimum the pot is staked (POT_STAKES key).
    // The money lever, in place: a real pot pulls better fields to you and
    // keeps your own stars turning up (REVISION §0, money's new job).
    potBoost: 0,
    ...partial,
  }
}

/**
 * The revision bumped this to 2 and PRE-REVISION SAVES ARE REFUSED, not
 * migrated (decided 2026-07-29, docs/DEPRECATED.md). Migrating through a
 * change that size would mean holding dead shapes here indefinitely — the
 * exact thing the deprecation lane exists to prevent. migrateSave() from here
 * on only backfills fields added SINCE the revision. Identities in an old
 * save can still be salvaged via the main menu's cast export, which reads the
 * raw stored JSON and never migrates.
 */
export const SAVE_SCHEMA_VERSION = 2

export function newSave(partial = {}) {
  return {
    id: uid('save'),
    schemaVersion: SAVE_SCHEMA_VERSION,
    saveName: 'New Save',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    // The save-scoped random stream (see rng.js). Every engine draw advances
    // this state in place, so a run replays identically from any point. The
    // harness passes a fixed seed; the browser seeds from entropy at creation.
    rng: newRngState(),
    attention: newAttention(), // metric 6 — mutating decisions, see attention.js
    day: OPENING_DAY, // day of year, 1..336 — a run opens in mid-June
    year: 1,
    // The absolute day the doors opened. Everything asking "how old is this
    // arcade" reads runAge() against this, because day-of-year no longer
    // starts at 1. Old saves opened on January 1 and migrate to 1.
    openedAbs: OPENING_DAY,
    // Opening night has not been shown yet. Cleared the first time it plays;
    // old saves migrate to false rather than being handed a grand opening for
    // an arcade that has been trading for a year.
    grandOpening: true,
    hour: 0, // hours simulated so far in the current day
    dayInProgress: null, // live day state while the arcade is open
    settings: {
      allowGeneratedPlayers: true,
      maxGeneratedPlayers: 12,
      setups: 2,
      nameDisplay: 'alias', // 'alias' | 'fullname'
      mode: 'consequential', // 'consequential' (locked-in, costs, patch fallout) | 'sandbox' (adjust freely)
      difficulty: 'normal', // key into constants.DIFFICULTIES (consequential runs)
      // Reading aids, on by default and free forever. These deliberately are
      // NOT unlockables: the owner who most needs to be told the staff are
      // unpaid is the one with nothing banked to spend on being told. They
      // switch OFF instead, for the player who has learned the systems and
      // wants the room back. See helperOn() in constants.js.
      helpers: { tips: true, vitals: true, rumors: true },
    },
    game: {
      name: 'Untitled Fighter',
      version: '1.0',
      characters: [],
      stages: [],
      techniques: [],
      tags: [], // character tags (plain strings)
      playerTags: [], // player vibe tags (plain strings)
      matchups: {}, // "charIdA|charIdB" -> win % for the lower-sorted id (50 = even)
      rules: defaultRules(), // universal mechanics — see rules.js
    },
    gameDraft: null, // in-progress patch: a clone of game being edited in the Studio
    scheduledPatch: null, // {absDay, version, announcedAbs} — announced release date for the draft
    patches: [], // released patches: {id, version, day, year, notes, score, reception}
    patchMorale: 0, // -10..10 community feeling about the game's balance/freshness
    relevance: 55, // 0-100 national interest in the game+scene — the late-game master variable
    momentum: { state: 'steady', untilAbs: 0 }, // golden age / slump — success and failure compound
    attentionDrift: { untilAbs: 0, value: 0 }, // monthly luck-of-the-algorithm drift on relevance
    worldEffects: [], // lingering world events: [{key, untilAbs, decayMult?, rentMult?}]
    lastWorldEventAbs: 0, // pacing guard so shocks feel like events, not weather
    freshMetaUntilAbs: 0, // a hit patch opens a window where everyone piles back in
    lastRelevanceAbs: 0, // guard so relevance drifts exactly once per day
    scene: { rivalries: 0, toxic: 0, regulars: 0, rivalryIndex: 0, toxicity: 0, rivalIds: [], feudIds: [], castTopSkill: 0 }, // daily scene-health read
    // The build shipped the day the doors opened. This MUST track the opening
    // day, not day 1 of the calendar: relevance measures staleness from here,
    // so a run opening in June with this at January 1 is born 154 days stale
    // and bleeds national interest from its first night. (It did. Phase 7.)
    lastPatch: { day: OPENING_DAY, year: 1 },
    patchGames: 0, // sets played on the current build — balance data accrues from these
    chronicle: [], // the collective memory: {day, year, icon, text} — capped
    tierLists: [], // community tier lists, newest first — one lands ~a week after each patch
    guides: [], // character guides written by the scene's specialists — see guides.js
    pendingTierList: null, // {version, dueAbs} — absolute day the next list drops
    arcade: {
      name: 'The Arcade',
      location: { city: '', state: '', country: '' }, // aesthetic only, for now
      foods: [],
      otherGames: [],
      schedule: [], // newTournamentEntry()
      // $/token and tokens-per-match. What players actually judge is the two
      // MULTIPLIED (economy.costPerPlay) — a quarter token at 4 tokens a match
      // is the same dollar as a $1 token at 1, and the game treats them alike.
      prices: { token: 1, play: 1 },
      foodPrices: {}, // per-food $ price — set when stocked
      gameTokens: {}, // per-side-cabinet token cost to play — set when installed
      ads: [], // active advertising channel keys (constants.AD_CHANNELS) — weekly upkeep
      cleanliness: 80, // 0-100 — dirt accrues with traffic, staff clean it back
      streamRig: false, // camera + encoder. Bought PER RUN, never carries over — see stream.js
      letdowns: 0, // rolling share of the room let down by sellouts & cabinet lines
      crowding: 0, // rolling turned-away share — see sim.js
      closedUntilAbs: null, // absolute day the health-department shutdown lifts (null = open)
    },
    staffing: newStaffing(),
    stream: {
      channelName: 'ArcadeTV',
      followers: 0,
      hype: 0, // 0-100 channel popularity; grows with good streams
      totalStreams: 0,
      peakViewers: 0,
      fatigue: 0, // audience overexposure — climbs per daily stream, decays nightly
    },
    economy: {
      money: 500, // starting float (overridden by difficulty at save start)
      log: [], // {day, year, amount, label} — newest first, capped
      history: [], // {absDay, money, net, attendance} — one per day, capped (Manage graphs)
      lastDayMoney: null, // cash at the previous day tick (for daily net)
      todayAttendance: null, // door count for the day currently open (folded into history)
      redDays: 0, // consecutive days in the negative — the landlord is counting
      foreclosed: false, // consequential: the landlord took the keys; reset to continue
      // Settled THROUGH the opening month/week, so a run that starts in June
      // isn't back-billed for the January-to-May it was never open for. Both
      // ledgers are calendar indices, not run-age.
      lastRentMonth: Math.floor((OPENING_DAY - 1) / DAYS_PER_MONTH),
      lastUpkeepWeek: Math.floor((OPENING_DAY - 1) / 7),
    },
    rosterCollapsed: false, // legacy alias for a scene-dynamics ending; see gameOver
    // A run ends down exactly one of three funnels, and which one it was is the
    // whole post-mortem: the books (early), the room (mid), or the world losing
    // interest (late). Null while the run is alive.
    gameOver: null, // {funnel: 'economy'|'dynamics'|'opinion', title, text, day, year}
    peakAttendance: 0, // busiest night this run — the yardstick a decline is measured against
    quietDays: 0, // consecutive days the floor was effectively empty — the dynamics funnel
    fadedDays: 0, // consecutive days nobody outside cares anymore — the opinion funnel
    // Everything on this object outlives the run. `achievements` and `unlocks`
    // are the lineage's permanent record — see achievements.js — and
    // resetSaveById carries the whole thing forward.
    prestige: { points: 0, runs: 0, achievements: {}, unlocks: {}, milestonesEver: {} },
    milestones: {}, // milestone keys already earned this run (each awards once)
    prestigePending: 0, // legacy points earned THIS run — banked when the run ends
    tally: newTally(), // per-run counters the achievement checks read (reset with the run)
    unlockNotices: [], // achievement keys earned but not yet announced to the owner
    freeInstalls: {}, // attraction pack key -> one installation on the house, this run
    archives: [], // past runs preserved by reset: {run, endedDateLabel, chronicle, hallOfFame, vods, innovations}
    socialFeed: [], // fake posts about the scene — newest first, capped
    toasts: [], // the notification layer — see notify.js; dismissible everywhere
    lastWorldNo1: null, // elite/player id last seen at world #1 — change fires a toast
    travel: { nextEventAbs: 0, event: null, asks: [] }, // the ask/deny loop — see travel.js
    dismissedRumors: {}, // rumorId -> heat-when-dismissed; hides it until it re-flares
    moneyMatches: [], // {id, aId, bId, dayOfYear, year, status, winnerId}
    players: {}, // id -> player
    teams: {}, // id -> team
    mentorships: [], // {mentorId, studentId, startedDay, startedYear}
    innovations: [], // {id, name, charId|null, creatorId, day, year, xp, difficulty}
    charMilestones: [], // {charId, text, day, year} — notable moments per character
    hallOfFame: [], // tournament + EVO results
    evoRoster: [], // persistent elite CPU players
    evoLegacy: {}, // eliteId -> {titles}
    lastDayReport: null, // events from the most recent simulated day
    lastTournament: null, // full bracket/narration of most recent tournament
    // Where the player is inside the EVO broadcast, if one is playing out.
    // null = no show running. See screens/EvoWeek.jsx.
    evoWeek: null,
    // A visiting crew from one region, or null. See invasion.js.
    invasion: null,
    nextInvasionAbs: 0,
    tournamentInProgress: null, // record id while idle mode reveals a bracket match by match
    vods: [], // full tournament/EVO records kept for spoiler-free replay, newest first
    idle: newIdleState(), // idle-mode config + runtime clock
    ...partial,
  }
}

// The payroll: one wage per role (per day, per person). Individual staffers
// are lightweight — a name, a role, and possibly a player who took the job
// (working players don't play; the register doesn't watch itself).
export function newStaffing() {
  return {
    // Defaults track economy.FAIR_WAGE — the morale/quit formulas read the
    // ratio, so these two pairs must move together (see FAIR_WAGE's note).
    employeeWage: 7, // $/day per employee
    managerWage: 12, // $/day per manager
    morale: 70, // 0-100 — pay and management coverage move it
    staff: [], // {id, name, role: 'employee'|'manager', playerId|null, hiredAbs}
  }
}

// Idle mode: auto-advancing config. `running`/`lastTickAt` are the runtime
// clock; the rest is user-chosen config. See constants.IDLE_SPEEDS.
export function newIdleState() {
  return {
    enabled: false, // is the idle UI active
    running: false, // is the loop currently ticking / accruing offline time
    speed: 'fast', // key into IDLE_SPEEDS
    lastTickAt: null, // wall-clock ms of the last processed step (for catch-up)
    autoStream: {
      enabled: true,
      selector: 'closest', // 'closest' | 'best' | 'first' | 'follow'
      followId: null, // whose camera to point at when selector is 'follow'
      cadence: 'daily', // 'hourly' | 'daily' | 'weekly' | 'weekends'
      lastStreamAbsDay: null, // last absolute day an auto-stream fired (cadence gate)
    },
    awayReport: null, // {steps, daysPassed, tournaments, headlines, ...} for the welcome-back modal
  }
}

// VODs store full per-match narration + baked chat, so a single 16-player
// tournament replay is 50-80KB — the old "40 replays ≈ 100KB" assumption was
// off by ~30x and could push a save past the ~5MB localStorage quota. Bound by
// BYTES (newest kept) rather than count, with a hard ceiling as a backstop.
const VOD_CAP = 40 // hard ceiling regardless of size
const VOD_BUDGET_BYTES = 1_500_000 // keep newest replays under ~1.5MB total

// Rough serialized byte size of a JSON-able value. Good enough for budgeting —
// mostly-ASCII content means one char ≈ one byte.
function roughSize(value) {
  try {
    return JSON.stringify(value).length
  } catch {
    return 0
  }
}

// Drop the oldest VODs until the list fits both the count ceiling and the byte
// budget. The newest VOD is always kept even if it alone exceeds the budget, so
// a just-finished tournament is never discarded on the spot.
export function trimVods(save) {
  const vods = save.vods
  if (!Array.isArray(vods)) return
  if (vods.length > VOD_CAP) vods.length = VOD_CAP
  let total = 0
  for (let i = 0; i < vods.length; i++) {
    total += roughSize(vods[i])
    if (i >= 1 && total > VOD_BUDGET_BYTES) {
      vods.length = i
      break
    }
  }
}

// Record a finished tournament for spoiler-free replay. Pushes the SAME object
// reference that becomes save.lastTournament, so watching it in the Tournament
// screen and in the VOD list share one `revealed` cursor.
export function pushVod(save, record) {
  if (!save.vods) save.vods = []
  save.vods.unshift(record)
  trimVods(save)
}

// Total non-bye matches in a tournament record — used to tell whether a VOD has
// been fully watched (so the list can reveal the champion) without spoiling.
export function tournamentMatchCount(record) {
  let n = 0
  for (const round of record.rounds || []) {
    for (const m of round.matches) if (!m.bye) n += 1
  }
  return n
}

export function isVodWatched(record) {
  // Money-match VODs are a single set: watched once every line has played.
  if (record.type === 'moneymatch') {
    return (record.revealed ?? 0) >= (record.match?.narration?.length || 1)
  }
  return (record.revealed ?? 0) >= tournamentMatchCount(record)
}

export function newInnovation(partial = {}) {
  return {
    id: uid('innov'),
    name: 'New Tech',
    charId: null,
    creatorId: null,
    day: 1,
    year: 1,
    xp: 6,
    difficulty: 5,
    ...partial,
  }
}

// Matchup helpers: stored once per pair, from the perspective of the
// alphabetically-lower character id.
export function getMatchup(game, aId, bId) {
  if (aId === bId) return 50
  const [lo, hi] = aId < bId ? [aId, bId] : [bId, aId]
  const stored = game.matchups[`${lo}|${hi}`]
  if (stored == null) return 50
  return aId === lo ? stored : 100 - stored
}

export function setMatchup(game, aId, bId, winPctForA) {
  const [lo, hi] = aId < bId ? [aId, bId] : [bId, aId]
  game.matchups[`${lo}|${hi}`] = aId === lo ? winPctForA : 100 - winPctForA
}

/**
 * A defining moment a player will keep bringing up. Text should read as a
 * noun phrase ("the 3–0 upset over GodFist", "winning Sunday Showdown").
 */
// How much a moment is worth keeping. When the shelf is full it's the DULLEST
// memory that gets forgotten, not the oldest — winning EVO should still be in
// there long after a routine upset has faded.
const MEMORY_WEIGHT = {
  evo: 100, moneymatch: 70, tournament: 60, upset: 40, team: 35, retire: 90, witness: 25,
  eureka: 75, // a breakthrough is among the largest things that happens to a person here
}
const MEMORY_CAP = 12

/**
 * Record a defining moment. `subjectIds` are the OTHER people it involves —
 * that's what lets somebody bring it up when the person it's about is
 * standing right there.
 */
export function remember(save, player, kind, text, opts = {}) {
  if (!player.memories) player.memories = []
  // Lifetime count of moments written, surviving the cap below — the journal
  // (P2) will be built on this feed, and metric 7 (journal volume) needs the
  // write RATE, which a 12-slot shelf can't show.
  player.memoriesWritten = (player.memoriesWritten || 0) + 1
  player.memories.push({
    day: save.day,
    year: save.year,
    absDay: absDayOf(save.day, save.year),
    kind,
    text,
    subjectIds: opts.subjectIds || [],
    weight: opts.weight ?? MEMORY_WEIGHT[kind] ?? 30,
  })
  if (player.memories.length > MEMORY_CAP) {
    // Drop the least significant, tie-broken by age.
    let worst = 0
    for (let i = 1; i < player.memories.length; i++) {
      const a = player.memories[i]
      const b = player.memories[worst]
      if ((a.weight ?? 30) < (b.weight ?? 30)
        || ((a.weight ?? 30) === (b.weight ?? 30) && (a.absDay ?? 0) < (b.absDay ?? 0))) worst = i
    }
    player.memories.splice(worst, 1)
  }
}

/**
 * Everyone in the room remembers the big ones. A moment only the two people
 * involved recall isn't scene history — it's a stat line. Witnesses keep a
 * fainter version, from the outside.
 */
export function witnessed(save, watchers, kind, text, opts = {}) {
  for (const w of watchers || []) {
    if (!w || opts.exclude?.includes(w.id)) continue
    remember(save, w, 'witness', text, {
      subjectIds: opts.subjectIds || [],
      weight: Math.round(((MEMORY_WEIGHT[kind] ?? 30)) * 0.45),
    })
  }
}

/** A memory involving somebody who is standing here right now. */
export function memoryAbout(player, presentIds) {
  const here = new Set(presentIds)
  const hits = (player.memories || []).filter((m) => (m.subjectIds || []).some((id) => here.has(id)))
  if (!hits.length) return null
  return hits.reduce((best, m) => ((m.weight ?? 30) > (best.weight ?? 30) ? m : best))
}

/**
 * The collective memory: a moment EVERYONE will remember. Shows up in the
 * Arcade Chronicle, newest first.
 */
export function chronicle(save, icon, text) {
  if (!save.chronicle) save.chronicle = []
  save.chronicle.unshift({ day: save.day, year: save.year, icon, text })
  if (save.chronicle.length > 250) save.chronicle.pop()
}


/**
 * Bring a save up to the current schema — or refuse it.
 *
 * Pre-revision saves (no schemaVersion, or one below SAVE_SCHEMA_VERSION)
 * THROW rather than migrate: the deprecation lane took warnings, separations,
 * exhibitions, the rung allowance and the prestige power path out of the
 * schema, and carrying those shapes forward forever is exactly what the lane
 * exists to prevent. The 260-line ancestor of this function — which migrated
 * every save era back to the 24-elite world — died with that decision; it
 * lives in git history, not here.
 *
 * Everything below this guard is a REVISION-ERA backfill: fields added after
 * schema 2 get their ??= here, and when the next big break comes, the version
 * bumps and this list resets again.
 */
export function migrateSave(save) {
  if ((save.schemaVersion || 1) < SAVE_SCHEMA_VERSION) {
    throw new Error(
      'This save is from before the revision and cannot be opened. '
      + 'Its cast can still be salvaged from the main menu (identities and builds; run progress does not carry).')
  }
  // Seeded randomness and the attention counter arrived with the revision but
  // shortly before the schema bump, so the earliest revision-era saves may
  // lack them.
  if (!save.rng || typeof save.rng.state !== 'number') save.rng = newRngState()
  bindRng(save) // backfills below may draw (spirit rolls) — draw from the save's own stream
  save.attention ??= newAttention()
  save.toasts ??= []
  save.lastWorldNo1 ??= null
  save.travel ??= { asks: [], seen: {} }
  for (const t of save.arcade?.schedule || []) t.potBoost ??= 0
  for (const p of Object.values(save.players || {})) {
    p.memoriesWritten ??= (p.memories || []).length
    // The spirit layer and eureka spine (P1). Pre-P1 revision saves get their
    // shapes rolled now, from their own stream.
    ensureSpirit(p)
    // The journal (P2).
    p.journal ??= []
    p.journalWritten ??= 0
    p.threads ??= []
    // The road record (P4): the world ranks what it has SEEN. Saves from
    // before the circuit get rough credit for the proof they already carry —
    // an EVO title or a shelf of local trophies was witnessed by somebody.
    p.roadGames ??= Math.min(40, (p.evoTitles || 0) * 16 + (p.tournamentWins || 0) * 2 + Math.floor((p.glory || 0) / 12))
    // The other clock (P5). Pre-age saves get one rolled now, aged forward by
    // the career they have already had — somebody with 600 nights behind them
    // is not 22 — and their current skill stands as their peak.
    if (p.age == null) {
      p.age = clamp(18 + Math.floor((p.daysAttended || 0) / 168), 18, 34)
      // Rolled inline rather than via career.js rollCareerClock: career.js
      // imports model.js, and a second edge back would close a cycle (the
      // same reason repairWorld lives in the store).
      p.peakAge ??= 25 + Math.floor(rand() * 7)
      p.hangUpAge ??= p.peakAge + 4 + Math.floor(rand() * 11)
    }
    p.peakSkill ??= Math.max(0, ...Object.values(p.charSkill || {}), 0)
  }
  trimVods(save) // replay data can outgrow localStorage in any era
  return save
}
