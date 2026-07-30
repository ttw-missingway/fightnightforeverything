// Run fingerprints — REVISION §2.2. The single highest-value instrument:
// every balance change shows its blast radius before it is argued about.
//
//   node tools/balance/fingerprint.mjs [n] [difficulty]   # run + write out/fingerprint.json
//     --years N     horizon in in-game years (default 10)
//     --full        also run latency (metric 8) and recovery (metric 9) — slow
//     --commit      bless out/fingerprint.json as the committed baseline
//   node tools/balance/fingerprint.mjs --diff             # out/fingerprint.json vs baseline.json
//
// Whenever baseline.json exists, a diff is printed automatically after a run.
// Seeds are fixed (BASE_SEED + i), so two fingerprints of the same code are
// identical and any diff is the change under test, not the weather.

import { mkdirSync, writeFileSync, readFileSync, existsSync, copyFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { spawn } from 'node:child_process'
import { cpus } from 'node:os'
import { instrumentedRun, aggregate } from './metrics.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const OUT_DIR = join(HERE, 'out')
const OUT = join(OUT_DIR, 'fingerprint.json')
const BASELINE = join(HERE, 'baseline.json')
const BASE_SEED = 1000

const argv = process.argv.slice(2)
const flags = new Set(argv.filter((a) => a.startsWith('--')))
const flagVal = (name, dflt) => {
  const i = argv.indexOf(name)
  return i >= 0 && argv[i + 1] != null ? argv[i + 1] : dflt
}
const pos = argv.filter((a) => !a.startsWith('--') && argv[argv.indexOf(a) - 1] !== '--years' && argv[argv.indexOf(a) - 1] !== '--shard')

// ---------- shard worker: run a few seeds, print JSON on stdout ----------
if (flags.has('--shard')) {
  const seeds = flagVal('--shard', '').split(',').map(Number)
  const difficulty = flagVal('--difficulty', 'normal')
  const years = Number(flagVal('--years', 10))
  const runs = seeds.map((seed) => {
    const { save, ...rest } = instrumentedRun({ seed, difficulty, years })
    return rest
  })
  process.stdout.write(JSON.stringify(runs))
  process.exit(0)
}

// ---------- diff ----------
function flatten(obj, prefix = '', out = {}) {
  for (const [k, v] of Object.entries(obj || {})) {
    const key = prefix ? `${prefix}.${k}` : k
    if (v && typeof v === 'object') flatten(v, key, out)
    else out[key] = v
  }
  return out
}

function printDiff(base, next) {
  const a = flatten(base.headline)
  const b = flatten(next.headline)
  const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])].sort()
  let changes = 0
  for (const k of keys) {
    const va = a[k], vb = b[k]
    if (va === vb) continue
    if (typeof va === 'number' && typeof vb === 'number') {
      const eps = Math.max(Math.abs(va), Math.abs(vb)) * 0.02 + 1e-9
      if (Math.abs(va - vb) <= eps) continue
      const pct = va !== 0 ? ` (${vb > va ? '+' : ''}${Math.round(((vb - va) / Math.abs(va)) * 100)}%)` : ''
      console.log(`  ${k}: ${va} → ${vb}${pct}`)
    } else {
      console.log(`  ${k}: ${JSON.stringify(va)} → ${JSON.stringify(vb)}`)
    }
    changes += 1
  }
  if (!changes) console.log('  no headline differences beyond 2% noise floor')
  return changes
}

if (flags.has('--diff')) {
  if (!existsSync(BASELINE) || !existsSync(OUT)) {
    console.error('need both tools/balance/baseline.json and tools/balance/out/fingerprint.json')
    process.exit(1)
  }
  const base = JSON.parse(readFileSync(BASELINE, 'utf8'))
  const next = JSON.parse(readFileSync(OUT, 'utf8'))
  console.log(`baseline (${base.meta.capturedAt}) vs current (${next.meta.capturedAt}):`)
  printDiff(base, next)
  process.exit(0)
}

if (flags.has('--commit')) {
  if (!existsSync(OUT)) { console.error('no out/fingerprint.json to commit'); process.exit(1) }
  copyFileSync(OUT, BASELINE)
  console.log('committed out/fingerprint.json → baseline.json')
  process.exit(0)
}

// ---------- main run ----------
const n = Number(pos[0] || 24)
const difficulty = pos[1] || 'normal'
const years = Number(flagVal('--years', 10))
const seeds = Array.from({ length: n }, (_, i) => BASE_SEED + i)

function shardOut(allSeeds) {
  const workers = Math.max(1, Math.min(cpus().length - 1, allSeeds.length))
  const shards = Array.from({ length: workers }, () => [])
  allSeeds.forEach((s, i) => shards[i % workers].push(s))
  return Promise.all(shards.map((shard) => new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [
      fileURLToPath(import.meta.url),
      '--shard', shard.join(','),
      '--difficulty', difficulty,
      '--years', String(years),
    ], { stdio: ['ignore', 'pipe', 'inherit'] })
    let buf = ''
    child.stdout.on('data', (d) => { buf += d })
    child.on('close', (code) => code === 0 ? resolve(JSON.parse(buf)) : reject(new Error(`shard exited ${code}`)))
  }))).then((chunks) => chunks.flat())
}

const t0 = Date.now()
console.log(`fingerprint: ${n} seeded runs × ${years}y on ${difficulty}…`)
const runs = await shardOut(seeds)
const headline = aggregate(runs)

if (flags.has('--full')) {
  console.log('latency sweep (metric 8)…')
  const { measureAllLatencies } = await import('./latency.mjs')
  headline.leverLatency = measureAllLatencies({ difficulty })
  console.log('recovery sweep (metric 9)…')
  const { measureAllRecoveries } = await import('./recovery.mjs')
  headline.recovery = await measureAllRecoveries({ difficulty })
}

const report = {
  meta: {
    capturedAt: new Date().toISOString().slice(0, 10),
    n, difficulty, years, baseSeed: BASE_SEED,
    full: flags.has('--full'),
  },
  headline,
}
mkdirSync(OUT_DIR, { recursive: true })
writeFileSync(OUT, JSON.stringify(report, null, 2))
console.log(`\nwrote ${OUT} in ${((Date.now() - t0) / 1000).toFixed(0)}s`)

console.log('\n— survival —')
console.log(headline.survival)
console.log('\n— per year —')
for (const y of headline.perYear) {
  console.log(`  y${y.year}: alive ${y.runsAlive}/${headline.runs} · sep skill ${y.separationSkill} elo ${y.separationElo}`
    + ` · cast ${y.castMeanSkill}/${y.castTopSkill} (σ${y.castSkillStddev})`
    + ` · journal ${y.journalPerPlayer}/yr · attn ${y.attentionPerWeek}/wk`
    + ` · money s${y.moneyShares.survival} c${y.moneyShares.competition} g${y.moneyShares.growth}`)
}
console.log('\n— first elite win —', headline.firstEliteWin)
console.log('— retirement dispersion —', headline.retirementDispersion)
console.log('— elite band (final) —', headline.eliteBand.final)

if (existsSync(BASELINE)) {
  console.log('\n— diff vs committed baseline —')
  printDiff(JSON.parse(readFileSync(BASELINE, 'utf8')), report)
}
