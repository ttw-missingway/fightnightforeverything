// Lever latency — metric 8 of the revision (docs/REVISION.md §2.3).
//
//   node tools/balance/latency.mjs [stream|money|patch|all] [difficulty]
//
// How long after pulling a lever does the world measurably move? Seeded A/B:
// control and treatment play IDENTICALLY until day D (same seed, same
// decisions — so their worlds are byte-identical at D), then treatment pulls
// exactly one lever and both play on. The latency is the first day the mean
// treatment−control gap on the lever's signal clears a threshold and holds it
// for a week. The compounding principle says stream ≈ weeks, money ≥ a month,
// patch ≈ now; this measures whether the game agrees.
//
// The levers are TODAY'S levers, measured for the baseline — money here is
// ads-and-capacity because pots and travel don't exist until P3. When P3
// replaces a lever, this file's lever definition changes with it and the
// baseline shows the difference.

import { DEFAULT_POLICY, makeRun, playDay, maybePatch, isDead } from './policy.mjs'
import { mean } from './metrics.mjs'

const LEVER_DAY = 120 // pulled well after the opening settles
const WINDOW = 168 // days observed after the pull
const SEEDS = [21, 22, 23, 24, 25, 26]

// Each lever: base policy both arms play, what the treatment does from D on,
// the daily signal, and the sustained-gap threshold that counts as "moved".
const LEVERS = {
  stream: {
    base: { ...DEFAULT_POLICY, stream: false, exhibit: false },
    treat: (policy) => ({ ...policy, stream: true }),
    // The lever's PROXIMATE signal. Attendance moves too, but a channel is
    // what streaming builds first — measured against attendance the effect
    // hides under floor noise for months, which is a finding about
    // attendance, not about the lever's latency.
    signal: (save) => save.stream.followers ?? 0,
    threshold: 10,
    label: 'daily streaming begins → followers',
  },
  money: {
    base: { ...DEFAULT_POLICY, ads: [], growSetups: false, exhibit: false },
    treat: (policy) => ({ ...policy, ads: ['flyers'], growSetups: true }),
    signal: (save) => save.economy.history.at(-1)?.attendance ?? 0,
    threshold: 1.0,
    label: 'money into ads + capacity → attendance',
  },
  patch: {
    // The Studio unlocks at one year of run age, so this lever cannot be
    // pulled at day 120 — its pull waits for the tool to exist.
    pullDay: 400,
    base: { ...DEFAULT_POLICY, patchEvery: 0, exhibit: false },
    treat: (policy) => policy, // the pull is a one-off release, below
    onPull: (save, policy) => {
      const before = (save.patches || []).length
      maybePatch(save, { ...policy, patchEvery: 1 })
      return (save.patches || []).length > before
    },
    signal: (save) => save.relevance ?? 0,
    threshold: 1.5,
    label: 'one balance patch ships → relevance',
  },
}

function armSeries(lever, seed, treated) {
  const save = makeRun({ seed, difficulty: currentDifficulty, policy: lever.base })
  const pullDay = lever.pullDay ?? LEVER_DAY
  const series = []
  let pullFired = !lever.onPull
  const after = treated ? lever.treat(lever.base) : lever.base
  for (let d = 0; d < pullDay + WINDOW; d++) {
    const policy = d >= pullDay ? after : lever.base
    if (treated && d === pullDay && lever.onPull) pullFired = !!lever.onPull(save, policy)
    playDay(save, policy)
    series.push(lever.signal(save))
    if (isDead(save)) break
  }
  return { series, pullFired: treated ? pullFired : true }
}

let currentDifficulty = 'normal'

export function measureLatency(name, { difficulty = 'normal' } = {}) {
  currentDifficulty = difficulty
  const lever = LEVERS[name]
  if (!lever) throw new Error(`unknown lever ${name}`)

  const pullDay = lever.pullDay ?? LEVER_DAY
  const diffs = [] // per-day mean(treated - control) across seeds
  const perSeed = SEEDS.map((seed) => ({
    control: armSeries(lever, seed, false),
    treated: armSeries(lever, seed, true),
  }))
  const fired = perSeed.filter((p) => p.treated.pullFired).length
  const horizon = Math.min(...perSeed.flatMap((p) => [p.control.series.length, p.treated.series.length]))
  for (let d = 0; d < horizon; d++) {
    diffs.push(mean(perSeed.map((p) => p.treated.series[d] - p.control.series[d])))
  }

  // First post-pull day the gap clears the threshold and holds for 7 days.
  let hit = null
  for (let d = pullDay; d < diffs.length - 7; d++) {
    if (diffs.slice(d, d + 7).every((x) => x > lever.threshold)) { hit = d; break }
  }
  const at56 = diffs[Math.min(pullDay + 56, diffs.length - 1)]
  return {
    lever: name,
    label: lever.label,
    latencyDays: hit != null ? hit - pullDay : null,
    effectAt56d: Math.round((at56 ?? 0) * 100) / 100,
    seeds: SEEDS.length,
    pullFired: fired,
    observedDays: horizon - pullDay,
  }
}

export function measureAllLatencies(opts = {}) {
  return {
    stream: measureLatency('stream', opts),
    money: measureLatency('money', opts),
    patch: measureLatency('patch', opts),
  }
}

// ---------- CLI ----------
if (import.meta.url === `file://${process.argv[1]}`) {
  const which = process.argv[2] || 'all'
  const difficulty = process.argv[3] || 'normal'
  const t0 = Date.now()
  const out = which === 'all'
    ? measureAllLatencies({ difficulty })
    : { [which]: measureLatency(which, { difficulty }) }
  for (const r of Object.values(out)) {
    console.log(`${r.lever.padEnd(7)} ${r.label}`)
    console.log(`        latency: ${r.latencyDays == null ? 'no measurable effect' : r.latencyDays + ' days'}`
      + ` · effect at +56d: ${r.effectAt56d} · n=${r.seeds}`
      + (r.pullFired < r.seeds ? ` · ⚠ pull fired in only ${r.pullFired}/${r.seeds}` : ''))
  }
  console.log(`(${((Date.now() - t0) / 1000).toFixed(0)}s)`)
}
