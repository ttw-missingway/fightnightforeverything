import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { startDay, simHour, endDay, advanceDay, whatHappensToday } from '../game/sim.js'
import { HOURS_PER_DAY, absDayOf, idleSpeedOf, weekdayOf, formatDay, difficultyOf } from '../game/constants.js'
import { runSinglesTournament, runTeamTournament, runEvo, revealState, revealNextMatch } from '../game/tournament.js'
import { runCircuitEvent, ensureRegionalField, hostsForYear } from '../game/circuit.js'
import { buildStreamForPlayers, pickAutoStreamSetup, autoStreamAllowed } from '../game/stream.js'
import { seedWorldFeed } from '../game/socialmedia.js'
import { repairEvoRoster, generateEvoRoster, populateRoster } from '../game/generate.js'
import { migrateSave, newSave, resetPlayerForNewRun, ensureSpirit, SAVE_SCHEMA_VERSION, toStorage, fromStorage } from '../game/model.js'
import { bindRng } from '../game/rng.js'
import { prestigeEarned, startingBudget, arcadeBuildCost, seedFamilyCrew } from '../game/economy.js'
import { computeMatchups } from '../game/balance.js'
import { uid } from '../game/util.js'
import { noteDecision } from '../game/attention.js'
import { TAB_GATES, tabOpen } from '../game/tabs.js'
import { isUnlocked } from '../game/achievements.js'

const INDEX_KEY = 'fightnight:index'
const saveKey = (id) => `fightnight:save:${id}`

// How many advance-steps a single idle pass may run. Idle only advances with
// the tab open, so this just keeps each foreground tick smooth.
const IDLE_FOREGROUND_CAP = 200
// How much away-time one return can bank. At the default 'fast' speed a step
// is an in-game hour a minute, so this is a bit over two in-game months —
// enough that a weekend away is fully honoured and a month away is a long
// catch-up rather than an unbounded one.
const IDLE_AWAY_CAP = 1500

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

/**
 * Did the last write actually land? A save that silently stops persisting is
 * the worst failure this app has — the game keeps playing, every screen looks
 * right, and the moment you reload you are back where you were an hour ago.
 * It used to report itself with a console.warn, which nobody sees. This is
 * read by the banner in App.jsx.
 */
export let storageFailure = null
const subscribers = new Set()
export const onStorageFailure = (fn) => { subscribers.add(fn); return () => subscribers.delete(fn) }
function setStorageFailure(value) {
  storageFailure = value
  for (const fn of subscribers) fn(value)
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
  // to drop; only then give up — LOUDLY.
  for (;;) {
    try {
      localStorage.setItem(saveKey(save.id), JSON.stringify(toStorage(save)))
      writeIndex(index)
      if (storageFailure) setStorageFailure(null)
      return
    } catch (err) {
      if (isQuotaExceeded(err) && shedSaveWeight(save)) continue
      if (isQuotaExceeded(err)) {
        // How much of the quota this origin is holding, so the message can say
        // whether the problem is THIS save or the other worlds beside it.
        let used = 0
        let others = 0
        for (const k of Object.keys(localStorage)) {
          const n = (localStorage.getItem(k) || '').length
          used += n
          if (k.startsWith('fightnight:save:') && k !== saveKey(save.id)) others += n
        }
        setStorageFailure({
          at: Date.now(),
          usedMB: +(used / 1048576).toFixed(1),
          otherSavesMB: +(others / 1048576).toFixed(1),
          saveName: save.saveName,
        })
        console.warn('Save exceeds local storage even after trimming replays — this step did NOT persist.', err)
        return
      }
      throw err
    }
  }
}

export function loadSaveById(id) {
  try {
    const save = JSON.parse(localStorage.getItem(saveKey(id)))
    return save ? repairWorld(migrateSave(fromStorage(save))) : null
  } catch {
    return null
  }
}

/** Why a stored save can't be opened — 'pre-revision' | 'corrupt' — or null. */
export function saveRefusalReason(id) {
  const raw = localStorage.getItem(saveKey(id))
  if (!raw) return 'corrupt'
  try {
    const save = JSON.parse(raw)
    return (save.schemaVersion || 1) < SAVE_SCHEMA_VERSION ? 'pre-revision' : null
  } catch {
    return 'corrupt'
  }
}

/**
 * Salvage the cast out of a save too old to open: read the RAW stored JSON —
 * no migration, which is what makes this work on saves migrateSave refuses —
 * and download the user-created players in the same `fightnight-players`
 * format the roster editor imports. Progress is stripped on import anyway
 * (resetPlayerForNewRun), so identities and builds are exactly what survives.
 */
export function salvageCastById(id) {
  const raw = localStorage.getItem(saveKey(id))
  if (!raw) return { ok: false, error: 'Save not found.' }
  try {
    const save = JSON.parse(raw)
    const players = Object.values(save.players || {}).filter((p) => p.createdBy === 'user' && !p.npc)
    if (!players.length) return { ok: false, error: 'No user-created players in this save.' }
    downloadJson(`${fileStem(save.saveName, 'cast')}.players.fightnight.json`,
      { format: 'fightnight-players', formatVersion: 1, exportedAt: Date.now(), players })
    return { ok: true, count: players.length }
  } catch {
    return { ok: false, error: 'That save could not be read at all.' }
  }
}

/**
 * The world roster has grown twice — 24 → 64 → 80-with-full-profiles — and a
 * save can date from any era of it. repairEvoRoster does the whole job:
 * remaps bloc regions onto the country atlas, backfills gender / persona /
 * catchphrase, and tops the count up to EVO_ROSTER_SIZE. It never touches
 * alias, elo, skill or titles — these people have history attached.
 *
 * Lives here rather than in migrateSave because model.js and generate.js
 * already import each other, and adding a third edge to that cycle is asking
 * for a module-init bug nobody will enjoy finding.
 */
function repairWorld(save) {
  if (!save) return save
  if ((save.evoRoster || []).length) repairEvoRoster(save)
  // The circuit's standing state (P4): the national board and the year's
  // booked host cities exist BEFORE the first screen renders, because both
  // are minted from the save's own stream/current standings and a render must
  // never be the thing that commits them (the P3 determinism lesson). On a
  // mid-play save these are no-ops.
  if ((save.evoRoster || []).length) {
    bindRng(save)
    ensureRegionalField(save)
    hostsForYear(save, save.year)
    hostsForYear(save, save.year + 1)
  }
  // NEWLY-UNLOCKED TAB OUTLINES need a baseline, or every tab an existing save
  // already had reads as "new" the first time it loads and the whole bar
  // lights up gold — which says nothing, which is the failure mode the
  // indicator exists to avoid. Seed it with what is open RIGHT NOW so only
  // things unlocked from here forward glow. Done at load rather than in a
  // render, per the standing rule that no UI render may be the first caller
  // of anything that writes to the save.
  if (!save.seenTabs) {
    // Both gate KINDS: per-run tabs (TAB_GATES) and lineage unlocks from
    // achievements. Missing the second lit the Studio up on every existing
    // save, which is exactly the noise this is meant to prevent.
    const gated = { world: 'world', teams: 'teams', vods: 'vods', halloffame: 'halloffame', codex: 'codex', studio: 'studio' }
    save.seenTabs = ['arcade', 'players', 'manage', 'feed', 'tournament']
    for (const [tab, gate] of Object.entries(gated)) {
      const open = TAB_GATES[gate] ? tabOpen(save, gate) : isUnlocked(save, gate)
      if (open) save.seenTabs.push(tab)
    }
  }
  return save
}

export function deleteSaveById(id) {
  localStorage.removeItem(saveKey(id))
  writeIndex(loadIndex().filter((e) => e.id !== id))
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
    // Four, not twelve. An archive is a memento of a finished run; a lineage
    // keeps five of them, so twelve replays each was up to sixty tournaments of
    // dead weight riding in every single write.
    vods: (save.vods || []).slice(0, 4),
    innovations: save.innovations || [],
    // WHAT YOUR PEOPLE WON, KEPT WHERE IT CANNOT INTERFERE. Titles are wiped
    // off the players themselves (a new run is a new competitive era and
    // nobody walks in already a champion), so without this the fact that
    // somebody once took EVO would survive only as a line in the chronicle.
    // Small, flat, and read-only: the Hall of Fame's archive tab shows it.
    castHonours: Object.values(save.players)
      .filter((p) => !p.npc && p.createdBy === 'user')
      .map((p) => ({
        name: p.alias || `${p.firstName} ${p.lastName}`,
        evoTitles: p.evoTitles || 0,
        majorTitles: p.majorTitles || 0,
        tournamentWins: p.tournamentWins || 0,
        glory: Math.round(p.glory || 0),
        wins: p.wins || 0,
        losses: p.losses || 0,
        peakSkill: Math.round(Math.max(0, ...Object.values(p.charSkill || {}), 0)),
      }))
      .filter((h) => h.evoTitles || h.majorTitles || h.tournamentWins || h.glory >= 50)
      .sort((a, b) => (b.evoTitles - a.evoTitles) || (b.majorTitles - a.majorTitles) || (b.glory - a.glory)),
  }

  const game = structuredClone(save.game)
  game.version = '1.0' // patches reset with the run
  const arcade = structuredClone(save.arcade)
  arcade.foods = [] // bought things don't carry over
  arcade.otherGames = []
  arcade.cleanliness = 80
  arcade.closedUntilAbs = null
  arcade.streamRig = false // the one thing you buy again every single run

  const world = newSave({
    settings: structuredClone(save.settings),
    game,
    arcade,
    // Opening night plays again. A run-back IS an opening — same room, new
    // arcade, and the shutter going up is the cue that the last one is over.
    // (newSave defaults this to true; it is named here so a future edit to the
    // carry-over list can't quietly drop it.)
    grandOpening: true,
    // The world's people carry over; the world's TROPHY CABINET does not.
    // A run-back is a new competitive era, and the ranked names had their
    // titles reset the same way your cast does — otherwise the world board
    // opens day one already stacked with silverware won in a run that has been
    // archived, which reads as this run's history and isn't. Elo, skill and
    // persona are who they ARE and stay; titles are what they DID and go.
    evoRoster: structuredClone(save.evoRoster || []).map((e) => ({
      ...e,
      titles: 0, // the pre-split legacy field, still read as EVO by world.js
      evoTitles: 0,
      majorTitles: 0,
      fragments: [], // interviews and tweets about a season that no longer exists
    })),
    // Points are the lineage's COSMETIC currency now — the revision
    // deprecated prestige-as-power (docs/DEPRECATED.md), so nothing here buys
    // creation stats. They still accrue and still carry, because P6's
    // unlockables (palettes, sprite packs, rosters, stages) spend them.
    prestige: {
      points: (save.prestige?.points || 0) + prestigeGain,
      runs: runNumber,
      // Earned unlocks are the point of a lineage: whatever the run cost you,
      // the tools you proved you could do without are still yours. (The run
      // counters those claims were built from do NOT carry — a new run has to
      // earn the ones it hasn't got all over again.)
      achievements: structuredClone(save.prestige?.achievements || {}),
      unlocks: structuredClone(save.prestige?.unlocks || {}),
      // Everything this lineage has ever reached, so a milestone it has already
      // banked pays a fraction the next time. See awardMilestone.
      milestonesEver: structuredClone(save.prestige?.milestonesEver || {}),
    },
    archives: [...(save.archives || []), archive].slice(-5),
  })
  if (save.stream?.channelName) world.stream.channelName = save.stream.channelName
  if (world.settings.mode !== 'sandbox') {
    world.economy.money = difficultyOf(world).startingMoney
  }
  // Only YOUR cast crosses into the new run. Filler is generated on demand
  // (topUpNpcs) and a fresh scene should fill up with fresh faces rather than
  // inheriting sixty strangers from a run that already ended.
  for (const p of Object.values(save.players)) {
    if (p.npc) continue
    world.players[p.id] = resetPlayerForNewRun(p)
  }
  seedFamilyCrew(world)
  world.id = save.id
  world.saveName = save.saveName
  world.createdAt = save.createdAt
  persistSave(migrateSave(world))
  return { ok: true, prestigeGain, points: world.prestige.points }
}

// ---------- Sharing worlds ----------

/** Download any payload as a .json file (worlds, rosters, casts). */
export function downloadJson(filename, payload) {
  const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

// Safe file-name stem from a user-entered name.
export const fileStem = (name, fallback) =>
  (name || fallback).replace(/[^\w\- ]+/g, '').trim() || fallback

/** Download a save as a portable .json file another player can import. */
export function exportSaveById(id) {
  const raw = localStorage.getItem(saveKey(id))
  if (!raw) return false
  // Rehydrate the shared tournament reference before sharing — a file with a
  // dangling `lastTournamentId` would open somewhere else with no live event.
  const save = fromStorage(JSON.parse(raw))
  const payload = { format: 'fightnight-save', formatVersion: 1, exportedAt: Date.now(), save }
  downloadJson(`${fileStem(save.saveName, 'world')}.fightnight.json`, payload)
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
  const save = fromStorage(data?.format === 'fightnight-save' ? data.save : data)
  if (!save || typeof save !== 'object' || !save.game || !save.players || !save.arcade) {
    return { ok: false, error: 'That file does not look like a Fight Night save.' }
  }
  try {
    migrateSave(save)
  } catch (err) {
    // migrateSave's refusal message says what to do about it (cast salvage).
    return { ok: false, error: err?.message || 'That save could not be migrated to this version of the game.' }
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

// A run is over when any of the three funnels has closed: the books, the room,
// or the world's interest. `economy.foreclosed` predates the unified flag, so
// it's still checked directly.
export const runEnded = (s) => !!(s?.economy?.foreclosed || s?.gameOver || s?.rosterCollapsed)

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
        : today.circuit ? runCircuitEvent(next, today.circuit)
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
        : today.circuit ? runCircuitEvent(next, today.circuit)
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
  if (!idle || runEnded(next)) return null // no idling past the end of a run
  // A speed this lineage hasn't earned can't be run, however it got onto the
  // save (an older save, an import, a lineage reset). The picker greys it out;
  // this is the belt to that braces, and it applies to offline catch-up too.
  if (!isUnlocked(next, `idle-${idle.speed}`)) idle.speed = 'realtime'
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
    if (runEnded(next)) break // the run ended mid-catch-up
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
  //
  // This is also where attention (metric 6, REVISION §2.5) is measured: every
  // mutation counts as one decision unless the caller passes { ack: true } —
  // the explicit acknowledgement list (dismissing rumors and unlock notices,
  // reveal cursors, the grand-opening curtain). Review that list whenever it
  // grows. Day advancement never comes through mutate, so it is excluded by
  // construction.
  const mutate = useCallback((fn, opts = {}) => {
    const prev = saveRef.current
    if (!prev) return
    const next = structuredClone(prev)
    if (!opts.ack) noteDecision(next, opts.kind || 'ui')
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
    // Anyone who left the spirit choose-one untouched gets their shape rolled
    // now — everyone has one (REVISION §1.6); only the choosing is optional.
    for (const p of Object.values(next.players)) ensureSpirit(p)
    if (!next.evoRoster.length) next.evoRoster = generateEvoRoster(next)
    // Consequential worlds: you spent your starting budget building the
    // arcade during setup — whatever's left is your opening cash.
    if (next.settings.mode !== 'sandbox') {
      next.economy.money = Math.max(0, startingBudget(next) - arcadeBuildCost(next))
    }
    seedFamilyCrew(next) // a lineage that earned it opens with two free hands
    // The world has been running for years before you unlocked the door.
    seedWorldFeed(next)
    persistSave(next)
    setSave(next)
    // A NEW run opens on the Feed, not the Arcade. The feed is already years
    // deep in somebody else's scene (seedWorldFeed, just above) — so the first
    // thing a new owner sees is the world they are trying to get into, rather
    // than an empty room with the shutters still down. Reopening an existing
    // save still lands on the Arcade: mid-run, the floor is the job.
    setScreen({ name: 'feed' })
  }, [setSave])

  // Returns false when the save can't be opened (pre-revision or corrupt) so
  // the menu can say why instead of silently doing nothing.
  const openSave = useCallback((id) => {
    const loaded = loadSaveById(id)
    if (!loaded) return false
    // AFK CATCH-UP (§6's idle shrink). This used to stop time cold on close and
    // restart the clock on open — "the hours you were away never happened" —
    // which is a defensible stance for a game you sit and watch, and the wrong
    // one for this game. §6 calls the let-it-run mode STRUCTURAL rather than
    // quality-of-life, because P5 made a lineage twenty years long: nobody is
    // going to sit at the tab for that, and an endless dynasty that only
    // advances while observed is a dynasty nobody finishes.
    //
    // So time passes while the tab is shut, IF you left it running. Bounded by
    // IDLE_AWAY_CAP so a fortnight away is a long catch-up rather than an
    // unbounded one, and the result lands in `awayReport` for the welcome-back
    // modal instead of silently mutating the world behind you.
    if (loaded.idle) {
      loaded.idle.awayReport = null
      if (loaded.idle.enabled && loaded.idle.running && loaded.idle.lastTickAt) {
        const report = idleRun(loaded, IDLE_AWAY_CAP, false)
        if (report) loaded.idle.awayReport = report
      } else {
        loaded.idle.running = false
        loaded.idle.lastTickAt = null
      }
    }
    persistSave(loaded) // write migrations back immediately
    setSave(loaded)
    setScreen({ name: 'arcade' })
    return true
  }, [setSave])

  const closeSave = useCallback(() => {
    setSave(null)
    setScreen({ name: 'menu' })
  }, [setSave])

  // Advance time one manual step. Tournament/EVO days jump to the tournament
  // screen; everything else stays in the arcade.
  const advance = useCallback(() => {
    const prev = saveRef.current
    if (!prev || runEnded(prev)) return // the run is over
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
    if (!prev || runEnded(prev)) return
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
          : today.circuit ? runCircuitEvent(next, today.circuit)
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
    while (next.hour < HOURS_PER_DAY) { simHour(next); maybeAutoStream(next) }
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
      notice: '♻ New run started. Your crew crossed over exactly as they were — every point their breakthroughs earned, and the temperaments they grew into. The arcade starts again; they do not.',
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
      if (!isUnlocked(s, `idle-${key}`)) return
      s.idle.speed = key
      s.idle.lastTickAt = Date.now() // restart the clock so a speed change can't burst
    }),
    setAutoStream: (patch) => mutate((s) => { Object.assign(s.idle.autoStream, patch) }),
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
