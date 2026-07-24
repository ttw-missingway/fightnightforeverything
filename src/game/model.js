import { uid, rollStat, clamp } from './util.js'
import { PERSONAL_KEYS, SOCIAL_KEYS, DEFAULT_FOOD_PRICE, DEFAULT_GAME_TOKENS, DAYS_PER_MONTH, absDayOf } from './constants.js'
import { deriveVoice } from './dialogue.js'
import { generateMoveData, migrateMove, generateCombo } from './design.js'
import { computeMatchups } from './balance.js'

export function newCharacter(partial = {}) {
  return {
    id: uid('char'),
    name: 'New Fighter',
    archetype: 'Shoto',
    spriteKey: null, // pixel-art sprite name (null = auto-pick by archetype)
    difficulty: 5, // 1-10, how hard to learn
    popularity: 5, // 1-10, how likely players gravitate to them
    description: '',
    moves: [], // full movelist with frame data — see design.js
    combos: [], // {id, name, moveIds} — named routes, used in narration
    tags: [], // strings from game.tags — players are attracted/repelled by these
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
    personal: blankStats(PERSONAL_KEYS),
    social: blankStats(SOCIAL_KEYS), // includes `income` — spending money they walk in with
    defaultMood: 5,
    mood: 5,
    elo: 1200,
    glory: 0,
    respect: 0,
    mainCharId: null, // current character (rotates daily while exploring)
    pocketPicks: [], // secondary charIds they'll counterpick with in bad matchups
    settledMain: false, // false = still trying characters out before committing
    exploredChars: [], // charIds tried during the exploration phase
    lockedMain: false, // user pinned the main; sim won't switch it
    charSkill: {}, // charId -> 0..100
    knownTechniques: [], // technique ids (user-authored techniques)
    knownInnovations: [], // innovation ids (sim-created techniques)
    relationships: {}, // otherPlayerId -> -100..100
    h2h: {}, // otherPlayerId -> {w, l} lifetime head-to-head record
    memories: [], // {day, year, kind, text} — defining moments, capped
    voice: null, // {energy, humor, speech, quirk} — derived from stats if null
    teamId: null,
    attractedTags: [],
    repelledTags: [],
    playerTags: [], // this player's own vibe tags (from game.playerTags)
    attractedPlayerTags: [], // drawn to people with these tags
    repelledPlayerTags: [], // put off by people with these tags
    charRecord: {}, // charId -> {w, l} lifetime record on that character
    otherGames: [],
    foods: [],
    tasteRoll: null, // {foods, otherGames} snapshot of the random roll — changing tastes off this costs points
    tasteRerolled: false, // has the one free "mulligan" re-roll of tastes been used?
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
    },
    gameDraft: null, // in-progress patch: a clone of game being edited in the Studio
    scheduledPatch: null, // {absDay, version, announcedAbs} — announced release date for the draft
    patches: [], // released patches: {id, version, day, year, notes, score, reception}
    patchMorale: 0, // -10..10 community feeling about the game's balance/freshness
    relevance: 55, // 0-100 national interest in the game+scene — the late-game master variable
    lastRelevanceAbs: 0, // guard so relevance drifts exactly once per day
    scene: { rivalries: 0, toxic: 0, regulars: 0, rivalryIndex: 0, toxicity: 0, rivalIds: [], feudIds: [] }, // daily scene-health read
    lastPatch: { day: 1, year: 1 },
    patchGames: 0, // sets played on the current build — balance data accrues from these
    chronicle: [], // the collective memory: {day, year, icon, text} — capped
    tierLists: [], // community tier lists, newest first — one lands ~a week after each patch
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
    rosterCollapsed: false, // finite cast: once every player has retired/banished, the run is over
    separations: [], // {key, aId, bId, untilAbs} — pairs the owner is keeping apart to cool a feud
    prestige: { points: 0, runs: 0 }, // earned at foreclosure/reset from arcade fame; spent on player creation
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
export function remember(save, player, kind, text) {
  if (!player.memories) player.memories = []
  player.memories.push({ day: save.day, year: save.year, kind, text })
  if (player.memories.length > 12) player.memories.shift()
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
  save.charMilestones ??= []
  save.stream ??= { channelName: 'ArcadeTV', followers: 0, hype: 0, totalStreams: 0, peakViewers: 0 }
  save.stream.fatigue ??= 0
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
  save.arcade.closedUntilAbs ??= null
  save.staffing ??= newStaffing()
  save.prestige ??= { points: 0, runs: 0 }
  save.rosterCollapsed ??= false
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
  save.pendingTierList ??= null
  // Existing saves get data credit for time already played on their build.
  save.patchGames ??= Math.min(300, ((save.year - 1) * 336 + save.day - ((save.lastPatch.year - 1) * 336 + save.lastPatch.day)) * 10)
  for (const st of save.game.stages) st.vibe ??= 'hype'
  save.settings.nameDisplay ??= 'alias'
  save.game.playerTags ??= []
  for (const p of Object.values(save.players)) {
    p.settledMain ??= !!p.mainCharId // pre-exploration players keep their mains
    p.exploredChars ??= p.mainCharId ? [p.mainCharId] : []
    p.personal.stamina ??= rollStat() // stats added later; varied, not uniform
    p.personal.composure ??= rollStat()
    p.social.hygiene ??= rollStat()
    // Income moved from a standalone field into the social stats (so it's
    // point-bought and capped like the rest) — carry over the old value.
    p.social.income ??= (p.income != null ? p.income : rollStat())
    delete p.income
    p.tasteRerolled ??= false
    p.h2h ??= {} // opponentId -> {w, l} lifetime head-to-head
    p.memories ??= []
    p.voice ??= deriveVoice(p)
    p.catchphrase ??= ''
    p.playerTags ??= []
    p.attractedPlayerTags ??= []
    p.repelledPlayerTags ??= []
    p.charRecord ??= {}
    p.tasteRoll ??= { foods: [...(p.foods || [])], otherGames: [...(p.otherGames || [])] }
    // Existing veterans start a little worn — passion reflects their tenure.
    p.passion ??= clamp(88 - (p.daysAttended || 0) * 0.04, 40, 90)
    p.retired ??= false
    p.retiredDay ??= null
    p.retiredYear ??= null
    // Mid-game overhaul fields.
    p.pocketPicks ??= []
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
    for (const c of game.characters) {
      c.tags ??= []
      c.moves = (c.moves || []).map(migrateMove)
      if (!c.combos) {
        c.combos = []
        for (let i = 0; i < 2; i++) {
          const combo = generateCombo(c, c.combos.map((x) => x.name))
          if (combo) c.combos.push(combo)
        }
      }
    }
    computeMatchups(game)
  }
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
