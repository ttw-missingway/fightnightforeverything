// The balance engine: reads each character's actual design — frame data,
// damage, meter, setups, combos — and derives ratings, then COMPUTES the
// matchup chart. The user doesn't set matchup percentages anymore; the
// game tells them what they built.
//
// Writes game.matchups in the same storage format model.js uses
// ("loId|hiId" -> win% for the lower-sorted id), so everything downstream
// (win probability, charPower, patch diffs) works unchanged.

import { clamp, hash01, uid, choice, randInt } from './util.js'
import { comboDamage, healthMultOf, sizeModOf } from './design.js'
import { defaultRules } from './rules.js'
import { reachableForms, selectableChars } from './forms.js'

const by = (char, type) => (char.moves || []).filter((m) => m.type === type)

// Scales damage-per-frame into the same 0-100 band as the other ratings.
// Tuned so an ordinary generated kit sits below its own biggest-hit score and
// only an unusually fast/hard/safe button pushes past it.
const EFFICIENCY_WEIGHT = 6

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
export const RATING_KEYS = ['speed', 'offense', 'pressure', 'zoning', 'defense', 'mobility', 'meter']

/**
 * The sub-ratings a character has ON THEIR OWN, before any form they can turn
 * into. Everything downstream should call `ratings`, which folds the forms in;
 * this exists so that folding can measure a form without recursing forever.
 */
export function ownRatings(char, rules = null) {
  // The universal mechanics change what a character IS without touching the
  // character: give everyone a burst and pressure gets worse; let chip finish
  // and every zoner gets better.
  const R = { ...defaultRules(), ...(rules || {}) }
  const mv = char.moves || []
  const normals = mv.filter((m) => m.slot === 'normal' || ['light', 'melee', 'heavy'].includes(m.type))

  const fastest = Math.min(...normals.map((m) => m.startup ?? 8), 13)
  const speed = soft(100 - (fastest - 3) * 10) // frame 1 lands above the cap

  // Supers are deliberately excluded: their damage is already what the `meter`
  // rating measures, and letting them set `offense` too meant the biggest
  // number in every kit was a metered one — which is why buffing a meterless
  // button could never move this score.
  const bestHit = Math.max(0, ...mv.filter((m) => (m.meterCost ?? 0) === 0).map((m) => m.damage ?? 0))
  const bestCombo = Math.max(...(char.combos || []).map((c) => comboDamage(char, c, R)), 0)
  // REWARD PER FRAME OF COMMITMENT — the thing that actually breaks a fighting
  // game. Reading only the biggest single hit is blind to it, because the
  // biggest hit is always the super: a jab buffed to heavy damage at 4 frames
  // never becomes the max, so the old model saw a game-breaking button as no
  // change at all. A fast, safe, damaging button is worth far more than a slow
  // one that hits the same, and being plus on top of it is the whole problem.
  // Meterless only — a super's damage is already paid for.
  // Counters are excluded: their damage isn't reward for pressing a button,
  // it's reward for the OPPONENT pressing one. Counting them made a
  // huge-damage instant-startup parry read as the best move in the game.
  const efficiency = Math.max(0, ...mv
    .filter((m) => (m.meterCost ?? 0) === 0 && (m.damage ?? 0) > 0 && m.type !== 'counter')
    .map((m) => {
      const startup = Math.max(3, m.startup ?? 11)
      const safety = clamp(1 + (m.onBlock ?? -4) / 16, 0.3, 1.6)
      return ((m.damage ?? 0) / startup) * safety
    }))
  const offense = soft(
    Math.max(bestHit / 4, (bestCombo * 0.85) / 4, efficiency * EFFICIENCY_WEIGHT)
    * (1 + sizeModOf(char).comboEase * 0.5))

  // Being plus matters; being ABSURDLY plus matters more.
  const plusMoves = mv.filter((m) => (m.onBlock ?? -5) >= 1)
  // A plus button that comes out in 4 frames is a different animal from a plus
  // one that takes 16 — you can't contest the first one at all.
  const plusMagnitude = plusMoves.reduce((s, m) => {
    const fast = (m.startup ?? 11) <= 6 ? 1.9 : (m.startup ?? 11) <= 10 ? 1.35 : 1
    // ...and one you can't even walk up to is worse again.
    const far = (m.range ?? 50) >= 72 ? 1.4 : 1
    return s + Math.max(0, m.onBlock ?? 0) * fast * far
  }, 0)
  const setupTime = ['set up', 'trap', 'install'].flatMap((t) => by(char, t))
    .reduce((s, m) => s + (m.duration || 0), 0)
  // The high/low guess. Owning a fast overhead AND a fast low is the whole
  // mix-up game — far more than the sum of having either one alone, because
  // the defender has to choose before they can see which is coming.
  const fastOverhead = mv.some((m) => m.d?.guard === 'overhead' && (m.startup ?? 99) <= 18)
  const fastLow = mv.some((m) => m.d?.guard === 'low' && (m.startup ?? 99) <= 12)
  const unblockables = mv.filter((m) => m.d?.guard === 'unblockable').length
  // A universal overhead hands everyone half the mix-up for free, so owning
  // one stops being a distinguishing advantage.
  const mixupRaw = (fastOverhead && fastLow ? 20 : (fastOverhead || fastLow ? 6 : 0)) + unblockables * 8
  const mixup = R.universalOverhead === 'on' ? mixupRaw * 0.5 : mixupRaw
  // Escapes cut pressure off at the knees — that's the entire point of them.
  const escapes = (R.burst !== 'none' ? 0.82 : 1)
    * (R.pushblock === 'on' ? 0.9 : 1)
    * (R.guardCancel !== 'off' ? 0.92 : 1)
  // A guard gauge pushes the other way: blocking forever stops being an answer.
  const gauge = R.guardGauge !== 'off' ? 1.15 : 1
  const pressure = soft((plusMoves.length * 10 + plusMagnitude * 3 + setupTime * 3.5 + mixup) * escapes * gauge)

  // If chip can finish a round, every point of it is suddenly worth far more.
  const chipWorth = R.chipKO === 'chip can finish' ? 2.2 : 1
  // FOOTSIES: a long, safe poke controls the ground without ever touching
  // anyone. Space control isn't only projectiles — reach is the other half of
  // it, and a grappler's point-blank kit is exactly why they have to work.
  // NOT simply your longest button — a 16-frame heavy that reaches is not a
  // poke. Footsies are won by a button that is long AND quick AND safe, so
  // all three have to be true before this pays. (Measuring raw max reach made
  // 57 of 60 generated characters identical, because they all carry a heavy.)
  const footsies = Math.max(0, ...mv
    .filter((m) => (m.meterCost ?? 0) === 0 && (m.damage ?? 0) > 0 && m.type !== 'projectile')
    .map((m) => {
      const reach = (m.range ?? 50) / 50
      const quick = clamp(1.6 - (m.startup ?? 11) / 14, 0.4, 1.3)
      const safe = clamp(1 + (m.onBlock ?? -4) / 22, 0.5, 1.4)
      return (reach - 0.8) * 55 * quick * safe
    }))
  const zoning = soft(
    by(char, 'projectile').reduce((s, m) => s + 34 - (m.startup ?? 14) / 2 - (m.recovery ?? 26) / 4 + (m.chip ?? 0) * chipWorth, 0) +
    by(char, 'trap').length * 14 + footsies)

  const fastSuper = by(char, 'super').some((m) => (m.startup ?? 12) <= 7)
  const safeButton = normals.some((m) => (m.recovery ?? 15) <= 8)
  const defense = soft(
    (by(char, 'anti-air').reduce((s, m) => s + 30 - (m.startup ?? 6) * 2, 0) +
      by(char, 'counter').length * 20 + (fastSuper ? 22 : 0) + (safeButton ? 14 : 0)
      // A bigger bar is defence nobody had to earn; glass is the opposite.
      + (healthMultOf(char) - 1) * 90
      // A small hurtbox is harder to open up in the first place.
      - sizeModOf(char).comboEase * 60))

  // Body type is a real balance lever, not decoration: a big target eats
  // longer routes and moves worse, a small one is slippery, and a tank's
  // extra bar is defence you don't have to earn.
  const sz = sizeModOf(char)
  const mobility = soft(
    by(char, 'movement').reduce((s, m) => s + 44 - (m.startup ?? 5) * 2 - (m.recovery ?? 10), 0)
    + Math.min(speed, 100) / 4 + sz.mobility)

  const meter = soft(
    by(char, 'super').reduce((s, m) => s + (m.damage ?? 0) / Math.max(m.meterCost ?? 100, 25), 0) * 11 +
    by(char, 'install').reduce((s, m) => s + 8 + (m.duration || 0), 0))

  return { speed, offense, pressure, zoning, defense, mobility, meter }
}

/**
 * What a character is worth once you count what they can BECOME.
 *
 * A form origin doesn't own its form's kit — it owns a button that fetches
 * it. So each axis moves from the origin's own value toward the best value
 * any reachable form has on that axis, scaled by how cheaply the origin can
 * get there (`accessOf`: meter, startup, safety on block). A free, instant,
 * safe transformation means the origin very nearly IS the form; a full-bar
 * launch-punishable one means they mostly aren't, and have to earn it.
 *
 * Only the axes the form is BETTER at move. Turning into a slower character
 * doesn't make you slower — you weren't obliged to press the button. That
 * asymmetry is the whole reason forms are worth designing, and the whole
 * reason they need to be priced: without this, an unremarkable origin with a
 * monster form read as an unremarkable character and the chart lied about
 * every matchup they were in.
 *
 * HEALTH IS NOT FOLDED IN. The bar belongs to whoever started the round, so a
 * glass-bodied origin with a tank form keeps the glass bar — which is exactly
 * how transformations work in the games this is modelling, and is handled by
 * `healthMultOf` reading the origin.
 */
export function ratings(char, rules = null, game = null) {
  const own = ownRatings(char, rules)
  if (!game) return own
  const forms = reachableForms(game, char)
  if (!forms.length) return own
  const out = { ...own }
  for (const { form, access } of forms) {
    // No `game` on this call: forms cannot own forms (see forms.js), so this
    // is a hard stop rather than a depth limit.
    const rf = ownRatings(form, rules)
    for (const k of RATING_KEYS) {
      out[k] = out[k] + Math.max(0, rf[k] - out[k]) * access
    }
  }
  return out
}

// How far past sane design a kit goes, summed across every axis. This is
// the "your numbers are illegal" score — 0 for anything reasonable.
//
// Re-tuned for the descriptor overhaul (2026-07-25). Frame data and damage
// used to be typed in, so a 4000-damage frame-1 jab was expressible and the
// overflow ran away to ~155+. Descriptors cap what can be BUILT, so the
// ceiling fell to ~124 — but the typical design still sits around 85, exactly
// where it did before. So the threshold stays at 100 (dropping it flattens
// the damage factor, because almost every kit clears 88) and the weight rises
// instead, keeping the "your numbers are illegal" signal as loud as it was
// across a smaller overflow band.
const OVERTUNE_FLOOR = 100

export function overtune(r) {
  return ['speed', 'offense', 'pressure', 'zoning', 'defense', 'mobility', 'meter']
    .reduce((s, k) => s + Math.max(0, r[k] - OVERTUNE_FLOOR), 0) * 1.7
}

// ---------- The style triangle ----------
// The stat factors below are all TRANSITIVE: every one of them reduces to
// "my total minus your total" (keepout expands to 0.06*((za-zb)+(ma-mb))),
// which can only ever produce a linear power ranking. Measured across 16
// archetypes it did exactly that — everyone's best matchup was the same
// archetype and everyone's worst was the same one. No cycles anywhere.
//
// Real rock-paper-scissors needs a term that is genuinely non-transitive, so
// here it is, explicit and designed rather than emergent:
//
//     KEEP-OUT beats GRAPPLER   — they can't walk through it
//     GRAPPLER beats RUSHDOWN   — the grab beats blocking and mashing
//     RUSHDOWN beats KEEP-OUT   — they're fast enough to get in
//
// Balanced styles sit outside the wheel: no free win, no free loss.
export const STYLE_ROLES = {
  'Zoner': 'keep-out',
  'Weapon Master': 'keep-out',
  'Charge': 'keep-out',
  'Setplay': 'keep-out',
  'Puppet': 'keep-out',
  'Rushdown': 'rushdown',
  'Aerial': 'rushdown',
  'Mix-up': 'rushdown',
  'Glass Cannon': 'rushdown',
  'Grappler': 'grappler',
  'Big Body': 'grappler',
  'Counter-Puncher': 'grappler',
  'Shoto': 'balanced',
  'All-Rounder': 'balanced',
  'Footsies': 'balanced',
  'Stance Switch': 'balanced',
}

export const STYLE_BEATS = { 'keep-out': 'grappler', 'grappler': 'rushdown', 'rushdown': 'keep-out' }

export const STYLE_WHY = {
  'keep-out|grappler': 'walls them out — a grappler that can\'t walk forward has no game',
  'grappler|rushdown': 'the grab beats blocking, and rushdown has to stop eventually',
  'rushdown|keep-out': 'fast enough to get in, and once in the wall means nothing',
}

const STYLE_EDGE = 7

export function styleRoleOf(char) {
  return STYLE_ROLES[char?.archetype] || 'balanced'
}

/** +STYLE_EDGE if a's style beats b's, negative if it loses, 0 otherwise. */
export function styleEdge(a, b) {
  const ra = styleRoleOf(a)
  const rb = styleRoleOf(b)
  if (ra === rb || ra === 'balanced' || rb === 'balanced') return 0
  if (STYLE_BEATS[ra] === rb) return STYLE_EDGE
  if (STYLE_BEATS[rb] === ra) return -STYLE_EDGE
  return 0
}

// The stat side of a matchup. Archetype interactions read the sane band; the
// 'tuning' factor reads everything past it — raw numbers that outgrow design
// get an edge no archetype advantage can answer.
function factors(ra, rb) {
  const band = (v) => Math.min(v, OVERTUNE_FLOOR)
  return [
    { key: 'keepout', edge: (band(ra.zoning) - band(rb.mobility)) * 0.06 - (band(rb.zoning) - band(ra.mobility)) * 0.06 },
    { key: 'pressure', edge: (band(ra.pressure) - band(rb.defense)) * 0.06 - (band(rb.pressure) - band(ra.defense)) * 0.06 },
    { key: 'damage', edge: (band(ra.offense) - band(rb.offense)) * 0.05 },
    { key: 'speed', edge: (band(ra.speed) - band(rb.speed)) * 0.04 },
    { key: 'meter', edge: (band(ra.meter) - band(rb.meter)) * 0.03 },
    { key: 'tuning', edge: (overtune(ra) - overtune(rb)) * 0.5 },
  ]
}

// `game` is optional but wanted: without it neither side's FORMS count, and a
// form origin reads as whatever it is before it transforms. Every caller that
// has a game in hand should pass it.
export function computeMatchup(a, b, rules = null, game = null) {
  const ra = ratings(a, rules, game)
  const rb = ratings(b, rules, game)
  let edge = factors(ra, rb).reduce((s, f) => s + f.edge, 0) + styleEdge(a, b)
  // Irreducible matchup jank: some pairs are just weird, consistently.
  edge += (hash01(`${a.id}|${b.id}:mu`) - 0.5) * 4
  // The wide clamp only comes into play for genuinely broken numbers —
  // sane designs live well inside it.
  return clamp(Math.round(50 + edge), 10, 90)
}

// Why the number is what it is — the dominant factor, in plain speech.
export function matchupExplanation(a, b, rules = null, game = null) {
  const ra = ratings(a, rules, game)
  const rb = ratings(b, rules, game)
  const fs = [...factors(ra, rb), { key: 'style', edge: styleEdge(a, b) }]
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
    case 'style': {
      const w = styleRoleOf(winner)
      const l = styleRoleOf(loser)
      return `${winner.name} ${STYLE_WHY[`${w}|${l}`] || 'has the stylistic edge'}`
    }
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
  const truth = computeMatchup(a, b, game?.rules, game)
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
      // Editing a form edits everyone who can turn into it: their ratings are
      // folded from it. Without this the origin's matchups still read as
      // settled data while the character behind them has moved.
      if (c.formOf) changed.add(c.formOf)
    }
  }
  // The reverse too: pointing a form change somewhere new changes the origin
  // without touching a single move on the form.
  for (const c of draft.characters) {
    const old = liveById.get(c.id)
    if (old && (c.formOf || null) !== (old.formOf || null)) {
      changed.add(c.id)
      if (c.formOf) changed.add(c.formOf)
      if (old.formOf) changed.add(old.formOf)
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

function avgPower(chars, char, game = null) {
  const others = chars.filter((c) => c.id !== char.id)
  if (!others.length) return 50
  return others.reduce((s, o) => s + computeMatchup(char, o, game?.rules, game), 0) / others.length
}

/**
 * The COMMUNITY's tier list — not the objective chart. Starts from computed
 * power, then adds what communities actually rank on: how many people play
 * the character, who's been winning tournaments with them, and noise.
 */
export function generateTierList(save) {
  // Forms are not on the tier list. Nobody can pick one, so ranking them
  // would be ranking a move — the origin already carries their weight.
  const chars = selectableChars(save.game)
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
    perception: avgPower(chars, c, save.game)
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
  // Only pickable characters get a matchup. A form has no matchups of its own
  // — it is part of its origin's, folded in by `ratings`.
  const chars = selectableChars(game)
  const table = {}
  for (let i = 0; i < chars.length; i++) {
    for (let j = i + 1; j < chars.length; j++) {
      const a = chars[i]
      const b = chars[j]
      const [lo, hi] = a.id < b.id ? [a, b] : [b, a]
      table[`${lo.id}|${hi.id}`] = computeMatchup(lo, hi, game.rules, game)
    }
  }
  game.matchups = table
  return table
}
