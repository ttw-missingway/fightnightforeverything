// Recoverability — metric 9 of the revision (docs/REVISION.md §2.6).
//
//   node tools/balance/recovery.mjs [toxicity|burnout|irrelevance|plateau|all] [difficulty]
//
// Put a run into a crisis, wait k days, apply the best available counterplay,
// play the recovery window, ask whether it recovered. Sweep k over
// 0/7/14/28/56/112 and the SHAPE of the curve is the finding: an S-curve
// means "fixable if caught early, hopeless past a point" is literally true; a
// straight line means catching it early was flavour; flat zero means there is
// no counterplay at all.
//
// Two halves, per §2.6: INJECTION starts every run at identical severity so
// lag is the only variable; DETECTION lets runs play naturally and reports
// how often each crisis actually arises, so the curve is known to measure a
// real problem. The counterplays are TODAY'S tools on purpose. The committed
// baseline (BALANCE.md §14) was measured with the discipline toolkit still
// live — warn weekly, separate the worst pair — and read a flat zero at every
// lag. That toolkit is now in the deprecation lane, so the live counterplay
// here is what actually survives: starve the instigator of the spotlight,
// patch, and the attraction kick-start. P3 replaces this table when the
// levers land, and gets judged against both readings.

import { DEFAULT_POLICY, makeRun, playDay, maybePatch, isDead } from './policy.mjs'
import { mean, stddev } from './metrics.mjs'
import { newTournamentEntry } from '../../src/game/model.js'
import { fitsBandwidth } from '../../src/game/bandwidth.js'
import { pickAutoStreamSetup } from '../../src/game/stream.js'
import { availableAttractions } from '../../src/game/catalog.js'
import { gameItem, trySpend } from '../../src/game/economy.js'
import { clamp } from '../../src/game/util.js'
import { pendingAsks, fundAsk } from '../../src/game/travel.js'
import { releasePatch } from '../../src/game/patch.js'
import { isUnlocked } from '../../src/game/achievements.js'
import { applyMoveDescriptors, DAMAGE_TIERS } from '../../src/game/design.js'

// A targeted balance change aimed at ONE person's character — the §2.6 move
// "nerf the dominant player's character to break the hierarchy they are
// poisoning" (and its mirror, buffing a burning-out star's main). Needs the
// Studio; a no-op before it unlocks, which is itself part of the finding.
function shiftMain(save, playerId, dir) {
  if (!isUnlocked(save, 'studio') || save.gameDraft) return false
  const charId = save.players[playerId]?.mainCharId
  if (!charId) return false
  const draft = structuredClone(save.game)
  const c = draft.characters.find((x) => x.id === charId)
  const mv = c && [...c.moves].sort((a, b) => (b.damage || 0) - (a.damage || 0))[0]
  if (!mv) return false
  const i = DAMAGE_TIERS.indexOf(mv.d?.damage ?? 'normal')
  const next = DAMAGE_TIERS[Math.min(DAMAGE_TIERS.length - 1, Math.max(0, i + dir))]
  if (!next || next === mv.d.damage) return false
  mv.d = { ...mv.d, damage: next }
  applyMoveDescriptors(mv)
  save.gameDraft = draft
  releasePatch(save)
  return true
}

import { feudSource } from '../../src/game/social.js'
import { banish } from '../../src/game/discipline.js'
import { hiatusActive, hiatusDays, setHiatus } from '../../src/game/hiatus.js'

const LAGS = [0, 7, 14, 28, 56, 112]
// §17's first named suspect was instrument power, and it was right: at six
// seeds a single run is 0.17, so nothing below ~0.2 is resolvable and the
// curves were being read through noise. Twenty-four puts the floor at 0.04,
// which is what it takes to trust a difference of a tenth. Sweeps are
// slow (6 lags × 12 seeds × a 180–336 day window each), which is the price of
// being able to tell a cliff from a coin flip.
const SEEDS = Array.from({ length: 24 }, (_, i) => 31 + i)
const INJECT_DAY = 200 // ~eight months in: the room exists, the books work

const bestSkillOf = (p) => Math.max(0, ...Object.values(p.charSkill || {}), 0)
const activeCast = (save) => Object.values(save.players)
  .filter((p) => !p.npc && p.createdBy === 'user' && !p.retired && !p.banished)
const activeRegulars = (save) => Object.values(save.players)
  .filter((p) => p.isRegular && !p.retired && !p.banished)
const trailingAttendance = (save, days = 14) => {
  const h = (save.economy.history || []).slice(-days)
  return h.length ? mean(h.map((x) => x.attendance || 0)) : 0
}

// Who is dragging the room down — feuds carried and hostility radiated. A
// local read (the engine's toxicityBlame went to the deprecation lane with
// the rest of discipline; this is the counterplay's own judgement call).
function worstOffender(save) {
  let worst = null, worstScore = 3
  for (const p of activeRegulars(save)) {
    const rels = Object.values(p.relationships || {})
    const score = rels.filter((v) => v <= -60).length * 3
      + rels.filter((v) => v <= -30 && v > -60).length
    if (score > worstScore) { worstScore = score; worst = p }
  }
  return worst
}

// ---------- the four crises ----------
// Each: inject(save) → signal (what "recovered" is judged against),
// counterplayDay(save, signal, policy) → mutations for one recovery-window
// day (called before playDay), recovered(save, signal), windowDays, and
// detect(save) for natural incidence.
export const CRISES = {
  toxicity: {
    windowDays: 180,
    inject(save) {
      const cast = activeRegulars(save)
        .sort((a, b) => bestSkillOf(b) - bestSkillOf(a))
      const hot = cast.slice(0, 3)
      for (const a of hot) {
        for (const b of hot) {
          if (a.id === b.id) continue
          a.relationships[b.id] = -80
        }
        a.mood = 2
      }
      return {
        preToxicity: save.scene?.toxicity ?? 0,
        // "Nobody left" is judged on the CAST — filler churns out of
        // save.players on its own schedule (generate.js deletes drifted
        // NPCs), so counting NPCs would make recovery unsatisfiable by
        // construction rather than by the game.
        members: activeCast(save).map((p) => p.id),
      }
    },
    // §2.6's counterplay, with the REAL levers now: remove the spotlight
    // (never reward toxicity with attention), steer breakthroughs into
    // sensitivity/politeness/community, and if they cannot be kept out of
    // the spotlight, sabotage them — nerf their character.
    policy(signal) {
      return {
        ...DEFAULT_POLICY,
        eurekaPrefer: ['sensitivity', 'politeness', 'community', 'temperance'],
        streamPick: (save, hour) => {
          const chief = worstOffender(save)
          const idx = pickAutoStreamSetup(save, hour, 'closest')
          if (idx == null || !chief) return idx
          const ev = hour.events.find((e) => e.type === 'match' && e.setupIndex === idx)
          if (ev && (ev.aId === chief.id || ev.bId === chief.id)) {
            const other = hour.events.find((e) => e.type === 'match'
              && e.setupIndex !== idx && e.aId !== chief.id && e.bId !== chief.id)
            return other ? other.setupIndex : null
          }
          return idx
        },
      }
    },
    counterplayDay(save, signal) {
      const abs = (save.year - 1) * 336 + save.day
      signal.startAbs ??= abs
      // CLOSE THE SETUPS (hiatus.js). The lever this crisis was missing: feud
      // cooling is throttled by the room's own toxicity and reaches zero at
      // 0.455, so past that a room that keeps playing cannot heal at all and
      // the only counterplay left was a ban. Closing the cabinets breaks the
      // throttle — nobody loses to anybody, cooling runs at full rate, and
      // nothing new is recruited into a fight that isn't happening.
      //
      // A competent owner reaches for it EARLY (it is reversible and cheap
      // next to a ban), reopens as soon as it worked, and does not sit dark
      // indefinitely — the crowd loss escalates every day and outruns the
      // problem it was closed to fix.
      const tox = save.scene?.toxicity ?? 0
      if (!hiatusActive(save) && tox >= 0.28) {
        setHiatus(save, true)
        signal.hiatusDays = (signal.hiatusDays || 0)
      } else if (hiatusActive(save)) {
        signal.hiatusDays = (signal.hiatusDays || 0) + 1
        if (tox <= 0.08 || hiatusDays(save) >= 21) setHiatus(save, false)
      }
      // Three weeks of starving the spotlight not working → the sabotage.
      if (!signal.nerfedAbs && abs - signal.startAbs > 21) {
        const chief = worstOffender(save)
        if (chief && shiftMain(save, chief.id, -1)) signal.nerfedAbs = abs
      }
      // THE NUCLEAR OPTION, WHICH THIS NEVER ACTUALLY TRIED. §2.6's toxicity
      // row ends "banish only if necessary", and the harness took that as
      // "never" — so the measured 0% recovery was partly a report on a
      // counterplay kit that omitted the strongest lever in the game.
      //
      // A competent owner reaches for it late and aims it at the person who
      // keeps SEEDING fights (social.js feudSource), not at the one who has
      // collected the most enemies — after a faction forms those are usually
      // different people, and throwing out the target achieves nothing.
      if (!signal.banishedAbs && abs - signal.startAbs > 42) {
        const src = feudSource(save)
        if (src) {
          banish(save, src.player, null)
          signal.banishedAbs = abs
          signal.banishedId = src.player.id
        }
      }
    },
    recovered(save, signal) {
      const still = new Set(activeCast(save).map((p) => p.id))
      // "NOBODY LEFT" MEANS NOBODY WAS DRIVEN OUT — not "nobody was removed".
      //
      // §2.6 lists banishment as sanctioned counterplay for this exact crisis
      // and then judges recovery on every cast member still being present,
      // which makes the strongest available lever self-defeating: use it and
      // you fail by construction. That contradiction, not the game, is a
      // large part of why toxicity measured ~0% recovery at every lag.
      //
      // A deliberate banishment is the owner paying a price on purpose, and
      // it is priced already (relevance, everyone who liked them, and they
      // can come back to beat you). The thing this clause is actually
      // guarding against is the ROOM BLEEDING — people quitting because the
      // place became unbearable — so that is what it now checks.
      const nobodyLeft = signal.members.every((id) => still.has(id) || id === signal.banishedId)
      // A healthy room pre-signal can read 0.0; a small floor keeps "back to
      // its pre-signal level" satisfiable rather than demanding exact zero.
      return (save.scene?.toxicity ?? 0) <= Math.max(signal.preToxicity, 0.05) && nobodyLeft
    },
    detect: (save) => (save.scene?.toxicity ?? 0) > 0.45,
  },

  burnout: {
    windowDays: 336, // §2.6: "still active a year later"
    inject(save) {
      const star = activeCast(save).sort((a, b) => bestSkillOf(b) - bestSkillOf(a))[0]
      if (!star) return null
      // Retirement only arms below passion 16 (career.js) — the injection has
      // to put them genuinely inside the kill zone or every lag "recovers".
      star.passion = 10
      star.mood = 2
      return { starId: star.id }
    },
    policy(signal) {
      // §2.6: more spotlight, not less; steer breakthroughs into temperance
      // (last-ditch, mojo/xfactor and hope a spike buys a win).
      return {
        ...DEFAULT_POLICY,
        eurekaPrefer: ['temperance', 'mojo', 'xfactor'],
        streamPick: (save, hour) => {
          const ev = hour.events.find((e) => e.type === 'match'
            && (e.aId === signal.starId || e.bId === signal.starId))
          return ev ? ev.setupIndex : pickAutoStreamSetup(save, hour, 'closest')
        },
      }
    },
    counterplayDay(save, signal) {
      // Fund EVERY opportunity that arises for them, whatever the books say,
      // and buff their character once the Studio can.
      for (const ask of pendingAsks(save)) {
        if (ask.playerId === signal.starId) fundAsk(save, ask.id)
      }
      if (!signal.buffedAbs && shiftMain(save, signal.starId, +1)) {
        signal.buffedAbs = (save.year - 1) * 336 + save.day
      }
    },
    recovered(save, signal) {
      const star = save.players[signal.starId]
      return !!star && !star.retired && !star.banished
    },
    detect: (save) => activeCast(save).some((p) => bestSkillOf(p) >= 30 && (p.passion ?? 80) < 30),
  },

  irrelevance: {
    windowDays: 180,
    inject(save) {
      save.relevance = 20
      save.fadedDays = 0
      return { attendanceAtSignal: trailingAttendance(save), patchedAbs: -999, kickStarted: false }
    },
    counterplayDay(save, signal, policy) {
      // Patch to address the staleness, immediately and again when the
      // cadence allows — and the §2.6 kick-start: a new attraction, once,
      // if the books can carry one.
      const abs = (save.year - 1) * 336 + save.day
      if (abs - signal.patchedAbs > 56) {
        maybePatch(save, { ...policy, patchEvery: 1 })
        signal.patchedAbs = abs
      }
      if (!signal.kickStarted && save.economy.money > 700) {
        const owned = new Set(save.arcade.otherGames)
        const item = availableAttractions(save).find((name) => !owned.has(name))
        if (item && trySpend(save, gameItem(item).price, `installed ${item}`)) {
          save.arcade.otherGames.push(item)
          save.arcade.gameTokens[item] ??= 1
          signal.kickStarted = true
        }
      }
    },
    recovered(save, signal) {
      return trailingAttendance(save) >= signal.attendanceAtSignal
    },
    detect: (save) => (save.relevance ?? 55) < 30,
  },

  // PLATEAU IS AN EQUILIBRIUM, NOT AN EVENT — and therefore not a
  // recoverability question. §2.6 says so in as many words ("Toxicity,
  // burnout and irrelevance are events. Plateau is the game's current
  // equilibrium — it is the disease of §0, not an accident"), and the data
  // agreed: measured recovery ROSE with lag (0.33 → 0.83), which is not a
  // cliff inverted, it is later windows simply being richer rooms. Asking
  // "did it recover, given you waited k days" of a steady state is a
  // category error that produced a misleading row for three phases.
  //
  // It is measured by INCIDENCE instead (measurePlateauIncidence below):
  // what share of runs are sitting in a plateau at year N. `curveExempt`
  // keeps it out of the sweep while leaving inject/detect available, since
  // the fixtures and the natural-incidence pass still use them.
  plateau: {
    curveExempt: true,
    windowDays: 180,
    inject(save) {
      // The disease of §0, imposed: skill compressed into one band, elo
      // squeezed WELL under the 1700 recovery line — clamping at 1700 itself
      // left players a single win from "recovered" and measured nothing.
      for (const p of activeRegulars(save)) {
        for (const [charId, v] of Object.entries(p.charSkill || {})) {
          p.charSkill[charId] = clamp(v, 40, 50)
        }
        p.elo = clamp(p.elo, 1450, 1620)
      }
      return {
        meanEloAtSignal: mean(activeRegulars(save).map((p) => p.elo)),
        patchedAbs: -999,
        scheduled: false,
      }
    },
    counterplayDay(save, signal, policy) {
      // §2.6 with the P3 levers: RAISE THE POT (outsiders break the sealed
      // room's zero-sum elo), FUND TRAVEL (elo imported from outside), and
      // patch to destroy the solved matchup state.
      const abs = (save.year - 1) * 336 + save.day
      if (abs - signal.patchedAbs > 56) {
        maybePatch(save, { ...policy, patchEvery: 1 })
        signal.patchedAbs = abs
      }
      for (const e of save.arcade.schedule) {
        if (e.type === 'singles' && (e.potBoost || 0) < 3 && save.economy.money > 800) e.potBoost = 3
      }
      for (const ask of pendingAsks(save)) {
        if (save.economy.money > ask.cost * 1.2) fundAsk(save, ask.id)
      }
      if (!signal.scheduled) {
        const e = newTournamentEntry({ name: 'Monthly', type: 'singles', format: 'doubleelim', cadence: 'monthly', dayOfMonth: 14, size: 8, potBoost: 2 })
        if (fitsBandwidth(save, e)) save.arcade.schedule.push(e)
        signal.scheduled = true
      }
    },
    recovered(save, signal) {
      const regs = activeRegulars(save)
      const anyPast = regs.some((p) => p.elo > 1700)
      const meanUp = mean(regs.map((p) => p.elo)) >= signal.meanEloAtSignal + 60
      return anyPast || meanUp
    },
    detect: (save) => {
      if (save.year < 3) return false
      const cast = activeCast(save)
      if (cast.length < 3) return false
      const skills = cast.map(bestSkillOf)
      return stddev(skills) < 3 && !cast.some((p) => p.elo > 1700)
    },
  },
}

// ---------- the sweep ----------
function prefixFor(seed, difficulty) {
  const save = makeRun({ seed, difficulty })
  for (let d = 0; d < INJECT_DAY; d++) {
    playDay(save)
    if (isDead(save)) return null
  }
  return save
}

export function measureRecovery(name, { difficulty = 'normal' } = {}) {
  const crisis = CRISES[name]
  if (!crisis) throw new Error(`unknown crisis ${name}`)
  const prefixes = SEEDS.map((seed) => ({ seed, save: prefixFor(seed, difficulty) }))
    .filter((p) => p.save)

  const curve = LAGS.map((k) => {
    let recovered = 0, measured = 0
    for (const { save: prefix } of prefixes) {
      const save = structuredClone(prefix)
      const signal = crisis.inject(save)
      if (!signal) continue
      measured += 1
      // The untreated lag: k days of playing on, not noticing.
      for (let d = 0; d < k && !isDead(save); d++) playDay(save)
      // The treatment window.
      const policy = crisis.policy ? crisis.policy(signal) : DEFAULT_POLICY
      for (let d = 0; d < crisis.windowDays && !isDead(save); d++) {
        crisis.counterplayDay(save, signal, policy)
        playDay(save, policy)
      }
      if (!isDead(save) && crisis.recovered(save, signal)) recovered += 1
    }
    return { k, recoveredShare: measured ? Math.round((recovered / measured) * 100) / 100 : null, n: measured }
  })
  return { crisis: name, curve }
}

/** Natural incidence — detection validity for the curves above. */
export function measureNaturalIncidence({ difficulty = 'normal', years = 6 } = {}) {
  const found = Object.fromEntries(Object.keys(CRISES).map((k) => [k, 0]))
  for (const seed of SEEDS) {
    const save = makeRun({ seed: seed + 100, difficulty })
    const seen = new Set()
    for (let d = 0; d < years * 336 && !isDead(save); d++) {
      playDay(save)
      for (const [name, crisis] of Object.entries(CRISES)) {
        if (!seen.has(name) && crisis.detect(save)) { seen.add(name); found[name] += 1 }
      }
    }
  }
  return Object.fromEntries(Object.entries(found)
    .map(([k, v]) => [k, Math.round((v / SEEDS.length) * 100) / 100]))
}

/**
 * PLATEAU, measured properly: what share of runs are sitting in the §0
 * equilibrium at a given year — skill compressed and the community's average
 * elo going nowhere. Incidence, not recovery, per §2.6.
 */
export function measurePlateauIncidence({ difficulty = 'normal', years = [4, 8, 12] } = {}) {
  const out = {}
  const marks = new Set(years)
  const tally = Object.fromEntries(years.map((y) => [y, { plateaued: 0, alive: 0 }]))
  for (const seed of SEEDS) {
    const save = makeRun({ seed: seed + 200, difficulty })
    for (let y = 1; y <= Math.max(...years) && !isDead(save); y++) {
      for (let d = 0; d < 336 && !isDead(save); d++) playDay(save)
      if (!marks.has(y) || isDead(save)) continue
      tally[y].alive += 1
      if (CRISES.plateau.detect(save)) tally[y].plateaued += 1
    }
  }
  for (const y of years) {
    out[`y${y}`] = tally[y].alive
      ? Math.round((tally[y].plateaued / tally[y].alive) * 100) / 100
      : null
  }
  return out
}

export async function measureAllRecoveries(opts = {}) {
  const out = {}
  for (const [name, crisis] of Object.entries(CRISES)) {
    if (crisis.curveExempt) continue // plateau — see the note on it
    out[name] = measureRecovery(name, opts)
  }
  out.plateauIncidence = measurePlateauIncidence(opts)
  out.naturalIncidence = measureNaturalIncidence(opts)
  return out
}

// ---------- CLI ----------
if (import.meta.url === `file://${process.argv[1]}`) {
  const which = process.argv[2] || 'all'
  const difficulty = process.argv[3] || 'normal'
  const t0 = Date.now()
  const results = which === 'all'
    ? await measureAllRecoveries({ difficulty })
    : { [which]: measureRecovery(which, { difficulty }) }
  for (const [name, r] of Object.entries(results)) {
    if (name === 'naturalIncidence') { console.log('natural incidence (6y):', r); continue }
    console.log(`${name}:`)
    for (const p of r.curve) console.log(`  lag ${String(p.k).padStart(3)}d → recovered ${p.recoveredShare == null ? '—' : p.recoveredShare} (n=${p.n})`)
  }
  console.log(`(${((Date.now() - t0) / 1000).toFixed(0)}s)`)
}
