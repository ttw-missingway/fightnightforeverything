// ERAS — Act 3, and the reason a lineage can outlive a game (REVISION §0, P5).
//
// The relevance slope is deliberately unwinnable. Every tool in the game buys
// TIME against it and nothing stops it: "decline is inevitable, and everything
// you do decides WHEN, not WHETHER" (relevance.js). That tenet stays exactly
// as it is. What was missing is what happens at the bottom of the slope.
//
// Measured before this file existed: every single competent run died between
// year 4 and year 6, with a healthy cast, money in the bank and a full room —
// killed purely by the world losing interest in the GAME. That is the right
// pressure producing the wrong ending. §0 is explicit that late failure must
// be **recoverable at cost**: "a collapsed dynasty resets you to Act 1
// conditions with a famous name."
//
// So a scene that has actually achieved something does not die when its game
// does. The game dies. A sequel lands, the world's attention resets, and
// everyone's hands go back to zero — which is the truest thing this genre
// does to its own history. Your arcade carries its NAME across; it carries
// almost nothing else.
//
// This is what makes Act 3 mechanical rather than thematic. When the sequel
// drops, the veterans who made your name are the people least able to relearn
// a game — knowledge transfers, execution does not — and the ones past their
// hang-up age walk away instead of starting over. "Did you build the next
// generation while you were winning?" stops being a question the fiction asks
// and becomes one the save file answers.

import { clamp, rand, randInt, choice, displayName } from './util.js'
import { absDayOf, DAYS_PER_YEAR } from './constants.js'
import { chronicle } from './model.js'
import { computeMatchups } from './balance.js'
import { writeJournal } from './journal.js'
import { pushToast } from './notify.js'
import { careerStageOf, yearsPastPeak } from './career.js'
import { GAME_TITLE_PARTS } from './names.js'

export const newEraState = (abs) => ({ n: 1, startAbs: abs, titles: [], base: null, peakRel: 0 })

export const eraOf = (save) => (save.era ??= newEraState(save.openedAbs ?? 1))

/**
 * Running totals of everything that counts as a famous name, right now.
 * Scored as a DELTA against the era's opening snapshot (see eraLegacyScore)
 * so every era has to earn its own sequel. Without that, the first world
 * title would buy immortality and §0's "failure never becomes impossible"
 * would quietly stop being true from year six onward.
 */
function legacyTotals(save) {
  const cast = Object.values(save.players).filter((p) => !p.npc)
  return {
    evo: cast.reduce((n, p) => n + (p.evoTitles || 0), 0),
    majors: (save.hallOfFame || []).filter((r) => r.circuitKind === 'major'
      && (r.arcadeResults || []).some((a) => a.place === 1)).length,
    local: cast.reduce((n, p) => n + (p.tournamentWins || 0), 0),
  }
}

/** Called every day: the high-water mark of THIS era's relevance. */
export function noteEraRelevance(save) {
  const era = eraOf(save)
  era.base ??= legacyTotals(save)
  era.peakRel = Math.max(era.peakRel || 0, save.relevance ?? 0)
}

/** How long the CURRENT game has been out, in years. Not the arcade's age. */
export function eraAgeYears(save) {
  const era = save.era
  const start = era?.startAbs ?? (save.openedAbs ?? 1)
  return Math.max(0, absDayOf(save.day, save.year) - start) / DAYS_PER_YEAR
}

/**
 * Has this scene earned a second act?
 *
 * The famous name is the entry fee, and it has to be a real one. A first-year
 * room that never won anything and let the game rot must still be allowed to
 * fail — Act 1 failure is the whole tension of the early game, and a free
 * continue would delete it. What counts is evidence the wider world knows who
 * you are: titles, a stretch at the top of the conversation, or simply years
 * of being a place that mattered.
 */
export function eraLegacyScore(save) {
  const era = eraOf(save)
  const now = legacyTotals(save)
  const base = era.base || { evo: 0, majors: 0, local: 0 }
  const evo = now.evo - base.evo
  const majors = now.majors - base.majors
  const local = now.local - base.local
  const peakRel = era.peakRel ?? save.relevance ?? 0
  return evo * 40 + majors * 18 + Math.min(30, local) + Math.max(0, peakRel - 70) * 1.2
}

export const ERA_LEGACY_BAR = 45 // roughly: one world title, or a major and a good decade of Tuesdays

export const canBeginNewEra = (save) => eraLegacyScore(save) >= ERA_LEGACY_BAR

/** The sequel's name. Numbered after the first, because that is how this goes. */
function sequelTitle(save, n) {
  const base = (save.game.name || 'the game').replace(/\s+(\d+|II|III|IV|V|VI)$/i, '')
  if (n === 2) return `${base} ${choice(['2', 'II', 'Ultra', 'Rebirth'])}`
  return `${base} ${n}`
}

/**
 * How much of a player crosses the gap.
 *
 * The split that makes the whole act work: KNOWLEDGE transfers and EXECUTION
 * does not. A veteran's reads, matchup notes and habits are worth something in
 * any game; their hands are worth nothing the day a new one ships. So the
 * retention curve is highest for the people whose value was always their head
 * — which is also exactly the population that veteran-tier eureka has been
 * turning into coaches and guide-writers.
 *
 * It is deliberately below 1 for everybody. The sequel has to genuinely reset
 * the competitive picture or the era is a cosmetic event and the run's second
 * act is the first act with a different noun.
 */
function retentionFor(p) {
  // Calibrated against what the WORLD keeps (0.55–0.75 for elites, below).
  // The first cut of this was 0.25–0.62 — strictly worse than the average
  // elite — which quietly meant every sequel cost your cultivated cast more
  // than it cost the people they were chasing, and nobody could ever build
  // toward the ceiling §1.6 gave them. A cast with guides, techniques and
  // deep careers is the population whose value was always knowledge, so it
  // is the population that should cross the gap best.
  const base = 0.5
  const knowledge = Math.min(0.2, (p.guidesWritten || 0) * 0.04 + (p.techniques?.length || 0) * 0.03)
  const craft = Math.min(0.1, yearsPastPeak(p) * 0.02) // old heads know how to learn a game
  return clamp(base + knowledge + craft, 0.45, 0.8)
}

/**
 * THE SEQUEL LANDS. The old game is finished; this one is new, and everything
 * competitive about the world resets around it. Returns a report the caller
 * can put on screen.
 */
export function beginNewEra(save) {
  const abs = absDayOf(save.day, save.year)
  const era = eraOf(save)
  const oldName = save.game.name
  era.titles = [...(era.titles || []), oldName]
  era.n += 1
  era.startAbs = abs
  save.game.name = sequelTitle(save, era.n)

  // The world's attention resets — but not to a stranger's. The famous name is
  // the whole prize for having built something: a legendary room starts the
  // new game already being watched, an unknown one starts it merely alive.
  const legacy = eraLegacyScore(save)
  save.relevance = clamp(52 + Math.min(28, legacy * 0.18), 45, 84)
  // The new era's own books open here: it must earn its OWN sequel, so the
  // achievement baseline and the relevance high-water mark both reset.
  era.base = legacyTotals(save)
  era.peakRel = save.relevance
  save.momentum = { state: 'steady', untilAbs: 0, nextGoldenAbs: 0 }
  save.fadedDays = 0
  save.quietDays = 0
  save.attentionDrift = { untilAbs: 0, value: 0 }
  // A brand-new build is not a stale one.
  save.lastPatch = { day: save.day, year: save.year }
  save.patchGames = 0

  // A sequel is a different game. The matchup chart is redrawn, which resets
  // the meta everyone had solved and makes the tier list worth reading again.
  for (const c of save.game.characters || []) {
    for (const m of c.moves || []) if (m.d) m.d = { ...m.d }
  }
  save.game.matchups = computeMatchups(save.game)
  save.charMilestones = []

  // ---- The cast: relearn, or don't ----
  const retiredNames = []
  const carriedNames = []
  for (const p of Object.values(save.players)) {
    if (p.retired || p.banished) continue
    const stage = careerStageOf(p)
    // THE SUCCESSION MOMENT. Starting a whole game over is a young person's
    // errand. The further past their peak they are, the likelier this is the
    // moment they decide they have had a good run — and if the whole cast is
    // in that position, the room empties exactly as §0 warns it will.
    const past = yearsPastPeak(p)
    const quitOdds = clamp((past - 1) * 0.12 + ((p.age ?? 22) >= (p.hangUpAge ?? 36) ? 0.45 : 0), 0, 0.92)
    if (past > 0 && rand() < quitOdds) {
      p.retired = true
      p.retiredDay = save.day
      p.retiredYear = save.year
      p.retiredVia = 'era' // declined to learn a whole new game — not burnout
      if (p.teamId && save.teams[p.teamId]) {
        const t = save.teams[p.teamId]
        t.memberIds = t.memberIds.filter((id) => id !== p.id)
        p.teamId = null
      }
      if (!p.npc) {
        retiredNames.push(displayName(p, save))
        writeJournal(save, p, 'eraRetire', { game: oldName, next: save.game.name, always: true })
      }
      continue
    }
    const keep = retentionFor(p)
    p.peakSkill = 0
    for (const charId of Object.keys(p.charSkill || {})) p.charSkill[charId] *= keep
    p.elo = Math.round(1200 + (p.elo - 1200) * 0.35)
    p.roadGames = Math.round((p.roadGames || 0) * 0.5) // the world remembers, partly
    p.form = []
    p.charRecord = {}
    // A fresh game is the best thing that can happen to a bored veteran.
    p.passion = clamp((p.passion ?? 80) + 26, 0, 100)
    p.ageWarnedStage = null
    if (!p.npc) {
      carriedNames.push(displayName(p, save))
      writeJournal(save, p, 'eraStart', { game: save.game.name, old: oldName, always: true })
    }
  }

  // ---- The world: standings shuffle, the CEILING does not ----
  //
  // Measured the hard way. The first cut of this reset elite skill to 0.55–
  // 0.75 like everyone else, and across fifteen years of eras the world's
  // champion fell from skill 98 to 71 and the top-64 cutoff from 56 to 45 —
  // the exact failure driftEvoRoster was written to prevent ("a late lineage
  // was fighting a world its own earlier runs had worn down"). It also
  // converged metric 1 by dragging the top of the ladder down to meet a cast
  // that had not actually climbed, which is the disease wearing a disguise.
  //
  // So: the elite BAND is a calibration constant (§1.6) and a sequel does not
  // get to edit it. What a new game shuffles is who is currently on top —
  // elo — plus a dip small enough that the existing 25%-a-year band
  // regression has restored it well before the next sequel. In fiction this
  // is simply true: the best players in the world are the fastest people
  // alive at learning a fighting game, and a sequel is the thing they are
  // best at. Your cast's advantage over them is not that the world got worse.
  // NOT EVEN A DIP (P6). P5 cut this from 0.55–0.75 to a flat 0.9 after the
  // first version collapsed the world champion from skill 98 to 71. At 0.9 it
  // still compounds: band regression closes only a quarter of the gap a year,
  // eras now arrive every three, and across a fifteen-year run the champion
  // drifted 98 → 84 → 77 while metric 1's world ratio slid 1.51 → 1.27. The
  // dip was always cosmetic — what a sequel actually shuffles is who is on
  // top, which is elo. The band is a calibration constant (§1.6) and nothing
  // here touches it.
  for (const e of save.evoRoster || []) {
    e.elo = Math.round(1200 + (e.elo - 1200) * 0.55)
  }
  for (const r of save.circuit?.field || []) {
    r.skill = Math.round(r.skill * 0.85)
    r.elo = Math.round(1200 + (r.elo - 1200) * 0.5)
  }

  const report = {
    era: era.n,
    oldName,
    newName: save.game.name,
    retired: retiredNames,
    carried: carriedNames,
    relevance: Math.round(save.relevance),
    day: save.day,
    year: save.year,
  }
  save.lastEraChange = report

  chronicle(save, '🌅', `${oldName} is over. ${save.game.name} ships today, and every player on earth is a beginner again — including yours. ${save.arcade.name} has a name that carries; that is the only thing that does.`)
  if (retiredNames.length) {
    chronicle(save, '🏁', `${retiredNames.join(', ')} ${retiredNames.length === 1 ? 'is' : 'are'} not starting over. ${retiredNames.length === 1 ? 'A career' : 'Careers'} that belonged to ${oldName}, and ${retiredNames.length === 1 ? 'it ends' : 'they end'} with it.`)
  }
  pushToast(save, {
    icon: '🌅',
    text: `${save.game.name} is here. Everyone starts again — you start again with a famous room.`,
    see: { screen: 'world' },
    sticky: true,
  })
  return report
}
