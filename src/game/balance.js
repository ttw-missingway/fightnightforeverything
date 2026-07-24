// The balance engine: reads each character's actual design — frame data,
// damage, meter, setups, combos — and derives ratings, then COMPUTES the
// matchup chart. The user doesn't set matchup percentages anymore; the
// game tells them what they built.
//
// Writes game.matchups in the same storage format model.js uses
// ("loId|hiId" -> win% for the lower-sorted id), so everything downstream
// (win probability, charPower, patch diffs) works unchanged.

import { clamp, hash01, uid, choice, randInt } from './util.js'
import { comboDamage } from './design.js'

const by = (char, type) => (char.moves || []).filter((m) => m.type === type)

// Soft cap instead of a hard clamp: linear up to 100 ("as good as sane
// design gets"), then logarithmic overflow so a 4000-damage jab is no
// longer indistinguishable from a 400-damage one. The overflow region is
// what the "overtuned" matchup edge reads.
function soft(x) {
  if (x <= 0) return 0
  if (x <= 100) return x
  return 100 + 55 * Math.log10(x / 100)
}

/**
 * Sub-ratings, each read from the movelist. 0..100 is the sane design
 * band; values above 100 mean the raw numbers exceed anything reasonable
 * and get weighted separately (and heavily) in the matchup math.
 *  speed    — how fast their fastest normal comes out
 *  offense  — raw damage: best combo (scaled) or best single hit
 *  pressure — plus-on-block tools (magnitude matters) and setup/trap screen time
 *  zoning   — projectile quality, chip, and trap coverage
 *  defense  — anti-airs, counters, fast supers, quick-recovery buttons
 *  mobility — movement tools and general pace
 *  meter    — super damage per bar and install access
 */
export function ratings(char) {
  const mv = char.moves || []
  const normals = mv.filter((m) => m.slot === 'normal' || ['light', 'melee', 'heavy'].includes(m.type))

  const fastest = Math.min(...normals.map((m) => m.startup ?? 8), 13)
  const speed = soft(100 - (fastest - 3) * 10) // frame 1 lands above the cap

  const bestHit = Math.max(...mv.map((m) => m.damage ?? 0), 0)
  const bestCombo = Math.max(...(char.combos || []).map((c) => comboDamage(char, c)), 0)
  const offense = soft(Math.max(bestHit, bestCombo * 0.85) / 4)

  // Being plus matters; being ABSURDLY plus matters more.
  const plusMoves = mv.filter((m) => (m.onBlock ?? -5) >= 1)
  const plusMagnitude = plusMoves.reduce((s, m) => s + Math.max(0, m.onBlock ?? 0), 0)
  const setupTime = ['set up', 'trap', 'install'].flatMap((t) => by(char, t))
    .reduce((s, m) => s + (m.duration || 0), 0)
  const pressure = soft(plusMoves.length * 10 + plusMagnitude * 3 + setupTime * 3.5)

  const zoning = soft(
    by(char, 'projectile').reduce((s, m) => s + 34 - (m.startup ?? 14) / 2 - (m.recovery ?? 26) / 4 + (m.chip ?? 0), 0) +
    by(char, 'trap').length * 14)

  const fastSuper = by(char, 'super').some((m) => (m.startup ?? 12) <= 7)
  const safeButton = normals.some((m) => (m.recovery ?? 15) <= 8)
  const defense = soft(
    by(char, 'anti-air').reduce((s, m) => s + 30 - (m.startup ?? 6) * 2, 0) +
    by(char, 'counter').length * 20 + (fastSuper ? 22 : 0) + (safeButton ? 14 : 0))

  const mobility = soft(
    by(char, 'movement').reduce((s, m) => s + 44 - (m.startup ?? 5) * 2 - (m.recovery ?? 10), 0) + Math.min(speed, 100) / 4)

  const meter = soft(
    by(char, 'super').reduce((s, m) => s + (m.damage ?? 0) / Math.max(m.meterCost ?? 100, 25), 0) * 11 +
    by(char, 'install').reduce((s, m) => s + 8 + (m.duration || 0), 0))

  return { speed, offense, pressure, zoning, defense, mobility, meter }
}

// How far past sane design a kit goes, summed across every axis. This is
// the "your numbers are illegal" score — 0 for anything reasonable.
export function overtune(r) {
  return ['speed', 'offense', 'pressure', 'zoning', 'defense', 'mobility', 'meter']
    .reduce((s, k) => s + Math.max(0, r[k] - 100), 0)
}

// The rock-paper-scissors of fighting games, in factor form. Archetype
// interactions read the sane band; the 'tuning' factor reads everything
// past it — raw numbers that outgrow design get an edge no archetype
// advantage can answer.
function factors(ra, rb) {
  const band = (v) => Math.min(v, 100)
  return [
    { key: 'keepout', edge: (band(ra.zoning) - band(rb.mobility)) * 0.06 - (band(rb.zoning) - band(ra.mobility)) * 0.06 },
    { key: 'pressure', edge: (band(ra.pressure) - band(rb.defense)) * 0.06 - (band(rb.pressure) - band(ra.defense)) * 0.06 },
    { key: 'damage', edge: (band(ra.offense) - band(rb.offense)) * 0.05 },
    { key: 'speed', edge: (band(ra.speed) - band(rb.speed)) * 0.04 },
    { key: 'meter', edge: (band(ra.meter) - band(rb.meter)) * 0.03 },
    { key: 'tuning', edge: (overtune(ra) - overtune(rb)) * 0.5 },
  ]
}

export function computeMatchup(a, b) {
  const ra = ratings(a)
  const rb = ratings(b)
  let edge = factors(ra, rb).reduce((s, f) => s + f.edge, 0)
  // Irreducible matchup jank: some pairs are just weird, consistently.
  edge += (hash01(`${a.id}|${b.id}:mu`) - 0.5) * 4
  // The wide clamp only comes into play for genuinely broken numbers —
  // sane designs live well inside it.
  return clamp(Math.round(50 + edge), 10, 90)
}

// Why the number is what it is — the dominant factor, in plain speech.
export function matchupExplanation(a, b) {
  const ra = ratings(a)
  const rb = ratings(b)
  const fs = factors(ra, rb)
  const top = fs.reduce((best, f) => (Math.abs(f.edge) > Math.abs(best.edge) ? f : best))
  if (Math.abs(top.edge) < 1) return 'a genuinely even fight'
  const winner = top.edge > 0 ? a : b
  const loser = top.edge > 0 ? b : a
  switch (top.key) {
    case 'keepout': return `${winner.name}'s screen control smothers ${loser.name}'s approach`
    case 'pressure': return `${winner.name}'s pressure runs through ${loser.name}'s defensive kit`
    case 'damage': return `${winner.name} wins two touches to three`
    case 'speed': return `${winner.name} is simply faster where it counts`
    case 'meter': return `${winner.name}'s meter cashouts decide the close rounds`
    case 'tuning': return `${winner.name}'s numbers are simply not legal — ${loser.name} is playing a different game`
    default: return 'stylistic edge'
  }
}

// ---------- Observed balance data ----------
// Right after a patch, nobody KNOWS anything — the reports run on thin data
// and can be flat wrong. Every set played on the current build sharpens the
// numbers. The truth (computeMatchup) always drives actual fights; these
// observed values are what the dashboards show.

export function balanceConfidence(save) {
  return clamp((save.patchGames || 0) / 300, 0, 1)
}

/**
 * The matchup number the DATA currently suggests: truth plus an error that
 * is stable within a patch (seeded by pair + version) and shrinks as sets
 * are played. At zero data the error can be ±9 points.
 *
 * `confOverride` lets the Studio force a confidence level — unreleased
 * draft changes have ZERO play data no matter how settled the live build
 * is, so their projections use confidence 0.
 */
export function observedMatchup(save, game, a, b, confOverride = null) {
  const truth = computeMatchup(a, b)
  const conf = confOverride ?? balanceConfidence(save)
  const noise = (hash01(`${a.id}|${b.id}|${game.version}:obs`) - 0.5) * 2 // -1..1
  return clamp(Math.round(truth + noise * (1 - conf) * 9), 10, 90)
}

export function observedPower(save, game, char, confOverride = null) {
  const others = game.characters.filter((c) => c.id !== char.id)
  if (!others.length) return 50
  return others.reduce((s, o) => s + observedMatchup(save, game, char, o, confOverride), 0) / others.length
}

/**
 * Which characters in the draft carry design changes vs the live game —
 * i.e. whose numbers are pre-release projections rather than observed data.
 */
export function draftChangedCharIds(liveGame, draft) {
  const changed = new Set()
  if (!draft) return changed
  const liveById = new Map(liveGame.characters.map((c) => [c.id, c]))
  for (const c of draft.characters) {
    const old = liveById.get(c.id)
    if (!old || JSON.stringify([c.moves, c.combos]) !== JSON.stringify([old.moves, old.combos])) {
      changed.add(c.id)
    }
  }
  return changed
}

// ---------- Community tier lists ----------

const TIER_ORDER = ['S', 'A', 'B', 'C', 'D']

const TIER_BLURBS = [
  'Three days of flowchart arguments later, the council has spoken.',
  'Compiled from board votes, salt, and one suspiciously passionate manifesto.',
  'The community has ranked the cast. The community is not sorry.',
  'Results-based analysis, vibes-based conclusions.',
  'As always: if your main is low, the list is wrong.',
]

function avgPower(chars, char) {
  const others = chars.filter((c) => c.id !== char.id)
  if (!others.length) return 50
  return others.reduce((s, o) => s + computeMatchup(char, o), 0) / others.length
}

/**
 * The COMMUNITY's tier list — not the objective chart. Starts from computed
 * power, then adds what communities actually rank on: how many people play
 * the character, who's been winning tournaments with them, and noise.
 */
export function generateTierList(save) {
  const chars = save.game.characters
  if (!chars.length) return null
  const regs = Object.values(save.players).filter((p) => p.isRegular)
  const mains = {}
  for (const p of regs) if (p.mainCharId) mains[p.mainCharId] = (mains[p.mainCharId] || 0) + 1
  const titles = {}
  for (const m of save.charMilestones || []) {
    if (m.text.includes('won')) titles[m.charId] = (titles[m.charId] || 0) + 1
  }

  const scored = chars.map((c) => ({
    id: c.id,
    perception: avgPower(chars, c)
      + (Math.random() - 0.5) * 3            // discourse noise
      + Math.min(mains[c.id] || 0, 4) * 0.8  // popularity reads as strength
      + Math.min(titles[c.id] || 0, 3) * 0.7, // "it wins tournaments, it's top tier"
  })).sort((a, b) => b.perception - a.perception)

  const tiers = { S: [], A: [], B: [], C: [], D: [] }
  for (const { id, perception } of scored) {
    const t = perception >= 54.5 ? 'S' : perception >= 51.5 ? 'A' : perception >= 48.5 ? 'B' : perception >= 45.5 ? 'C' : 'D'
    tiers[t].push(id)
  }
  // The community always crowns SOMEBODY.
  if (!tiers.S.length && scored.length) {
    const top = scored[0].id
    for (const t of TIER_ORDER) tiers[t] = tiers[t].filter((id) => id !== top)
    tiers.S.push(top)
  }

  return {
    id: uid('tierlist'),
    version: save.game.version,
    day: save.day,
    year: save.year,
    tiers,
    blurb: choice(TIER_BLURBS),
    votes: randInt(15, 40) + Math.round((save.stream?.hype || 0) * 3),
  }
}

export { TIER_ORDER }

/**
 * Recompute the whole chart from the movesets. Called at save start, after
 * migration, and on every patch release — this table IS character power.
 */
export function computeMatchups(game) {
  const chars = game.characters
  const table = {}
  for (let i = 0; i < chars.length; i++) {
    for (let j = i + 1; j < chars.length; j++) {
      const a = chars[i]
      const b = chars[j]
      const [lo, hi] = a.id < b.id ? [a, b] : [b, a]
      table[`${lo.id}|${hi.id}`] = computeMatchup(lo, hi)
    }
  }
  game.matchups = table
  return table
}
