import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { startDay, simHour, endDay, advanceDay, whatHappensToday } from '../game/sim.js'
import { HOURS_PER_DAY, absDayOf, idleSpeedOf, weekdayOf, formatDay, difficultyOf } from '../game/constants.js'
import { runSinglesTournament, runTeamTournament, runEvo, revealState, revealNextMatch } from '../game/tournament.js'
import { buildStreamForPlayers, pickAutoStreamSetup, autoStreamAllowed } from '../game/stream.js'
import { generateEvoRoster, populateRoster } from '../game/generate.js'
import { migrateSave, newSave, newPlayer } from '../game/model.js'
import { prestigeEarned, startingBudget, arcadeBuildCost } from '../game/economy.js'
import { computeMatchups } from '../game/balance.js'
import { uid } from '../game/util.js'

const INDEX_KEY = 'fightnight:index'
const saveKey = (id) => `fightnight:save:${id}`

// How many advance-steps a single idle pass may run. Foreground ticks stay
// small (smooth UI); the offline catch-up on load may cover much more, but is
// still bounded so reopening after a very long absence can't hang the tab.
const IDLE_FOREGROUND_CAP = 200
const IDLE_CATCHUP_CAP = 2000

export function loadIndex() {
  try {
    return JSON.parse(localStorage.getItem(INDEX_KEY)) || []
  } catch {
    return []
  }
}

function writeIndex(index) {
  localStorage.setItem(INDEX_KEY, JSON.stringify(index))
}

function isQuotaExceeded(err) {
  return (
    err instanceof DOMException &&
    // 22 = QuotaExceededError (Chrome/Safari); 1014 = NS_ERROR_DOM_QUOTA_REACHED (Firefox).
    (err.code === 22 || err.code === 1014 ||
      err.name === 'QuotaExceededError' || err.name === 'NS_ERROR_DOM_QUOTA_REACHED')
  )
}

// Last-resort weight shedding when a write hits the storage quota: drop the
// oldest replay data (archived runs first, then the current run's oldest VODs).
// Replays are by far the heaviest payload, so this reclaims the most per drop.
// Returns true if something was removed and a retry is worth attempting.
function shedSaveWeight(save) {
  const archived = (save.archives || []).find((a) => (a.vods || []).length)
  if (archived) {
    archived.vods.pop()
    return true
  }
  if ((save.vods || []).length > 1) {
    save.vods.pop()
    return true
  }
  return false
}

export function persistSave(save) {
  save.updatedAt = Date.now()
  const index = loadIndex().filter((e) => e.id !== save.id)
  index.unshift({
    id: save.id,
    saveName: save.saveName,
    gameName: save.game.name,
    arcadeName: save.arcade.name,
    day: save.day,
    year: save.year,
    updatedAt: save.updatedAt,
  })
  // A too-large save must never crash the game loop. On a quota error, shed the
  // heaviest data (old replays) and retry until it fits or there's nothing left
  // to drop; only then give up quietly with a warning.
  for (;;) {
    try {
      localStorage.setItem(saveKey(save.id), JSON.stringify(save))
      writeIndex(index)
      return
    } catch (err) {
      if (isQuotaExceeded(err) && shedSaveWeight(save)) continue
      if (isQuotaExceeded(err)) {
        console.warn('Save exceeds local storage even after trimming replays — this step may not persist.', err)
        return
      }
      throw err
    }
  }
}

export function loadSaveById(id) {
  try {
    const save = JSON.parse(localStorage.getItem(saveKey(id)))
    return save ? migrateSave(save) : null
  } catch {
    return null
  }
}

export function deleteSaveById(id) {
  localStorage.removeItem(saveKey(id))
  writeIndex(loadIndex().filter((e) => e.id !== id))
}

// A player's identity, stats, and tastes survive a reset; their PROGRESS
// (elo, skills, relationships, records, teams) starts over. A main pinned
// at creation stays pinned; anything they settled into through play resets.
function resetPlayerForNewRun(p) {
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
 * Start the world over. The DESIGN survives — characters, stages, and the
 * player roster (identities and stats, progress wiped). Everything you
 * earned in play resets: patches, arcade games and food, teams, streams,
 * money. The run's history is preserved in an archive (chronicle, hall of
 * fame, VODs, innovations), and the run's fame converts to prestige points
 * for player creation. Returns { ok, prestigeGain, points }.
 */
export function resetSaveById(id) {
  const save = loadSaveById(id)
  if (!save) return { ok: false, error: 'Save not found.' }
  const prestigeGain = prestigeEarned(save)
  const runNumber = (save.prestige?.runs || 0) + 1
  const archive = {
    run: runNumber,
    endedDateLabel: formatDay(save.day, save.year),
    chronicle: save.chronicle || [],
    hallOfFame: save.hallOfFame || [],
    vods: (save.vods || []).slice(0, 12), // bounded — archives shouldn't balloon the save
    innovations: save.innovations || [],
  }

  const game = structuredClone(save.game)
  game.version = '1.0' // patches reset with the run
  const arcade = structuredClone(save.arcade)
  arcade.foods = [] // bought things don't carry over
  arcade.otherGames = []
  arcade.cleanliness = 80
  arcade.closedUntilAbs = null

  const world = newSave({
    settings: structuredClone(save.settings),
    game,
    arcade,
    evoRoster: structuredClone(save.evoRoster || []),
    prestige: { points: (save.prestige?.points || 0) + prestigeGain, runs: runNumber },
    archives: [...(save.archives || []), archive].slice(-5),
  })
  if (save.stream?.channelName) world.stream.channelName = save.stream.channelName
  if (world.settings.mode !== 'sandbox') {
    world.economy.money = difficultyOf(world).startingMoney
  }
  for (const p of Object.values(save.players)) {
    world.players[p.id] = resetPlayerForNewRun(p)
  }
  world.id = save.id
  world.saveName = save.saveName
  world.createdAt = save.createdAt
  persistSave(migrateSave(world))
  return { ok: true, prestigeGain, points: world.prestige.points }
}

// ---------- Sharing worlds ----------

/** Download a save as a portable .json file another player can import. */
export function exportSaveById(id) {
  const raw = localStorage.getItem(saveKey(id))
  if (!raw) return false
  const save = JSON.parse(raw)
  const payload = { format: 'fightnight-save', formatVersion: 1, exportedAt: Date.now(), save }
  const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${(save.saveName || 'world').replace(/[^\w\- ]+/g, '').trim() || 'world'}.fightnight.json`
  a.click()
  URL.revokeObjectURL(url)
  return true
}

/**
 * Import a save from exported file text. Accepts the wrapped export format
 * or a bare save object. The imported world always gets a FRESH id, so it
 * can never overwrite one of your own saves — sharing means copying.
 * Returns { ok: true, save } or { ok: false, error }.
 */
export function importSaveFromText(text) {
  let data
  try {
    data = JSON.parse(text)
  } catch {
    return { ok: false, error: 'That file is not valid JSON.' }
  }
  const save = data?.format === 'fightnight-save' ? data.save : data
  if (!save || typeof save !== 'object' || !save.game || !save.players || !save.arcade) {
    return { ok: false, error: 'That file does not look like a Fight Night save.' }
  }
  try {
    migrateSave(save)
  } catch {
    return { ok: false, error: 'That save could not be migrated to this version of the game.' }
  }
  save.id = uid('save')
  // The idle clock must not "catch up" across however long the file sat on
  // someone's disk — the world resumes paused.
  save.idle.running = false
  save.idle.lastTickAt = null
  save.idle.awayReport = null
  persistSave(save)
  return { ok: true, save }
}

// ---------- Day stepping (shared by manual advance and idle) ----------

/**
 * Advance the save exactly one step, mutating `next`, and return what
 * happened WITHOUT touching React or navigation. One step is: open the
 * arcade (first hour), simulate the next hour, close up (recap), or — on a
 * tournament/EVO day — run the whole event. Callers decide what to do with
 * the outcome (navigate, keep idling, etc).
 */
// A tournament caught mid-broadcast (idle mode reveals it match by match)
// needs finalizing before the day can move on: reveal whatever's left at once
// and tick the calendar. Manual advance, skip-day, and offline catch-up all
// route through here so an in-progress broadcast is never re-simulated.
function finalizeTournamentInProgress(next) {
  const id = next.tournamentInProgress
  if (!id) return null
  const rec = next.lastTournament && next.lastTournament.id === id ? next.lastTournament : null
  if (rec) {
    rec.revealed = 999999 // show the rest of the bracket instantly
    for (const v of next.vods || []) if (v.id === rec.id) v.revealed = 999999
  }
  next.tournamentInProgress = null
  advanceDay(next)
  return rec
}

function stepSave(next) {
  // An idle broadcast left half-revealed: finish it and move on.
  if (next.tournamentInProgress) {
    const rec = finalizeTournamentInProgress(next)
    return { type: 'tournament', record: rec }
  }
  if (!next.dayInProgress) {
    const today = whatHappensToday(next)
    if (today === 'evo' || today) {
      const res = today === 'evo'
        ? runEvo(next)
        : today.type === 'teams' ? runTeamTournament(next, today) : runSinglesTournament(next, today)
      if (res.ok) {
        advanceDay(next)
        return { type: 'tournament', record: res.record }
      }
      // Tournament fell through — run a normal day instead.
      startDay(next)
      simHour(next)
      return { type: 'hour', notice: res.reason }
    }
    startDay(next)
    simHour(next)
    return { type: 'hour' }
  }
  if (next.hour < HOURS_PER_DAY) {
    simHour(next)
    return { type: 'hour' }
  }
  endDay(next) // produces the daily recap and ticks the calendar
  return { type: 'recap' }
}

/**
 * One idle step while the player is watching the arcade. Identical to stepSave
 * on normal days, but a tournament/EVO day plays out MATCH BY MATCH at the idle
 * tick rate instead of resolving in a single step: the first tick sims the whole
 * event (deterministic) and shows the opening match; each later tick reveals one
 * more; a final tick (once the bracket is fully shown) ticks the calendar.
 */
function idleArcadeStep(next) {
  // Mid-broadcast: reveal one more match, or finalize once it's all shown.
  if (next.tournamentInProgress) {
    const rec = next.lastTournament && next.lastTournament.id === next.tournamentInProgress
      ? next.lastTournament : null
    if (!rec) { next.tournamentInProgress = null; return stepSave(next) }
    if (revealState(rec).done) {
      // The whole bracket has been on screen for a tick — now move the day on.
      next.tournamentInProgress = null
      advanceDay(next)
      return { type: 'tournament', record: rec }
    }
    revealNextMatch(rec)
    for (const v of next.vods || []) if (v.id === rec.id) v.revealed = rec.revealed
    return { type: 'tournament-reveal', record: rec }
  }
  // Start a broadcast if today is a tournament/EVO day.
  if (!next.dayInProgress) {
    const today = whatHappensToday(next)
    if (today === 'evo' || today) {
      const res = today === 'evo'
        ? runEvo(next)
        : today.type === 'teams' ? runTeamTournament(next, today) : runSinglesTournament(next, today)
      if (res.ok) {
        const rec = res.record
        rec.revealed = 0
        revealNextMatch(rec) // open on the first match rather than an empty bracket
        for (const v of next.vods || []) if (v.id === rec.id) v.revealed = rec.revealed
        next.tournamentInProgress = rec.id
        return { type: 'tournament-reveal', record: rec }
      }
      // Tournament fell through — run a normal day instead.
      startDay(next)
      simHour(next)
      return { type: 'hour', notice: res.reason }
    }
  }
  return stepSave(next)
}

// Auto-stream one match of the hour just simulated, per the idle config, if
// the cadence allows and this hour hasn't already been streamed. Mirrors the
// manual "put this match on stream" action in the Arcade.
function maybeAutoStream(next) {
  const as = next.idle?.autoStream
  if (!as || !as.enabled) return
  const dip = next.dayInProgress
  if (!dip || !dip.hours.length) return
  const hour = dip.hours[dip.hours.length - 1]
  if (!hour || hour.streamedSetup != null) return // one stream per hour
  const absDay = absDayOf(next.day, next.year)
  if (!autoStreamAllowed(next, absDay, weekdayOf(next.day), as.cadence)) return
  const setupIndex = pickAutoStreamSetup(next, hour, as.selector)
  if (setupIndex == null) return
  const ev = hour.events.find((e) => e.type === 'match' && e.setupIndex === setupIndex)
  if (!ev || ev.stream) return
  const a = next.players[ev.aId]
  const b = next.players[ev.bId]
  if (!a || !b) return
  hour.streamedSetup = setupIndex
  ev.stream = buildStreamForPlayers(next, a, b, ev, 'daily')
  as.lastStreamAbsDay = absDay
}

/**
 * Run whatever idle time is DUE since idle.lastTickAt (mutating `next`), up to
 * `maxSteps`. Returns a summary of what happened (for the welcome-back modal),
 * or null if nothing was due / the clock was just initialised. Advances
 * idle.lastTickAt by exactly the time consumed; if the backlog exceeded
 * maxSteps, the overflow is discarded so we don't lag forever.
 */
function idleRun(next, maxSteps, revealTournaments = false) {
  const idle = next.idle
  if (!idle || next.economy?.foreclosed || next.rosterCollapsed) return null // no idling past the end of a run
  const speed = idleSpeedOf(idle.speed)
  const now = Date.now()
  if (idle.lastTickAt == null) { idle.lastTickAt = now; return null }
  const rawDue = Math.floor((now - idle.lastTickAt) / speed.ms)
  if (rawDue <= 0) return null
  const due = Math.min(rawDue, maxSteps)

  const before = {
    followers: next.stream.followers,
    hype: next.stream.hype,
    money: next.economy?.money ?? 0,
    absDay: absDayOf(next.day, next.year),
    chronicleTop: next.chronicle?.[0],
  }
  const tournaments = []
  let hoursSimmed = 0

  for (let i = 0; i < due; i++) {
    if (next.economy?.foreclosed || next.rosterCollapsed) break // the run ended mid-catch-up
    // On the arcade tab, tournaments reveal a match per tick; everywhere else
    // (and during offline catch-up) they resolve in one step.
    const outcome = revealTournaments ? idleArcadeStep(next) : stepSave(next)
    if (outcome.type === 'hour') {
      hoursSimmed += 1
      maybeAutoStream(next)
    } else if (outcome.type === 'tournament') {
      const r = outcome.record
      if (r) tournaments.push({ id: r.id, name: r.name, type: r.type, dateLabel: r.dateLabel })
    }
  }

  idle.lastTickAt = rawDue > maxSteps ? now : idle.lastTickAt + due * speed.ms

  const headlines = []
  for (const c of next.chronicle || []) {
    if (c === before.chronicleTop) break
    headlines.push(`${c.icon} ${c.text}`)
    if (headlines.length >= 8) break
  }

  return {
    steps: due,
    daysPassed: absDayOf(next.day, next.year) - before.absDay,
    hoursSimmed,
    tournaments,
    followersDelta: next.stream.followers - before.followers,
    hypeDelta: Math.round((next.stream.hype - before.hype) * 10) / 10,
    moneyDelta: Math.round((next.economy?.money ?? 0) - before.money),
    headlines,
    capped: rawDue > maxSteps,
  }
}

const StoreCtx = createContext(null)

export function StoreProvider({ children }) {
  const [save, _setSave] = useState(null)
  const saveRef = useRef(null)
  const [screen, setScreen] = useState({ name: 'menu' })
  // Latest screen, readable from the idle timer without re-arming the callback.
  const screenRef = useRef(screen)
  useEffect(() => { screenRef.current = screen }, [screen])

  const setSave = useCallback((s) => {
    saveRef.current = s
    _setSave(s)
  }, [])

  const nav = useCallback((name, params = {}) => setScreen({ name, ...params }), [])

  // All game mutations go through here: clone current save, mutate, persist.
  const mutate = useCallback((fn) => {
    const prev = saveRef.current
    if (!prev) return
    const next = structuredClone(prev)
    fn(next)
    persistSave(next)
    setSave(next)
  }, [setSave])

  const startSave = useCallback((draft) => {
    const next = structuredClone(draft)
    computeMatchups(next.game) // the designed movesets decide the chart
    // Seed the whole finite cast now — they discover the arcade over time, and
    // nobody is ever generated again. Running out of them ends the run.
    populateRoster(next)
    if (!next.evoRoster.length) next.evoRoster = generateEvoRoster(next)
    // Consequential worlds: you spent your starting budget building the
    // arcade during setup — whatever's left is your opening cash.
    if (next.settings.mode !== 'sandbox') {
      next.economy.money = Math.max(0, startingBudget(next) - arcadeBuildCost(next))
    }
    persistSave(next)
    setSave(next)
    setScreen({ name: 'arcade' })
  }, [setSave])

  const openSave = useCallback((id) => {
    const loaded = loadSaveById(id)
    if (!loaded) return
    // Offline catch-up: if idle mode was left running, sim the time that
    // elapsed while the save was closed and stash a welcome-back report.
    if (loaded.idle?.enabled && loaded.idle?.running && loaded.idle?.lastTickAt != null) {
      const report = idleRun(loaded, IDLE_CATCHUP_CAP)
      if (report && report.steps > 0) loaded.idle.awayReport = report
    }
    persistSave(loaded) // write migrations + catch-up back immediately
    setSave(loaded)
    setScreen({ name: 'arcade' })
  }, [setSave])

  const closeSave = useCallback(() => {
    setSave(null)
    setScreen({ name: 'menu' })
  }, [setSave])

  // Advance time one manual step. Tournament/EVO days jump to the tournament
  // screen; everything else stays in the arcade.
  const advance = useCallback(() => {
    const prev = saveRef.current
    if (!prev || prev.economy?.foreclosed || prev.rosterCollapsed) return // the run is over
    const next = structuredClone(prev)
    const outcome = stepSave(next)
    persistSave(next)
    setSave(next)
    setScreen(outcome.type === 'tournament'
      ? { name: 'tournament' }
      : { name: 'arcade', notice: outcome.notice })
  }, [setSave])

  // Skip straight to the daily recap: finish (or run) the whole day at once.
  const skipDay = useCallback(() => {
    const prev = saveRef.current
    if (!prev || prev.economy?.foreclosed || prev.rosterCollapsed) return
    const next = structuredClone(prev)
    let notice
    // A tournament being revealed match by match: finish the broadcast and jump
    // to its full bracket rather than re-running the day.
    if (next.tournamentInProgress) {
      finalizeTournamentInProgress(next)
      persistSave(next)
      setSave(next)
      setScreen({ name: 'tournament' })
      return
    }
    if (!next.dayInProgress) {
      const today = whatHappensToday(next)
      if (today === 'evo' || today) {
        const res = today === 'evo'
          ? runEvo(next)
          : today.type === 'teams' ? runTeamTournament(next, today) : runSinglesTournament(next, today)
        if (res.ok) {
          advanceDay(next)
          persistSave(next)
          setSave(next)
          setScreen({ name: 'tournament' })
          return
        }
        notice = res.reason
      }
      startDay(next)
    }
    while (next.hour < HOURS_PER_DAY) simHour(next)
    endDay(next)
    persistSave(next)
    setSave(next)
    setScreen({ name: 'arcade', notice })
  }, [setSave])

  // One idle pass (called on a timer while idle mode runs). Runs any due
  // steps, auto-streams, and stays put. On the arcade tab a tournament day
  // plays out match by match (live in the arcade); elsewhere it resolves at
  // once and lands in the VOD tab.
  const idleAdvance = useCallback(() => {
    const prev = saveRef.current
    if (!prev || !prev.idle?.enabled || !prev.idle?.running) return
    const next = structuredClone(prev)
    const onArcade = screenRef.current?.name === 'arcade'
    const report = idleRun(next, IDLE_FOREGROUND_CAP, onArcade)
    // Persist even when nothing was due but the clock was just initialised.
    if (report || next.idle.lastTickAt !== prev.idle?.lastTickAt) {
      persistSave(next)
      setSave(next)
    }
  }, [setSave])

  // Foreclosure (or a voluntary fresh start): archive the run, convert fame
  // to prestige, and reopen the same save as a new run.
  const resetCurrentRun = useCallback(() => {
    const prev = saveRef.current
    if (!prev) return
    const res = resetSaveById(prev.id)
    if (!res.ok) return
    const reloaded = loadSaveById(prev.id)
    setSave(reloaded)
    setScreen({
      name: 'arcade',
      notice: `♻ New run started. +${res.prestigeGain} prestige earned — ${res.points} point${res.points === 1 ? '' : 's'} to spend on player creation stats.`,
    })
  }, [setSave])

  const idleActions = useMemo(() => ({
    enableIdle: (on) => mutate((s) => {
      s.idle.enabled = on
      s.idle.running = on
      if (on) s.idle.lastTickAt = Date.now()
    }),
    setIdleRunning: (run) => mutate((s) => {
      s.idle.running = run
      if (run) s.idle.lastTickAt = Date.now() // don't count paused time
    }),
    setIdleSpeed: (key) => mutate((s) => {
      s.idle.speed = key
      s.idle.lastTickAt = Date.now() // restart the clock so a speed change can't burst
    }),
    setAutoStream: (patch) => mutate((s) => { Object.assign(s.idle.autoStream, patch) }),
    dismissAwayReport: () => mutate((s) => { s.idle.awayReport = null }),
  }), [mutate])

  const value = useMemo(() => ({
    save, screen, nav, mutate, startSave, openSave, closeSave, advance, skipDay,
    resetCurrentRun, idleAdvance, ...idleActions,
  }), [save, screen, nav, mutate, startSave, openSave, closeSave, advance, skipDay, resetCurrentRun, idleAdvance, idleActions])

  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>
}

export function useStore() {
  return useContext(StoreCtx)
}

/**
 * Drives idle mode: while running, ticks idleAdvance on an interval short
 * enough to keep the countdown live, and again whenever the tab regains
 * focus so a throttled background tab catches up promptly.
 */
export function useIdleLoop() {
  const { save, idleAdvance } = useStore()
  const running = !!(save?.idle?.enabled && save?.idle?.running)
  const speedKey = save?.idle?.speed

  useEffect(() => {
    if (!running) return
    const ms = idleSpeedOf(speedKey).ms
    const pollMs = Math.min(ms, 1000)
    const handle = setInterval(idleAdvance, pollMs)
    const onVis = () => { if (document.visibilityState === 'visible') idleAdvance() }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      clearInterval(handle)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [running, speedKey, idleAdvance])
}
