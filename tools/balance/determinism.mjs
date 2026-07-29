// Seeded-RNG invariants. Run after ANY change that touches randomness:
//
//   node tools/balance/determinism.mjs [days]
//
// Three claims, all load-bearing for every other measurement in this
// directory:
//   1. same seed → byte-identical world (fingerprint diffs mean something)
//   2. different seed → different world (the seed actually reaches the sim)
//   3. serialize mid-run, reload, continue → identical to never stopping
//      (a bug-report save replays; the browser and the harness agree)
import { makeRun, playRun } from './policy.mjs'

const DAYS = Number(process.argv[2] || 400)

// createdAt/updatedAt are wall-clock stamps, not simulation state.
function worldPrint(save) {
  const clone = structuredClone(save)
  delete clone.createdAt
  delete clone.updatedAt
  return JSON.stringify(clone)
}

function run(seed, days = DAYS) {
  const save = makeRun({ seed, difficulty: 'normal' })
  playRun(save, days)
  return save
}

const a = worldPrint(run(1234))
const b = worldPrint(run(1234))
const c = worldPrint(run(5678))

const half = makeRun({ seed: 1234, difficulty: 'normal' })
playRun(half, Math.floor(DAYS / 2))
const resumed = JSON.parse(JSON.stringify(half)) // a reload, byte for byte
playRun(resumed, DAYS - Math.floor(DAYS / 2))
const d = worldPrint(resumed)

function verdict(label, ok) {
  console.log(`${ok ? '✅' : '❌'} ${label}`)
  return ok
}

let pass = true
pass = verdict(`same seed → identical world (${DAYS}d)`, a === b) && pass
pass = verdict('different seed → different world', a !== c) && pass
pass = verdict('serialize + resume ≡ uninterrupted run', a === d) && pass

if (a !== b || a !== d) {
  const other = a !== b ? b : d
  let i = 0
  while (a[i] === other[i]) i++
  console.log('\nfirst divergence at char', i)
  console.log('A:', a.slice(Math.max(0, i - 160), i + 160))
  console.log('B:', other.slice(Math.max(0, i - 160), i + 160))
}
process.exit(pass ? 0 : 1)
