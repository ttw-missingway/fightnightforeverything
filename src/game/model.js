import { uid, clamp } from './util.js'
import { PERSONAL_KEYS, SOCIAL_KEYS, DEFAULT_FOOD_PRICE, DEFAULT_GAME_TOKENS, DAYS_PER_MONTH, absDayOf, TEMPERAMENTS, SOCIAL_TEMPERAMENTS, STAT_UNIT, STAT_MAX_POINTS } from './constants.js'
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

export function newPlayer(partial = {}) {
  return {
    id: uid('player'),
    firstName: 'New',
    lastName: 'Player',
    alias: '',
    gender: 'non-binary',
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
    memories: [], // {day, year, kind, text} — defining moments, capped
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
    passion: 80, // 0-100 love for the game; erodes with tenure, refilled by wins/content
    belief: 0, // 0-100 earned stage composure — grows from streamed/marquee reps; the EVO "choke" factor
    popularity: 0, // 0-100 public profile — grows from being featured on stream; feeds passion
    warnings: [], // {absDay, behavior:'toxicity'|'hygiene', backfired} — disciplinary history
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
    description: p.description,
    catchphrase: p.catchphrase,
    spriteKey: p.spriteKey || null,
    createdBy: p.createdBy,
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
/**
 * The bottom rungs of the legacy ladder, and how much each is worth.
 *
 * These exist so Difficult and Master can fund their way out of themselves —
 * every other milestone is pitched at a scene that got somewhere, so those
 * tiers used to bank literally nothing and could never escape.
 *
 * They are a BOOTSTRAP ALLOWANCE, not an income. A lineage can collect
 * `RUNG_ALLOWANCE` points from them in total, ever; past that they pay zero and
 * only the real milestones count. That cap is what stops "start a run, grab the
 * cheap points, reset, repeat" from being the best way to play — measured, an
 * uncapped version beat playing properly by nearly 2x on Normal.
 */
export const EARLY_RUNGS = { 'six-weeks': 1, 'season-1': 2, 'first-trophy': 2, 'half-year': 3 }
export const RUNG_ALLOWANCE = 24

/** Rung points banked by THIS run so far. */
export function rungPointsThisRun(save) {
  return Object.keys(save.milestones || {})
    .reduce((sum, k) => sum + (EARLY_RUNGS[k] || 0), 0)
}

/** Whether the lineage has any bootstrap allowance left to spend. */
export function rungAllowanceLeft(save) {
  const spent = (save.prestige?.rungPoints || 0) + rungPointsThisRun(save)
  return Math.max(0, RUNG_ALLOWANCE - spent)
}

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

export function awardMilestone(save, key, points, text) {
  save.milestones ??= {}
  if (save.milestones[key]) return false
  save.milestones[key] = true
  save.prestigePending = (save.prestigePending || 0) + points
  chronicle(save, '🏅', `${text} (+${points} legacy point${points === 1 ? '' : 's'})`)
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
    ...partial,
  }
}

export function newSave(partial = {}) {
  return {
    id: uid('save'),
    saveName: 'New Save',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    day: 1, // day of year, 1..336
    year: 1,
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
    lastPatch: { day: 1, year: 1 },
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
      prices: { token: 1 }, // global $/token; players balk when too high for their income
      foodPrices: {}, // per-food $ price — set when stocked
      gameTokens: {}, // per-side-cabinet token cost to play — set when installed
      ads: [], // active advertising channel keys (constants.AD_CHANNELS) — weekly upkeep
      cleanliness: 80, // 0-100 — dirt accrues with traffic, staff clean it back
      streamRig: false, // camera + encoder. Bought PER RUN, never carries over — see stream.js
      letdowns: 0, // rolling share of the room let down by sellouts & cabinet lines
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
      lastRentMonth: 0, // month index rent was last settled through (0 = opening month grace)
      lastUpkeepWeek: 0, // week index upkeep was last settled through
    },
    rosterCollapsed: false, // legacy alias for a scene-dynamics ending; see gameOver
    // A run ends down exactly one of three funnels, and which one it was is the
    // whole post-mortem: the books (early), the room (mid), or the world losing
    // interest (late). Null while the run is alive.
    gameOver: null, // {funnel: 'economy'|'dynamics'|'opinion', title, text, day, year}
    peakAttendance: 0, // busiest night this run — the yardstick a decline is measured against
    quietDays: 0, // consecutive days the floor was effectively empty — the dynamics funnel
    fadedDays: 0, // consecutive days nobody outside cares anymore — the opinion funnel
    separations: [], // {key, aId, bId, untilAbs} — pairs the owner is keeping apart to cool a feud
    // Everything on this object outlives the run. `achievements` and `unlocks`
    // are the lineage's permanent record — see achievements.js — and
    // resetSaveById carries the whole thing forward.
    prestige: { points: 0, runs: 0, achievements: {}, unlocks: {} },
    milestones: {}, // milestone keys already earned this run (each awards once)
    prestigePending: 0, // legacy points earned THIS run — banked when the run ends
    tally: newTally(), // per-run counters the achievement checks read (reset with the run)
    unlockNotices: [], // achievement keys earned but not yet announced to the owner
    freeInstalls: {}, // attraction pack key -> one installation on the house, this run
    archives: [], // past runs preserved by reset: {run, endedDateLabel, chronicle, hallOfFame, vods, innovations}
    socialFeed: [], // fake posts about the scene — newest first, capped
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
    employeeWage: 10, // $/day per employee
    managerWage: 16, // $/day per manager
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
      selector: 'closest', // 'closest' | 'best' | 'first'
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
}
const MEMORY_CAP = 12

/**
 * Record a defining moment. `subjectIds` are the OTHER people it involves —
 * that's what lets somebody bring it up when the person it's about is
 * standing right there.
 */
export function remember(save, player, kind, text, opts = {}) {
  if (!player.memories) player.memories = []
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

// Fill in fields added after a save was created, so old saves keep working.
export function migrateSave(save) {
  save.hour ??= 0
  save.dayInProgress ??= null
  // A save written while the arcade was OPEN carries a live day whose shape is
  // whatever the build that wrote it used. Every map the hour loop writes into
  // has to be backfilled here, or the first match of the day dereferences
  // undefined and takes the rest of the day down with it — which is exactly
  // what `charToday` did. Setting the day to null instead would be worse: it
  // would silently discard a day the player is in the middle of.
  if (save.dayInProgress) {
    const dip = save.dayInProgress
    dip.attendeeIds ??= []
    dip.newcomers ??= []
    dip.staysUntil ??= {}
    dip.results ??= {}
    dip.gamesToday ??= {}
    dip.charToday ??= {}
    dip.hours ??= []
    dip.openingEvents ??= []
  }
  save.charMilestones ??= []
  save.stream ??= { channelName: 'ArcadeTV', followers: 0, hype: 0, totalStreams: 0, peakViewers: 0 }
  save.stream.fatigue ??= 0
  save.stream.recentChars ??= [] // rolling record of what has been broadcast (character fatigue)
  save.economy ??= { money: 500, log: [] }
  save.economy.history ??= []
  save.economy.lastDayMoney ??= save.economy.money
  save.economy.todayAttendance ??= null
  save.economy.redDays ??= 0
  save.economy.foreclosed ??= false
  // Start the recurring-bill ledgers at the CURRENT week/month so existing
  // saves aren't retroactively billed for every month they've already played.
  save.economy.lastRentMonth ??= Math.floor((absDayOf(save.day, save.year) - 1) / DAYS_PER_MONTH)
  save.economy.lastUpkeepWeek ??= Math.floor((absDayOf(save.day, save.year) - 1) / 7)
  save.socialFeed ??= []
  save.dismissedRumors ??= {}
  save.moneyMatches ??= []
  save.settings.mode ??= 'consequential'
  save.settings.difficulty ??= 'normal'
  save.arcade.prices ??= { token: 1 }
  // Per-item pricing: migrate the old single food price to per-food, default
  // side-cabinet token costs, then retire the flat food price.
  save.arcade.foodPrices ??= {}
  const legacyFoodPrice = save.arcade.prices.food ?? DEFAULT_FOOD_PRICE
  for (const f of save.arcade.foods) save.arcade.foodPrices[f] ??= legacyFoodPrice
  save.arcade.gameTokens ??= {}
  for (const g of save.arcade.otherGames) save.arcade.gameTokens[g] ??= DEFAULT_GAME_TOKENS
  save.arcade.ads ??= []
  delete save.arcade.prices.food
  save.arcade.cleanliness ??= 80
  // Old saves were streaming before the rig existed; they keep their channel.
  save.arcade.streamRig ??= true
  save.arcade.letdowns ??= 0
  save.arcade.closedUntilAbs ??= null
  save.staffing ??= newStaffing()
  save.prestige ??= { points: 0, runs: 0 }
  save.prestige.achievements ??= {}
  save.prestige.unlocks ??= {}
  save.settings.helpers ??= { tips: true, vitals: true, rumors: true }
  save.milestones ??= {}
  save.prestigePending ??= 0
  // A save that predates the counters starts them now rather than backfilling:
  // an achievement is something you did, not something the migration decided
  // you must have done at some point.
  save.tally = { ...newTally(), ...(save.tally || {}) }
  save.unlockNotices ??= []
  save.freeInstalls ??= {}
  save.rosterCollapsed ??= false
  save.momentum ??= { state: 'steady', untilAbs: 0 }
  save.attentionDrift ??= { untilAbs: 0, value: 0 }
  save.worldEffects ??= []
  save.lastWorldEventAbs ??= 0
  save.freshMetaUntilAbs ??= 0
  save.lastExhibitionAbs ??= 0
  save.arcade.crowding ??= 0
  save.gameOver ??= null
  save.peakAttendance ??= 0
  save.quietDays ??= 0
  save.fadedDays ??= 0
  // Pre-NPC saves carry a full seeded CPU cast. Those people stay exactly as
  // they are — they're already part of that run's history — but from here on
  // filler is generated on demand instead.
  for (const p of Object.values(save.players)) {
    p.npc ??= false
    p.npcLastSeenAbs ??= null
    p.temperament ??= null
    p.socialTemperament ??= null
    p.slob ??= false
    // Hygiene grew up into reliability (same slot, new meaning); the old joke
    // lives on as the `slob` quirk on the rare gross passer-through.
    if (p.social && p.social.reliability == null) {
      p.social.reliability = p.social.hygiene ?? 0
      delete p.social.hygiene
    }
    // Stats added after this player was made land at neutral — and since the
    // temperament rework, neutral is 0. Handing them 5 was two and a half
    // creation points of free investment nobody chose.
    if (p.personal) {
      p.personal.adaptation ??= 0
      p.personal.presence ??= 0
    }
    // One FAVORITE each now — tastes are identity, not a shopping list.
    if (Array.isArray(p.foods) && p.foods.length > 1) p.foods = p.foods.slice(0, 1)
    if (Array.isArray(p.otherGames) && p.otherGames.length > 1) p.otherGames = p.otherGames.slice(0, 1)
    delete p.tasteRoll
    delete p.tasteRerolled
  }
  save.separations ??= []
  save.archives ??= []
  // The origin snapshot (old "reset to first created") is retired — reset now
  // keeps the design and roster instead. Reclaim the space it doubled.
  delete save.origin
  save.game.version ??= '1.0'
  save.gameDraft ??= null
  save.scheduledPatch ??= null
  save.patches ??= []
  save.patchMorale ??= 0
  save.relevance ??= 55
  save.lastRelevanceAbs ??= 0
  save.scene ??= { rivalries: 0, toxic: 0, regulars: 0, rivalryIndex: 0, toxicity: 0, rivalIds: [], feudIds: [] }
  save.lastPatch ??= { day: save.day, year: save.year }
  save.chronicle ??= []
  save.tierLists ??= []
  save.guides ??= []
  save.pendingTierList ??= null
  // Existing saves get data credit for time already played on their build.
  save.patchGames ??= Math.min(300, ((save.year - 1) * 336 + save.day - ((save.lastPatch.year - 1) * 336 + save.lastPatch.day)) * 10)
  for (const st of save.game.stages) st.vibe ??= 'hype'
  save.settings.nameDisplay ??= 'alias'
  save.game.playerTags ??= []
  for (const p of Object.values(save.players)) {
    p.settledMain ??= !!p.mainCharId // pre-exploration players keep their mains
    p.exploredChars ??= p.mainCharId ? [p.mainCharId] : []
    // Stats added after this save was written land EMPTY, not rolled. rollStat
    // is the retired 1-10 roll (mean ~7); under the temperament point buy that
    // is three and a half free creation points on a stat nobody chose.
    p.personal.stamina ??= 0
    p.personal.composure ??= 0
    p.social.hygiene ??= 0
    // Income moved from a standalone field into the social stats (so it's
    // point-bought and capped like the rest) — carry over the old value.
    p.social.income ??= (p.income != null ? p.income : 0)
    delete p.income
    p.tasteRerolled ??= false
    p.h2h ??= {} // opponentId -> {w, l} lifetime head-to-head
    p.memories ??= []
    p.voice ??= deriveVoice(p)
    // Voice is cached on the player, so the roster of any save made before the
    // stat-scale fix is still carrying the one voice the broken thresholds
    // could produce (chill/dry/terse, for everybody). Re-derive once so the
    // fix reaches people already playing, not just new arrivals.
    if (!save.voiceRescaled) p.voice = deriveVoice(p)
    p.catchphrase ??= ''
    p.playerTags ??= []
    p.attractedPlayerTags ??= []
    p.repelledPlayerTags ??= []
    p.charRecord ??= {}
    // Existing veterans start a little worn — passion reflects their tenure.
    p.passion ??= clamp(88 - (p.daysAttended || 0) * 0.04, 40, 90)
    p.retired ??= false
    p.retiredDay ??= null
    p.retiredYear ??= null
    // Mid-game overhaul fields.
    p.pocketPicks ??= []
    p.currentInterest ??= null
    // A main that is also a pocket pick predates setMain(); switching onto a
    // character already held in reserve never cleaned the reserve list.
    if (p.mainCharId) p.pocketPicks = p.pocketPicks.filter((id) => id !== p.mainCharId)
    p.form ??= []
    p.evoTitles ??= 0
    p.belief ??= 0
    p.popularity ??= 0
    p.warnings ??= []
    p.banished ??= false
    p.banishedDay ??= null
    p.banishedYear ??= null
  }
  for (const t of Object.values(save.teams)) {
    t.history ??= []
    t.lastGrowth ??= (save.year - 1) * 336 + save.day // fresh clock on migration
  }
  // Character overhaul: legacy moves gain frame data, characters gain combos,
  // and the matchup chart is recomputed from the designs — the movesets are
  // the source of truth for power now.
  for (const game of [save.game, save.gameDraft].filter(Boolean)) {
    // Universal mechanics: a save from before they existed keeps playing by
    // the defaults, which are deliberately the behaviour it already had.
    game.rules = migrateRules(game.rules)
    for (const c of game.characters) {
      c.tags ??= []
      // Nobody was anybody's form before forms existed.
      c.formOf ??= null
      c.skins ??= []
      // Descriptor overhaul: everyone was a "normal" body before it existed,
      // so old casts keep the balance they had.
      c.vitality ??= 'normal'
      c.size ??= 'normal'
      // migrateMove backfills `d` from the hand-written numbers and re-derives
      // them, so descriptors and frame data agree from here on.
      c.moves = (c.moves || []).map(migrateMove)
      if (!c.combos) {
        c.combos = []
        for (let i = 0; i < 2; i++) {
          const combo = generateCombo(c, c.combos.map((x) => x.name))
          if (combo) c.combos.push(combo)
        }
      }
    }
    pruneForms(game)
    computeMatchups(game)
  }
  // Dialogue infrastructure: people who have already played each other are
  // NOT strangers, so seed `met` from the head-to-head record. Without this a
  // two-year save would have everyone introducing themselves again.
  for (const p of Object.values(save.players || {})) {
    p.said ??= []
    p.takes ??= []
    if (!p.met) {
      p.met = {}
      for (const [otherId, h] of Object.entries(p.h2h || {})) {
        const games = (h?.w || 0) + (h?.l || 0)
        if (games > 0) p.met[otherId] = { firstDay: 0, count: games }
      }
    }
  }
  // Set only after the loop above has re-derived every cached voice, so a crash
  // partway through does not leave half the roster on the old flat voice.
  save.voiceRescaled = true
  save.game.techniques ??= [] // dormant — designed techniques are retired
  for (const t of save.arcade.schedule) {
    t.cadence ??= 'yearly' // old entries were yearly by construction
    t.format ??= 'single'
    t.weekday ??= 0
    t.dayOfMonth ??= 1
    t.dayOfYear ??= 28
    t.size ??= 8
  }
  // Old tournament records predate progressive reveal — show them finished.
  // (A large finite number: Infinity would not survive JSON round-trips.)
  if (save.lastTournament && save.lastTournament.revealed == null) {
    save.lastTournament.revealed = 999999
  }
  save.arcade.location ??= { city: '', state: '', country: '' }
  save.vods ??= []
  trimVods(save) // existing saves may hold far more replay data than fits localStorage
  save.tournamentInProgress ??= null
  save.idle ??= newIdleState()
  save.idle.autoStream ??= newIdleState().autoStream
  return save
}
