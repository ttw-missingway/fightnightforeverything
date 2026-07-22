import { uid, rollStat } from './util.js'
import { PERSONAL_KEYS, SOCIAL_KEYS } from './constants.js'
import { deriveVoice } from './dialogue.js'
import { generateMoveData, migrateMove, generateCombo } from './design.js'
import { computeMatchups } from './balance.js'

export function newCharacter(partial = {}) {
  return {
    id: uid('char'),
    name: 'New Fighter',
    archetype: 'Shoto',
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
  return { id: uid('stage'), name: 'New Stage', description: '', vibe: 'hype', ...partial }
}

export function newTechnique(partial = {}) {
  return {
    id: uid('tech'),
    name: 'New Technique',
    charId: null, // null = general technique
    difficulty: 5, // 1-10 how hard to unlock
    xp: 5, // skill points granted when unlocked
    description: '',
    ...partial,
  }
}

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
    createdBy: 'user', // 'user' | 'cpu'
    personal: blankStats(PERSONAL_KEYS),
    social: blankStats(SOCIAL_KEYS),
    defaultMood: 5,
    mood: 5,
    elo: 1200,
    glory: 0,
    respect: 0,
    mainCharId: null, // current character (rotates daily while exploring)
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
    wins: 0,
    losses: 0,
    tournamentWins: 0,
    isRegular: false, // has discovered the arcade yet
    daysAttended: 0,
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
      setups: 4,
      nameDisplay: 'alias', // 'alias' | 'fullname'
      mode: 'consequential', // 'consequential' (locked-in, costs, patch fallout) | 'sandbox' (adjust freely)
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
    patches: [], // released patches: {id, version, day, year, notes, score, reception}
    patchMorale: 0, // -10..10 community feeling about the game's balance/freshness
    lastPatch: { day: 1, year: 1 },
    patchGames: 0, // sets played on the current build — balance data accrues from these
    chronicle: [], // the collective memory: {day, year, icon, text} — capped
    tierLists: [], // community tier lists, newest first — one lands ~a week after each patch
    pendingTierList: null, // {version, dueAbs} — absolute day the next list drops
    arcade: {
      name: 'The Arcade',
      foods: [],
      otherGames: [],
      schedule: [], // newTournamentEntry()
    },
    stream: {
      channelName: 'ArcadeTV',
      followers: 0,
      hype: 0, // 0-100 channel popularity; grows with good streams
      totalStreams: 0,
      peakViewers: 0,
    },
    economy: {
      money: 500, // starting float
      log: [], // {day, year, amount, label} — newest first, capped
    },
    socialFeed: [], // fake posts about the scene — newest first, capped
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
    ...partial,
  }
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
  save.economy ??= { money: 500, log: [] }
  save.socialFeed ??= []
  save.moneyMatches ??= []
  save.settings.mode ??= 'consequential'
  save.game.version ??= '1.0'
  save.gameDraft ??= null
  save.patches ??= []
  save.patchMorale ??= 0
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
    p.h2h ??= {} // opponentId -> {w, l} lifetime head-to-head
    p.memories ??= []
    p.voice ??= deriveVoice(p)
    p.catchphrase ??= ''
    p.playerTags ??= []
    p.attractedPlayerTags ??= []
    p.repelledPlayerTags ??= []
    p.charRecord ??= {}
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
  for (const t of save.game.techniques) {
    t.description ??= ''
  }
  for (const t of save.arcade.schedule) {
    t.cadence ??= 'yearly' // old entries were yearly by construction
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
  return save
}
