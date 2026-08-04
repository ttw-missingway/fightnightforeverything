// A COMPETENT PLAYER, headless.
//
// Every measurement before this one was taken against autopilot: a save that
// opens the doors and never touches a lever. That arm dies 100% of the time on
// every difficulty, which makes it useless as an instrument — you cannot see
// what removing an archetype costs a run that was going to die anyway.
//
// This plays the game the way someone who has read the tooltips plays it:
// buys the rig, stocks the counter, prices to the room, hires as the money
// allows, advertises, streams a match a day, and runs a weekly bracket. It is
// not optimal. It is competent, which is the baseline every balance question
// in Phase 7 is actually about.

// Static imports on purpose: the old `await import(`${SRC}/…`)` pattern was
// invisible to every bundler and static check, so a file move broke the
// harness silently — and Vite can now load this module for the dev suite's
// fast-forward, which a computed import path would forbid.
import { newSave, newTournamentEntry, newCharacter, newPlayer, legalizeBuild, ensureSpirit } from '../../src/game/model.js'
import { generateCharacter, populateRoster, generateEvoRoster, randomIdentity, randomPreferences } from '../../src/game/generate.js'
import {
  TEMPERAMENTS, SOCIAL_TEMPERAMENTS, STAT_UNIT, PERSONAL_KEYS, SOCIAL_KEYS,
  HOURS_PER_DAY, runAge, difficultyOf,
} from '../../src/game/constants.js'
import { computeMatchups } from '../../src/game/balance.js'
import { startDay, simHour, endDay, advanceDay, whatHappensToday } from '../../src/game/sim.js'
import { runSinglesTournament, runTeamTournament, runEvo } from '../../src/game/tournament.js'
import { runCircuitEvent } from '../../src/game/circuit.js'
import * as eco from '../../src/game/economy.js'
import { STREAM_RIG_COST } from '../../src/game/stream.js'
import { fitsBandwidth } from '../../src/game/bandwidth.js'
import { bindStream, bindRng, newRngState } from '../../src/game/rng.js'
import { noteDecision } from '../../src/game/attention.js'
import {
  DEFAULT_POLICY, autoManage, autoPatch, autoEureka, autoStreamHour,
} from '../../src/game/auto.js'

const { startingBudget, arcadeBuildCost } = eco

// The competent owner's dials live with the brain now (src/game/auto.js) and
// are re-exported here so every instrument that imports them from this module
// keeps working. Individual harnesses still spread-and-override freely —
// { ...DEFAULT_POLICY, patchEvery: 0 } and friends are the whole A/B method.
export { DEFAULT_POLICY }

/**
 * Build a world the way the setup wizard would, then apply the policy's
 * opening. Pass `seed` for a reproducible run: the save's whole stream —
 * characters, cast, roster, every day after — replays identically from it.
 */
export function makeRun({ chars = 8, difficulty = 'normal', policy = DEFAULT_POLICY, seedTweak = null, prestige = null, seed = null } = {}) {
  // Bind BEFORE newSave so even the save's own ids come off the seeded
  // stream — and so back-to-back makeRun calls can't draw from each other.
  const stream = newRngState(seed ?? undefined)
  bindStream(stream)
  const save = newSave({ saveName: 'P7', rng: stream })
  save.settings.difficulty = difficulty
  if (prestige) save.prestige = structuredClone(prestige)
  const used = new Set()
  for (let i = 0; i < chars; i++) {
    const c = newCharacter(generateCharacter(used))
    used.add(c.name)
    save.game.characters.push(c)
  }
  computeMatchups(save.game)
  if (seedTweak) seedTweak(save)

  // YOUR cast. Without these the harness measures a room full of strangers:
  // created players attend far more readily, are the only ones teams form
  // around, and are the only ones who can qualify for EVO.
  // The budget is the difficulty's alone — prestige-as-power was deprecated
  // by the revision (docs/DEPRECATED.md); a returning run never starts
  // stronger.
  const budget = difficultyOf(save).statPoints
  const rows = policy.rows || null // ablation: restrict which temperaments exist
  for (let i = 0; i < (policy.cast ?? 6); i++) {
    const p = newPlayer({ createdBy: 'user', npc: false })
    Object.assign(p, randomIdentity(save), randomPreferences(save))
    const temps = (rows?.personal || TEMPERAMENTS.map((t) => t.key))
    const socs = (rows?.social || SOCIAL_TEMPERAMENTS.map((t) => t.key))
    const t = TEMPERAMENTS.find((x) => x.key === temps[i % temps.length])
    const sr = SOCIAL_TEMPERAMENTS.find((x) => x.key === socs[i % socs.length])
    p.temperament = t.key
    p.socialTemperament = sr.key
    for (const k of t.stats) p.personal[k] = STAT_UNIT
    for (const k of sr.stats) p.social[k] = STAT_UNIT
    // Spend the allowance. Chosen rows first — that's the focused build a
    // first-run player makes — and then out into everything else, because a
    // late lineage banks well over a hundred points and a competent player
    // does not throw them away.
    //
    // This USED to cycle a ten-key pool and cap each key at five, which
    // silently discarded every point past ~50. It made all the lineage
    // measurements past run 2 re-measurements of the same build, and it is
    // why banked points looked like they did nothing.
    const order = [
      ...t.stats, ...sr.stats,
      ...PERSONAL_KEYS.filter((k) => !t.stats.includes(k)),
      ...SOCIAL_KEYS.filter((k) => !sr.stats.includes(k)),
    ]
    let left = budget
    while (left > 0) {
      const before = left
      for (const key of order) {
        if (left <= 0) break
        const bag = PERSONAL_KEYS.includes(key) ? p.personal : p.social
        if ((bag[key] || 0) >= 5 * STAT_UNIT) continue
        bag[key] = (bag[key] || 0) + STAT_UNIT
        left -= 1
      }
      if (left === before) break // everything is maxed
    }
    legalizeBuild(p, budget)
    // The third choose-one. Without this the whole cast ran spirit-less —
    // no caps, no radiance, breadth stuck at the default — and P1's
    // cap-realisation zeros were partly THIS harness bug, not the design.
    ensureSpirit(p)
    save.players[p.id] = p
    noteDecision(save, 'create-player') // coarse: one decision per person made
  }
  populateRoster(save)
  save.evoRoster = generateEvoRoster(save)

  // Opening buys, in priority order, STOPPING when the float runs out — the
  // setup wizard's BudgetBar blocks an over-spend, so a harness that ignores it
  // is measuring a player who cannot exist. A competent owner also keeps about
  // a month of costs in hand rather than spending to zero.
  const budgetTotal = startingBudget(save)
  const RESERVE = 0.32 // fraction of the budget kept as opening float
  const spendable = budgetTotal * (1 - RESERVE)
  save.settings.setups = 1
  save.arcade.foods = []
  save.arcade.otherGames = []
  const cost = () => arcadeBuildCost(save)
  const afford = (fn, undo) => { fn(); if (cost() > spendable) { undo(); return false } return true }

  // 1. A second setup: more matches an hour is the core of everything.
  afford(() => { save.settings.setups = 2 }, () => { save.settings.setups = 1 })
  // 2. Food: cheap, and the second income stream.
  const FOODS = ['nachos', 'pretzels', 'hot dogs', 'slushies', 'energy drinks']
  for (const f of FOODS.slice(0, policy.foods)) {
    afford(() => { save.arcade.foods.push(f) }, () => { save.arcade.foods.pop() })
  }
  for (const f of save.arcade.foods) save.arcade.foodPrices[f] = policy.foodPrice
  save.arcade.prices.token = policy.tokenPrice
  save.arcade.prices.play = policy.playTokens ?? 1
  // 3. Side cabinets: expensive, and the first thing to skip when money is tight.
  const CABS = ['Puzzle Blitz', 'Rhythm Storm', 'Air Hockey', 'Crane Game']
  for (const g of CABS.slice(0, policy.cabinets)) {
    afford(() => { save.arcade.otherGames.push(g) }, () => { save.arcade.otherGames.pop() })
  }
  for (const g of save.arcade.otherGames) save.arcade.gameTokens[g] = 1

  save.economy.money = Math.max(0, budgetTotal - cost())
  // 4. The rig, out of the remaining float rather than the build budget.
  if (policy.rig && save.economy.money >= STREAM_RIG_COST * 1.6) {
    save.economy.money -= STREAM_RIG_COST
    save.arcade.streamRig = true
  }
  if (policy.weekly) {
    const e = newTournamentEntry({ name: 'Weekly', type: 'singles', cadence: 'weekly', weekday: 0, size: policy.weekly })
    if (fitsBandwidth(save, e)) save.arcade.schedule.push(e)
  }
  if (policy.monthly) {
    const e = newTournamentEntry({ name: 'Monthly', type: 'singles', format: 'doubleelim', cadence: 'monthly', dayOfMonth: 14, size: policy.monthly })
    if (fitsBandwidth(save, e)) save.arcade.schedule.push(e)
  }
  eco.seedFamilyCrew(save)
  // Setup buys, coarsely: cabinets + foods + prices + rig + schedule. All of
  // this lands in attention.total and none in steady — the doors aren't open.
  const setupChoices = 1 + save.arcade.foods.length + 1 + save.arcade.otherGames.length
    + (save.arcade.streamRig ? 1 : 0) + save.arcade.schedule.length
  for (let i = 0; i < setupChoices; i++) noteDecision(save, 'setup-buy')
  return save
}

// THE BRAIN MOVED (src/game/auto.js). Every decision this harness used to
// make itself — hiring, the rig, ads, growing and shrinking the floor, the
// road, succession, pots, attractions, patches, breakthroughs — now lives in
// the engine, because spectator mode needs the same competent owner and two
// copies would drift. The day they drifted, this harness would stop measuring
// the game the player actually gets.
//
// The harness runs at FULL AUTHORITY on the reversible-with-money moves:
// downsizing is not a default for a player who will take the wheel back, but a
// headless competent owner absolutely lays people off and sells cabinets
// rather than foreclosing, and P6 measured exactly that. It still does not
// banish or close the setups on its own — recovery.mjs reaches for those
// deliberately, which is the point of a counterplay instrument.
const HARNESS_AUTHORITY = { eureka: true, downsize: true, banish: false, hiatus: false }
const harnessOpts = { authority: HARNESS_AUTHORITY }

const manage = (save, policy) => autoManage(save, policy, harnessOpts)
export const maybePatch = (save, policy) => autoPatch(save, policy, harnessOpts)

/** One day, played. Streams a match if the policy says to and the rig exists. */
export function playDay(save, policy = DEFAULT_POLICY) {
  // Bind FIRST. The management phase below draws (hires mint ids, travel
  // answers write journal lines) before any engine entry point rebinds — and
  // a draw against a stale stream is invisible in one process but splits a
  // serialize-and-resume from an uninterrupted run.
  bindRng(save)
  const today = whatHappensToday(save)
  if (today === 'evo') { runEvo(save); advanceDay(save); return }
  if (today?.circuit) {
    const res = runCircuitEvent(save, today.circuit)
    if (res.ok) { advanceDay(save); return }
    // A cancelled circuit date (a world too thin for the Showdown) falls
    // through to a normal day, same as a cancelled local bracket.
  } else if (today) {
    const res = today.type === 'teams' ? runTeamTournament(save, today) : runSinglesTournament(save, today)
    if (res.ok) { advanceDay(save); return }
  }
  manage(save, policy)
  maybePatch(save, policy)
  startDay(save)
  let streamedToday = false
  while (save.hour < HOURS_PER_DAY) {
    simHour(save)
    // One match a day on the channel. A policy may aim the camera itself
    // (recovery.mjs points it away from a toxic star); autoStreamHour honours
    // policy.streamPick and falls back to the auto-stream selector.
    if (!streamedToday && autoStreamHour(save, policy, harnessOpts) != null) streamedToday = true
  }
  endDay(save)
  // Answer any breakthrough the day armed. The cast waits for the OWNER —
  // in the browser that is a real choice on the Players screen; here the
  // competent player answers promptly with the same heuristic the sim uses,
  // and it counts as a mutating decision (metric 6) because it is one.
  // policy.eurekaPrefer still steers (recovery.mjs pushes a burning-out star
  // toward temperance); the glow list decides what is ON OFFER.
  autoEureka(save, policy, harnessOpts)
}

export const isDead = (save) => !!(save.gameOver || save.economy?.foreclosed)

/** Play to a horizon (or death). Returns a metrics bundle. */
export function playRun(save, days, policy = DEFAULT_POLICY) {
  let attSum = 0, attN = 0
  for (let d = 0; d < days; d++) {
    playDay(save, policy)
    const a = save.economy.history.at(-1)?.attendance
    if (a != null) { attSum += a; attN++ }
    if (isDead(save)) break
  }
  const active = Object.values(save.players).filter((p) => p.isRegular && !p.retired && !p.banished)
  const cast = Object.values(save.players).filter((p) => !p.npc)
  const bestSkill = (p) => Math.max(0, ...Object.values(p.charSkill || {}), 0)
  return {
    died: isDead(save),
    funnel: save.economy.foreclosed ? 'economy' : (save.gameOver?.funnel || null),
    lastedDays: runAge(save),
    attendance: attN ? attSum / attN : 0,
    regulars: active.length,
    money: Math.round(save.economy.money),
    followers: save.stream.followers,
    hype: Math.round(save.stream.hype),
    relevance: Math.round(save.relevance ?? 0),
    skill: cast.length ? Math.round(cast.reduce((n, p) => n + bestSkill(p), 0) / cast.length) : 0,
    topSkill: Math.round(Math.max(0, ...cast.map(bestSkill))),
    rivalry: Number((save.scene?.rivalryIndex ?? 0).toFixed(3)),
    toxicity: Number((save.scene?.toxicity ?? 0).toFixed(3)),
    retirements: Object.values(save.players).filter((p) => p.retired).length,
    mentorships: (save.mentorships || []).length,
    teams: Object.keys(save.teams || {}).length,
    innovations: (save.innovations || []).length,
    guides: (save.guides || []).length,
    tournaments: (save.hallOfFame || []).length,
    evoQualified: (save.hallOfFame || []).filter((r) => r.type === 'evo' && (r.arcadeResults || []).length).length,
    save,
  }
}

export const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0)
export const pct = (xs) => Math.round(mean(xs) * 100)
