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
// real problem. The counterplays are TODAY'S tools on purpose — the baseline
// measures the game the playtests complained about (for toxicity that means
// warn and separate; P3 replaces this table when the levers replace the
// tools).

import { DEFAULT_POLICY, makeRun, playDay, maybePatch, isDead } from './policy.mjs'
import { mean, stddev } from './metrics.mjs'
import { warnPlayer, separate, chiefInstigator } from '../../src/game/discipline.js'
import { newTournamentEntry } from '../../src/game/model.js'
import { fitsBandwidth } from '../../src/game/bandwidth.js'
import { pickAutoStreamSetup } from '../../src/game/stream.js'
import { canStageExhibition, runExhibition } from '../../src/game/tournament.js'
import { clamp } from '../../src/game/util.js'

const LAGS = [0, 7, 14, 28, 56, 112]
const SEEDS = [31, 32, 33, 34, 35, 36]
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
        weekWarned: -1,
      }
    },
    counterplayDay(save, signal) {
      // Weekly: warn the chief instigator, keep the worst pair apart.
      const week = Math.floor(((save.year - 1) * 336 + save.day) / 7)
      if (week === signal.weekWarned) return
      signal.weekWarned = week
      const chief = chiefInstigator(save)
      if (chief) warnPlayer(save, chief, 'toxicity')
      let worst = null
      for (const a of activeRegulars(save)) {
        for (const [otherId, rel] of Object.entries(a.relationships || {})) {
          if (!save.players[otherId]) continue
          if (!worst || rel < worst.rel) worst = { aId: a.id, bId: otherId, rel }
        }
      }
      if (worst && worst.rel < -50) separate(save, worst.aId, worst.bId)
    },
    recovered(save, signal) {
      const still = new Set(activeCast(save).map((p) => p.id))
      const nobodyLeft = signal.members.every((id) => still.has(id))
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
      // More spotlight, not less: the camera finds the star's match first.
      return {
        ...DEFAULT_POLICY,
        streamPick: (save, hour) => {
          const ev = hour.events.find((e) => e.type === 'match'
            && (e.aId === signal.starId || e.bId === signal.starId))
          return ev ? ev.setupIndex : pickAutoStreamSetup(save, hour, 'closest')
        },
      }
    },
    counterplayDay() {},
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
      return { attendanceAtSignal: trailingAttendance(save), patchedAbs: -999 }
    },
    counterplayDay(save, signal, policy) {
      // Patch to address the staleness, immediately and again when the
      // cadence allows; keep every ad the books can carry running.
      const abs = (save.year - 1) * 336 + save.day
      if (abs - signal.patchedAbs > 56) {
        maybePatch(save, { ...policy, patchEvery: 1 })
        signal.patchedAbs = abs
      }
      if (canStageExhibition(save).ok && save.economy.money > 400) runExhibition(save)
    },
    recovered(save, signal) {
      return trailingAttendance(save) >= signal.attendanceAtSignal
    },
    detect: (save) => (save.relevance ?? 55) < 30,
  },

  plateau: {
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
      // Destroy the solved state and raise the stakes: patch on a fast
      // cadence, add a monthly double-elim (a bigger pot than the weekly).
      const abs = (save.year - 1) * 336 + save.day
      if (abs - signal.patchedAbs > 56) {
        maybePatch(save, { ...policy, patchEvery: 1 })
        signal.patchedAbs = abs
      }
      if (!signal.scheduled) {
        const e = newTournamentEntry({ name: 'Monthly', type: 'singles', format: 'doubleelim', cadence: 'monthly', dayOfMonth: 14, size: 8 })
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

export async function measureAllRecoveries(opts = {}) {
  const out = {}
  for (const name of Object.keys(CRISES)) out[name] = measureRecovery(name, opts)
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
