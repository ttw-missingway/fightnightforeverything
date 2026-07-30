// The instrumented run — the shared engine under every REVISION §2 metric
// script. Plays one seeded competent run day by day and samples, per in-game
// year: separation (metric 1), the elite band (§1.6's calibration target),
// first elite win (metric 2), retirements (metric 5), attention (metric 6),
// journal volume (metric 7), and money's job (metric 10). Eureka metrics
// (3, 4) are reported by eureka.mjs from the same samples — honestly zero
// until P1 builds the spine.
//
// Population note: "the world" here is the active user cast plus the elite
// roster — the ladder worldRankings() publishes. Filler NPCs are excluded on
// purpose, same as the in-game ranking. The cast-only spread is also sampled,
// because homogenisation (the disease of §0) shows up there first.

import { DAYS_PER_YEAR, absDayOf } from '../../src/game/constants.js'
import { DEFAULT_POLICY, makeRun, playDay, isDead } from './policy.mjs'

// ---------- small stats ----------
export const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0)
export const median = (xs) => quantile(xs, 0.5)
export function quantile(xs, q) {
  if (!xs.length) return 0
  const s = [...xs].sort((a, b) => a - b)
  const i = (s.length - 1) * q
  const lo = Math.floor(i)
  return s[lo] + (s[Math.min(lo + 1, s.length - 1)] - s[lo]) * (i - lo)
}
export function stddev(xs) {
  if (xs.length < 2) return 0
  const m = mean(xs)
  return Math.sqrt(xs.reduce((s, x) => s + (x - m) ** 2, 0) / (xs.length - 1))
}
const r1 = (x) => Math.round(x * 10) / 10
const r2 = (x) => Math.round(x * 100) / 100

// ---------- money classification (metric 10) ----------
// Ads are billed inside 'upkeep & restocking' (weeklyUpkeep folds them in),
// so they read as survival here. Anything unmatched lands in `other` so a new
// label can never silently vanish from the books.
const SURVIVAL = [/monthly rent/, /payroll/, /upkeep & restocking/, /machine repair/, /health-code fine/]
const COMPETITION = [/pot & trophies/, /exhibition/]
const GROWTH = [/new setup cabinet/, /hired/, /streaming setup/, /installed/, /advertis/]
function spendBucket(label) {
  if (SURVIVAL.some((re) => re.test(label))) return 'survival'
  if (COMPETITION.some((re) => re.test(label))) return 'competition'
  if (GROWTH.some((re) => re.test(label))) return 'growth'
  return 'other'
}

// ---------- population reads ----------
const bestSkillOf = (p) => Math.max(0, ...Object.values(p.charSkill || {}), 0)
const activeCast = (save) => Object.values(save.players)
  .filter((p) => !p.npc && p.createdBy === 'user' && !p.retired && !p.banished)

function worldRows(save) {
  const cast = activeCast(save).filter((p) => p.isRegular)
    .map((p) => ({ skill: bestSkillOf(p), elo: p.elo || 0 }))
  const elites = (save.evoRoster || []).map((e) => ({ skill: e.skill || 0, elo: e.elo || 0 }))
  return { cast, elites, world: [...cast, ...elites] }
}

// top-5% mean ÷ median — the separation ratio of metric 1.
function separationOf(rows, key) {
  const xs = rows.map((r) => r[key]).filter((x) => x > 0)
  if (xs.length < 4) return null
  const s = [...xs].sort((a, b) => b - a)
  const top = s.slice(0, Math.max(1, Math.ceil(s.length * 0.05)))
  const med = median(xs)
  return med > 0 ? r2(mean(top) / med) : null
}

function eliteBand(save) {
  const skills = (save.evoRoster || []).map((e) => e.skill || 0).sort((a, b) => b - a)
  const elos = (save.evoRoster || []).map((e) => e.elo || 0).sort((a, b) => b - a)
  if (!skills.length) return null
  return {
    championSkill: skills[0],
    top8MeanSkill: r1(mean(skills.slice(0, 8))),
    top64CutoffSkill: skills[Math.min(63, skills.length - 1)],
    medianSkill: r1(median(skills)),
    championElo: elos[0],
    top64CutoffElo: elos[Math.min(63, elos.length - 1)],
  }
}

function yearSnapshot(save, yearJustClosed, ctx) {
  const { cast, world } = worldRows(save)
  const castSkills = cast.map((r) => r.skill)
  const castElos = cast.map((r) => r.elo)
  return {
    year: yearJustClosed,
    alive: !isDead(save),
    castActive: cast.length,
    separation: {
      skill: separationOf(world, 'skill'),
      elo: separationOf(world, 'elo'),
    },
    cast: {
      meanSkill: r1(mean(castSkills)),
      topSkill: r1(Math.max(0, ...castSkills)),
      skillStddev: r1(stddev(castSkills)),
      meanElo: Math.round(mean(castElos)),
      eloStddev: Math.round(stddev(castElos)),
    },
    eliteBand: eliteBand(save),
    retirements: ctx.retirementsThisYear,
    // A run opens mid-June and can die mid-year, so rates are normalised by
    // the days actually played — otherwise every first and last year would
    // read as half the true cadence.
    journalPerPlayer: ctx.castYearStart.size && ctx.daysThisYear
      ? r1((ctx.journalWrittenThisYear / ctx.castYearStart.size) * (DAYS_PER_YEAR / ctx.daysThisYear))
      : 0,
    attentionPerWeek: ctx.daysThisYear ? r2(ctx.steadyThisYear / (ctx.daysThisYear / 7)) : 0,
    daysPlayed: ctx.daysThisYear,
    money: { ...ctx.moneyThisYear },
  }
}

/**
 * One seeded, instrumented run. Returns { seed, yearly, events, final }.
 * `years` is the horizon in in-game years of play (a run opens mid-year).
 */
export function instrumentedRun({ seed, difficulty = 'normal', years = 10, policy = DEFAULT_POLICY } = {}) {
  const save = makeRun({ seed, difficulty, policy })
  const userIds = new Set(Object.values(save.players).filter((p) => !p.npc && p.createdBy === 'user').map((p) => p.id))
  const isElite = (id) => typeof id === 'string' && id.startsWith('elite_')

  const yearly = []
  const events = { firstEliteWin: null, eliteWins: 0, retirementAbsDays: [] }

  let lastTournamentId = save.lastTournament?.id || null
  let lastLogHead = save.economy.log[0] || null
  let lastSteady = save.attention?.steady || 0
  let retiredSeen = new Set()

  const newYearCtx = () => ({
    retirementsThisYear: 0,
    journalWrittenThisYear: 0,
    steadyThisYear: 0,
    daysThisYear: 0,
    moneyThisYear: { survival: 0, competition: 0, growth: 0, other: 0, income: 0 },
    castYearStart: new Set(activeCast(save).map((p) => p.id)),
    journalStart: journalTotal(save),
  })
  const journalTotal = (s) => Object.values(s.players)
    .filter((p) => !p.npc && p.createdBy === 'user')
    .reduce((n, p) => n + (p.memoriesWritten || 0), 0)

  let ctx = newYearCtx()
  let year = save.year
  const horizon = years * DAYS_PER_YEAR

  for (let d = 0; d < horizon; d++) {
    playDay(save, policy)
    ctx.daysThisYear += 1

    // New tournament record? Scan it for a user player beating an elite.
    const rec = save.lastTournament
    if (rec && rec.id !== lastTournamentId) {
      lastTournamentId = rec.id
      for (const round of rec.rounds || []) {
        for (const m of round.matches || []) {
          if (m.bye || !m.winnerId) continue
          const loserId = m.winnerId === m.aId ? m.bId : m.aId
          if (userIds.has(m.winnerId) && isElite(loserId)) {
            events.eliteWins += 1
            events.firstEliteWin ??= { absDay: absDayOf(save.day, save.year), year: save.year }
          }
        }
      }
    }

    // New economy log entries since yesterday (log is newest-first, capped).
    const log = save.economy.log
    const fresh = []
    for (const entry of log) {
      if (entry === lastLogHead) break
      fresh.push(entry)
    }
    lastLogHead = log[0] || lastLogHead
    for (const entry of fresh) {
      if (entry.amount >= 0) ctx.moneyThisYear.income += entry.amount
      else ctx.moneyThisYear[spendBucket(entry.label || '')] += -entry.amount
    }

    // Attention delta (steady only — creation already excluded by definition).
    const steadyNow = save.attention?.steady || 0
    ctx.steadyThisYear += steadyNow - lastSteady
    lastSteady = steadyNow

    // Retirements, as they land.
    for (const p of Object.values(save.players)) {
      if (p.npc || p.createdBy !== 'user' || !p.retired || retiredSeen.has(p.id)) continue
      retiredSeen.add(p.id)
      ctx.retirementsThisYear += 1
      events.retirementAbsDays.push(absDayOf(p.retiredDay || save.day, p.retiredYear || save.year))
    }

    const dead = isDead(save)
    if (save.year !== year || dead || d === horizon - 1) {
      ctx.journalWrittenThisYear = journalTotal(save) - ctx.journalStart
      yearly.push(yearSnapshot(save, year, ctx))
      year = save.year
      ctx = newYearCtx()
    }
    if (dead) break
  }

  const finalCast = Object.values(save.players).filter((p) => !p.npc && p.createdBy === 'user')
  return {
    seed,
    yearly,
    events,
    final: {
      died: isDead(save),
      funnel: save.economy.foreclosed ? 'economy' : (save.gameOver?.funnel || null),
      lastedDays: absDayOf(save.day, save.year) - (save.openedAbs ?? 1) + 1,
      years: yearly.length,
      castRetired: finalCast.filter((p) => p.retired).length,
      castSize: finalCast.length,
      attentionTotal: save.attention?.total || 0,
      attentionSteady: save.attention?.steady || 0,
    },
    save,
  }
}

/**
 * Aggregate instrumented runs into the fingerprint's headline block —
 * metrics 1–7 and 10, the elite band, and the survival picture. Latency (8)
 * and recovery (9) come from their own scripts; fingerprint merges them in.
 */
export function aggregate(runs) {
  const byYear = new Map()
  for (const run of runs) {
    for (const snap of run.yearly) {
      if (!byYear.has(snap.year)) byYear.set(snap.year, [])
      byYear.get(snap.year).push(snap)
    }
  }
  const years = [...byYear.keys()].sort((a, b) => a - b)
  const perYear = years.map((y) => {
    const snaps = byYear.get(y)
    const sep = (k) => r2(mean(snaps.map((s) => s.separation[k]).filter((x) => x != null)))
    const money = { survival: 0, competition: 0, growth: 0, other: 0 }
    let spendTotal = 0
    for (const s of snaps) {
      for (const k of Object.keys(money)) money[k] += s.money[k]
      spendTotal += s.money.survival + s.money.competition + s.money.growth + s.money.other
    }
    const shares = Object.fromEntries(Object.entries(money)
      .map(([k, v]) => [k, spendTotal ? r2(v / spendTotal) : 0]))
    return {
      year: y,
      runsAlive: snaps.filter((s) => s.alive).length,
      separationSkill: sep('skill'),
      separationElo: sep('elo'),
      castMeanSkill: r1(mean(snaps.map((s) => s.cast.meanSkill))),
      castTopSkill: r1(mean(snaps.map((s) => s.cast.topSkill))),
      castSkillStddev: r1(mean(snaps.map((s) => s.cast.skillStddev))),
      castMeanElo: Math.round(mean(snaps.map((s) => s.cast.meanElo))),
      journalPerPlayer: r1(mean(snaps.map((s) => s.journalPerPlayer))),
      attentionPerWeek: r2(mean(snaps.map((s) => s.attentionPerWeek))),
      moneyShares: shares,
      retirements: r1(mean(snaps.map((s) => s.retirements))),
    }
  })

  const wins = runs.filter((r) => r.events.firstEliteWin)
  const dispersions = runs
    .map((r) => r.events.retirementAbsDays)
    .filter((ds) => ds.length >= 2)
    .map((ds) => stddev(ds))
  const bands = runs.map((r) => r.yearly.at(-1)?.eliteBand).filter(Boolean)
  const firstBands = runs.map((r) => r.yearly[0]?.eliteBand).filter(Boolean)
  const bandAgg = (bs) => bs.length ? Object.fromEntries(
    Object.keys(bs[0]).map((k) => [k, r1(mean(bs.map((b) => b[k])))])) : null

  return {
    runs: runs.length,
    survival: {
      diedShare: r2(runs.filter((r) => r.final.died).length / runs.length),
      funnels: runs.reduce((m, r) => {
        if (r.final.funnel) m[r.final.funnel] = (m[r.final.funnel] || 0) + 1
        return m
      }, {}),
      medianLastedDays: Math.round(median(runs.map((r) => r.final.lastedDays))),
    },
    perYear,
    firstEliteWin: {
      share: r2(wins.length / runs.length),
      medianYear: wins.length ? median(wins.map((r) => r.events.firstEliteWin.year)) : null,
    },
    eureka: {
      // The spine does not exist yet. These are the baseline's honest zeros —
      // P1 either moves them or is not finished.
      breakthroughsPerPlayerYear: 0,
      breakthroughShare: 0,
      burnoutShare: r2(mean(runs.map((r) => r.final.castSize ? r.final.castRetired / r.final.castSize : 0))),
    },
    retirementDispersion: {
      meanStddevDays: dispersions.length ? Math.round(mean(dispersions)) : null,
      runsMeasured: dispersions.length,
    },
    eliteBand: { year1: bandAgg(firstBands), final: bandAgg(bands) },
  }
}
