import { uid } from './util.js'
import { PERSONAL_KEYS, SOCIAL_KEYS } from './constants.js'

export function newCharacter(partial = {}) {
  return {
    id: uid('char'),
    name: 'New Fighter',
    archetype: 'Shoto',
    difficulty: 5, // 1-10, how hard to learn
    popularity: 5, // 1-10, how likely players gravitate to them
    description: '',
    moves: [], // {id, name, type}
    tags: [], // strings from game.tags — players are attracted/repelled by these
    ...partial,
  }
}

export function newMove(partial = {}) {
  return { id: uid('move'), name: 'New Move', type: 'melee', ...partial }
}

export function newStage(partial = {}) {
  return { id: uid('stage'), name: 'New Stage', description: '', ...partial }
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
    },
    game: {
      name: 'Untitled Fighter',
      characters: [],
      stages: [],
      techniques: [],
      tags: [], // character tags (plain strings)
      playerTags: [], // player vibe tags (plain strings)
      matchups: {}, // "charIdA|charIdB" -> win % for the lower-sorted id (50 = even)
    },
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

// Fill in fields added after a save was created, so old saves keep working.
export function migrateSave(save) {
  save.hour ??= 0
  save.dayInProgress ??= null
  save.charMilestones ??= []
  save.stream ??= { channelName: 'ArcadeTV', followers: 0, hype: 0, totalStreams: 0, peakViewers: 0 }
  save.settings.nameDisplay ??= 'alias'
  save.game.playerTags ??= []
  for (const p of Object.values(save.players)) {
    p.settledMain ??= !!p.mainCharId // pre-exploration players keep their mains
    p.exploredChars ??= p.mainCharId ? [p.mainCharId] : []
    p.catchphrase ??= ''
    p.playerTags ??= []
    p.attractedPlayerTags ??= []
    p.repelledPlayerTags ??= []
    p.charRecord ??= {}
  }
  for (const t of Object.values(save.teams)) {
    t.history ??= []
  }
  for (const c of save.game.characters) {
    c.tags ??= []
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
