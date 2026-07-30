// The deprecation lane's fence — REVISION §4.
//
// src/game/deprecated/ holds code that is dead to the live game but kept for
// reference (and for the baseline's archaeology). LIVE CODE MUST NOT IMPORT
// FROM IT: this script fails `npm run lint` if anything outside the lane
// imports from inside it. The lane's own files may import each other, and may
// import live modules (a corpse is allowed to reference the world; the world
// is not allowed to reference the corpse).
//
// Registry of what lives in the lane and why: docs/DEPRECATED.md.

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(fileURLToPath(import.meta.url), '..', '..')
const SCAN_DIRS = ['src', 'tools']
const LANE = 'src/game/deprecated/'

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (name === 'node_modules' || name.startsWith('.')) continue
    if (statSync(p).isDirectory()) yield* walk(p)
    else if (/\.(js|jsx|mjs)$/.test(name)) yield p
  }
}

// Both static and dynamic imports; specifier must reference the lane.
const IMPORT_RE = /(?:import\s[^'"]*?|import\s*\(\s*|from\s+|require\s*\(\s*)['"]([^'"]+)['"]/g

const offences = []
for (const dir of SCAN_DIRS) {
  for (const file of walk(join(ROOT, dir))) {
    const rel = relative(ROOT, file).replaceAll('\\', '/')
    if (rel.startsWith(LANE)) continue // the lane may reference itself
    const text = readFileSync(file, 'utf8')
    for (const m of text.matchAll(IMPORT_RE)) {
      const spec = m[1]
      if (spec.includes('deprecated/') || spec.endsWith('/deprecated')) {
        const line = text.slice(0, m.index).split('\n').length
        offences.push(`${rel}:${line} imports "${spec}"`)
      }
    }
  }
}

if (offences.length) {
  console.error('✖ live code imports from the deprecation lane:\n')
  for (const o of offences) console.error('  ' + o)
  console.error('\nDead systems must stop constraining live code — see docs/DEPRECATED.md.')
  process.exit(1)
}
console.log('✓ no live imports from src/game/deprecated/')
