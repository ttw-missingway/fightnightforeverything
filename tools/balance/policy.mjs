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
import { newSave, newTournamentEntry, newCharacter, newPlayer, legalizeBuild } from '../../src/game/model.js'
import { generateCharacter, populateRoster, generateEvoRoster, randomIdentity, randomPreferences } from '../../src/game/generate.js'
import {
  TEMPERAMENTS, SOCIAL_TEMPERAMENTS, STAT_UNIT, PERSONAL_KEYS, SOCIAL_KEYS, AD_CHANNELS,
  HOURS_PER_DAY, runAge, difficultyOf,
} from '../../src/game/constants.js'
import { computeMatchups } from '../../src/game/balance.js'
import { startDay, simHour, endDay, advanceDay, whatHappensToday } from '../../src/game/sim.js'
import { runSinglesTournament, runTeamTournament, runEvo } from '../../src/game/tournament.js'
import { audienceMix, hasFreeInstall, claimFreeInstall } from '../../src/game/catalog.js'
import { ATTRACTION_PACKS } from '../../src/game/names.js'
import * as eco from '../../src/game/economy.js'
import { buildStreamForPlayers, pickAutoStreamSetup, STREAM_RIG_COST } from '../../src/game/stream.js'
import { fitsBandwidth } from '../../src/game/bandwidth.js'
import { releasePatch, daysSincePatch, charPower } from '../../src/game/patch.js'
import { applyMoveDescriptors, DAMAGE_TIERS } from '../../src/game/design.js'
import { isUnlocked } from '../../src/game/achievements.js'
import { selectableChars } from '../../src/game/forms.js'
import { bindStream, newRngState } from '../../src/game/rng.js'
import { noteDecision } from '../../src/game/attention.js'

const { startingBudget, arcadeBuildCost } = eco

export const DEFAULT_POLICY = {
  rig: true,              // buy the streaming setup on day one
  stream: true,           // put a match on the channel every day
  foods: 3,               // how many lines to stock
  foodPrice: 3,
  // THE PRICE IS costPerPlay = tokenPrice × playTokens. The overhaul that
  // split it (2026-07-28) also moved typical comfort to ~$1.20 a match, and
  // this default sat at $2.00 — measured dies 5/5 — for a while afterwards,
  // which made every default-policy number a measurement of an over-pricer.
  // Post nut-cut sweep (n=8, 336d, normal): $1.50 and $1.75 die 0%, $1.25
  // 13%, ≥$2.00 dies 100%. $1.50 banks the most ($3.4k median).
  tokenPrice: 0.5,
  playTokens: 3,          // tokens the main game takes per match — $1.50/play
  cabinets: 2,
  maxEmployees: 2,
  growSetups: true,       // add cabinets as the room fills
  patchEvery: 100,        // days between balance patches, once the Studio is earned
  manager: false,
  ads: ['flyers'],
  cast: 6,                // players YOU made — the whole game is about these
  weekly: 8,              // weekly singles bracket size (0 = none)
  monthly: 0,             // monthly bracket size (0 = none)
  hireAt: [600, 1400, 2600], // cash thresholds for employees 1..3
  managerAt: 2200,
  // Buy into unlocked attraction packs (new audiences first) once the books
  // can carry the build. Off by default: it is the room-builder's move.
  attractions: false,
}

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

/**
 * The between-days decisions: staffing and advertising, paid out of cash.
 *
 * A competent owner watches the floor, not a spreadsheet — the trigger to hire
 * is "this place is filthy", which is exactly what the in-game coaching tip
 * says. The first version of this hired on cash thresholds alone and left every
 * run at 28% clean for ten months, which measured the arcade's difficulty and
 * the harness's stupidity at the same time.
 */
function manage(save, policy) {
  const cash = save.economy.money
  const { employees, managers } = eco.staffCounts(save)
  const clean = save.arcade.cleanliness ?? 80
  const runway = cash / Math.max(1, eco.projectedMonthlyCost(save) / 28)

  // Hire when the room needs it AND there is more than a fortnight of runway.
  const needHands = clean < 62 || save.economy.history.at(-1)?.attendance > 14
  if (employees < policy.maxEmployees && needHands && runway > 14 && cash > 300) {
    if (eco.trySpend(save, eco.HIRE_COST, 'hired an employee')) {
      save.staffing.staff.push(eco.newStaffMember('employee'))
      noteDecision(save, 'hire')
    }
  }
  // One manager per four employees keeps the floor working (the game says so).
  if (policy.manager && managers < Math.floor(employees / 3) && runway > 20) {
    if (eco.trySpend(save, eco.HIRE_COST, 'hired a manager')) {
      save.staffing.staff.push(eco.newStaffMember('manager'))
      noteDecision(save, 'hire')
    }
  }
  // Let staff go rather than go under — the last thing before foreclosure.
  if (runway < 6 && employees > 1) {
    const idx = save.staffing.staff.findIndex((x) => !x.family && x.role === 'employee')
    if (idx >= 0) {
      save.staffing.staff.splice(idx, 1)
      noteDecision(save, 'layoff')
    }
  }
  // GROW THE FLOOR. A setup is six matches a day and a token a match, so a
  // room with more people than cabinets is leaving money on the tables. This
  // is the arcade's main growth lever and the first policy missed it entirely.
  const att = save.economy.history.at(-1)?.attendance ?? 0
  if (policy.growSetups && att > save.settings.setups * 6 && runway > 25
      && save.settings.setups < 8 && eco.trySpend(save, eco.SETUP_COST, 'new setup cabinet')) {
    save.settings.setups += 1
    noteDecision(save, 'setup')
  }
  // THE RIG, IF IT COULDN'T BE AFFORDED ON DAY ONE.
  //
  // makeRun only tries at opening, out of the leftover float. That was fine
  // while the rig cost $180 and every difficulty cleared the bar on night one
  // — and it silently became a measurement bug the moment the price went up,
  // because "can't afford it at open" turned into "never owns a channel for
  // the entire run" and every follower/hype/exhibition number was quietly
  // measuring a rigless arcade. A competent player saves up and buys it.
  if (policy.rig && !save.arcade.streamRig && runway > 20
      && eco.trySpend(save, STREAM_RIG_COST, 'streaming setup')) {
    save.arcade.streamRig = true
    noteDecision(save, 'rig')
  }
  // Advertising is a weekly bill — only run what the books can carry, and
  // only channels this lineage has EARNED. The policy used to write
  // `arcade.ads` directly, which quietly bought achievement-locked channels a
  // real first-run player cannot have (radio is $44/week AND locked) — the
  // harness was measuring a player who cannot exist.
  const legalAds = policy.ads.filter((k) => {
    const c = AD_CHANNELS.find((x) => x.key === k)
    return c && (!c.unlock || isUnlocked(save, c.unlock))
  })
  const nextAds = runway > 30 ? legalAds : runway > 15 ? legalAds.slice(0, 1) : []
  if (nextAds.join() !== (save.arcade.ads || []).join()) noteDecision(save, 'ads')
  save.arcade.ads = nextAds
  // Exhibitions were cut by the revision (docs/DEPRECATED.md) — the competent
  // player no longer stages showcase nights.
  // AN ATTRACTION IS A CROWD YOU DO NOT HAVE YET, or it is furniture
  // (catalog.js). The room-builder buys into a pack it has EARNED, one room at
  // a time, preferring an audience the floor doesn't serve — and takes the
  // earned free install even when money is tight, because that is what the
  // free install is for.
  if (policy.attractions) {
    const owned = new Set(save.arcade.otherGames)
    const mix = audienceMix(save)
    const candidates = ATTRACTION_PACKS
      .filter((p) => isUnlocked(save, p.key))
      .map((p) => ({ p, missing: p.items.filter((i) => !owned.has(i)) }))
      .filter((x) => x.missing.length)
      .sort((a, b) => (mix.has(a.p.audience) ? 1 : 0) - (mix.has(b.p.audience) ? 1 : 0))
    const item = candidates[0]?.missing[0]
    if (item) {
      const cost = eco.gameItem(item).price
      const bought = hasFreeInstall(save, item)
        ? claimFreeInstall(save, item)
        : (runway > 30 && cash > cost * 2.5 && eco.trySpend(save, cost, `installed ${item}`))
      if (bought) {
        save.arcade.otherGames.push(item)
        save.arcade.gameTokens[item] ??= 1
        noteDecision(save, 'attraction')
      }
    }
  }
}

/**
 * Balance the game: nudge the strongest cast members down and the weakest up.
 *
 * Patching is the only lever against relevance decay, so a policy that never
 * patches measures a player who has decided to lose slowly. This is the
 * ordinary, sensible patch a designer ships — a couple of characters moved a
 * tier, nothing structural.
 */
export function maybePatch(save, policy) {
  if (!policy.patchEvery || !isUnlocked(save, 'studio')) return
  if (save.gameDraft) return
  if (daysSincePatch(save) < policy.patchEvery) return
  const chars = selectableChars(save.game)
  if (chars.length < 4) return
  const draft = structuredClone(save.game)
  const ranked = [...chars].sort((a, b) => charPower(save.game, b.id) - charPower(save.game, a.id))
  const shift = (charId, dir) => {
    const c = draft.characters.find((x) => x.id === charId)
    if (!c) return
    // Move the biggest-damage move one tier, which is what a real patch note
    // looks like: "Heavy Slash: damage heavy → normal".
    const mv = [...c.moves].sort((a, b) => (b.damage || 0) - (a.damage || 0))[0]
    if (!mv) return
    const i = DAMAGE_TIERS.indexOf(mv.d?.damage ?? 'normal')
    const next = DAMAGE_TIERS[Math.min(DAMAGE_TIERS.length - 1, Math.max(0, i + dir))]
    if (!next || next === mv.d.damage) return
    mv.d = { ...mv.d, damage: next }
    applyMoveDescriptors(mv)
  }
  shift(ranked[0].id, -1)
  shift(ranked[1].id, -1)
  shift(ranked[ranked.length - 1].id, +1)
  shift(ranked[ranked.length - 2].id, +1)
  save.gameDraft = draft
  releasePatch(save)
  noteDecision(save, 'patch')
}

/** One day, played. Streams a match if the policy says to and the rig exists. */
export function playDay(save, policy = DEFAULT_POLICY) {
  const today = whatHappensToday(save)
  if (today === 'evo') { runEvo(save); advanceDay(save); return }
  if (today) {
    const res = today.type === 'teams' ? runTeamTournament(save, today) : runSinglesTournament(save, today)
    if (res.ok) { advanceDay(save); return }
  }
  manage(save, policy)
  maybePatch(save, policy)
  startDay(save)
  let streamedToday = false
  while (save.hour < HOURS_PER_DAY) {
    simHour(save)
    if (policy.stream && !streamedToday && save.arcade.streamRig) {
      const dip = save.dayInProgress
      const hour = dip?.hours?.[dip.hours.length - 1]
      if (hour && hour.streamedSetup == null) {
        // A policy may aim the camera itself (recovery.mjs points it at a
        // burning-out star); the default is the auto-stream 'closest' pick.
        const idx = policy.streamPick
          ? policy.streamPick(save, hour)
          : pickAutoStreamSetup(save, hour, 'closest')
        if (idx != null) {
          const ev = hour.events.find((e) => e.type === 'match' && e.setupIndex === idx)
          const a = ev && save.players[ev.aId]
          const b = ev && save.players[ev.bId]
          if (a && b && !ev.stream) {
            hour.streamedSetup = idx
            ev.stream = buildStreamForPlayers(save, a, b, ev, 'daily')
            streamedToday = true
            noteDecision(save, 'stream')
          }
        }
      }
    }
  }
  endDay(save)
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
