// The beat engine: renders a match as moment-to-moment "footage" that is
// conditioned on the already-decided outcome. The outcome model
// (winProbability + elo) stays the source of truth for the ecosystem; this
// engine is the broadcast layer — every health tick, meter drain, and
// punish traces back to the characters' real kits and the players' real
// stats, but the bookings never contradict the meta-game.
//
// It is a PURE function of its inputs + seed: the same call always yields
// the same script, so stored seeds can regenerate footage later, and
// marquee matches can run several seeds and keep the most dramatic cut.
//
// HOW A GAME IS BUILT (the 2026-07-25 pacing rework)
// --------------------------------------------------
// Health used to be a side effect of whatever beats happened to fire, which
// meant a couple of random pokes followed by one enormous finisher. Now the
// health curve is BOOKED the same way the outcome is:
//
//   1. Pick an ARC for the game (stomp / grind / comeback / photo-finish).
//      The arc says where the winner's bar sits when they close it out and
//      roughly how many damaging exchanges it takes to get there.
//   2. Turn that into a damage SCHEDULE — each side gets a budget (total
//      damage they're allowed to deal) and a share of the exchanges.
//   3. Beats PROPOSE raw damage from the characters' real kits. The
//      scheduler SCALES that proposal to fit the remaining budget, then the
//      beat prints the scaled number. Relative honesty survives (a combo
//      still hits about twice as hard as a poke) and the bars always agree
//      with the text, but the arc lands every time.
//   4. The killing blow is FITTED: under ~15% health the engine reaches for
//      something that actually fits — chip, a jab, a throw — so a game ends
//      "the last 40 points of chip take it", not a 400-damage super into a
//      40-health opponent.
//
// Turn order is possession, not alternation: a momentum scalar decides who
// acts, one side can hold the turn across several exchanges (a zoning siege,
// a pressure sequence), and whiffs, drops and reversals flip it.
//
// Contract:
//   narrateSet(opts) → { lines, meta, hud, score, target, seed }
//   meta[i]: { kind: 'opener'|'series'|'crowd'|'bell'|'beat'|'game'|
//              'struggle'|'closer'|'phrase', actor, move, hits, curve, fx }
//   hud[i]:  { hpA, hpB, mA, mB, gA, gB } (0-100 bars, games taken)
//
// meta[i].hits/.curve drive sub-line ticking: the UI interpolates between
// hud[i-1] and hud[i] across `hits` steps, so a combo chips the bar down
// instead of teleporting it. Lines without `hits` mean one instant step,
// which is exactly how every match recorded before this rework replays.
//
// meta[i].fx drives the VFX layer: { t, side, mag, word, ko } where `t` is
// impact|super|projectile|grab|block|drop|whiff, `side` is the side being
// HIT, and `mag` is 0..1 of a heavy conversion. Old matches have no fx; the
// UI derives a plain impact from the HUD delta instead.

import { clamp } from './util.js'
import { ARCHETYPE_FLAVOR, MOVE_VERBS, FORM_VERBS, EFFECT_CLAUSES } from './names.js'
import { comboDamage, COMBO_SCALING, healthMultOf } from './design.js'
import {
  defaultRules, gutsFactor, timeOverChance, chipCanKill, burstEnabled,
  guardCrushEnabled, cancelsEnabled,
} from './rules.js'

export const HEALTH = 1000

// Deterministic RNG (mulberry32) — the engine must never touch Math.random.
function rngOf(seed) {
  let s = (seed >>> 0) || 1
  return () => {
    s |= 0; s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Comic-book impact words, picked by how hard the thing landed. The ENGINE
// chooses them rather than the UI, so the same seed always yields identical
// footage, VFX included — a replayed VOD pops the same words.
const IMPACT_WORDS = {
  light: ['TAP!', 'TIK!', 'PIP!', 'JAB!'],
  medium: ['POW!', 'BAM!', 'WHAM!', 'CRACK!', 'THWK!'],
  heavy: ['BOOM!', 'KRAKA!', 'SMASH!', 'DOOM!', 'KABLAM!'],
}

export function fxWordFor(mag, rand = 0.5) {
  const tier = mag >= 0.62 ? 'heavy' : mag >= 0.3 ? 'medium' : 'light'
  const pool = IMPACT_WORDS[tier]
  return pool[Math.floor(rand * pool.length) % pool.length]
}

/**
 * How one line's damage distributes across its ticks. `decel` borrows the
 * game's real COMBO_SCALING, so watching a combo land is watching actual
 * damage proration: the first hit takes a chunk, the seventh barely moves
 * the bar. `accel` builds into a big finish (supers). `even` is a volley.
 *
 * The UI walks these weights between two HUD snapshots; the engine never
 * stores intermediate states, just the shape.
 */
export function tickWeights(hits, curve = 'even') {
  const n = Math.max(1, Math.floor(hits) || 1)
  if (n === 1) return [1]
  let raw
  if (curve === 'decel') {
    raw = Array.from({ length: n }, (_, i) => COMBO_SCALING[i] ?? 0.25)
  } else if (curve === 'accel') {
    raw = Array.from({ length: n }, (_, i) => 0.35 + ((i / (n - 1)) ** 2) * 1.9)
  } else {
    raw = Array.from({ length: n }, () => 1)
  }
  const sum = raw.reduce((a, b) => a + b, 0)
  return raw.map((w) => w / sum)
}

/**
 * How a move describes itself. Prefers the FORM the designer chose — a
 * burrowing projectile and a screen-filling beam are both "projectiles" and
 * should never read the same — and falls back to the move's type, then melee.
 */
function verbsFor(move) {
  return FORM_VERBS[move?.d?.form] || MOVE_VERBS[move?.type] || MOVE_VERBS['melee']
}

/** What the move's rider looks like when it goes off, if it has one. */
function riderClausesFor(move) {
  const fx = move?.d?.effects || []
  if (!fx.length) return null
  return EFFECT_CLAUSES[fx[0].effect] || null
}

// Missing player stats (EVO elites) read as seasoned pros.
const DEFAULT_STATS = { composure: 7, analysis: 6, xfactor: 6, mastery: 7, dominance: 6 }

// Everything the beat generator wants to know about one side's kit.
function kitOf(char, skill) {
  const mv = char?.moves || []
  const combos = (char?.combos || [])
    .map((c) => ({ name: c.name, dmg: comboDamage(char, c), len: (c.moveIds || []).length }))
    .filter((c) => c.dmg > 0)
  const normals = mv.filter((m) => m.slot === 'normal' || ['light', 'melee', 'heavy'].includes(m.type))
  const fastestMove = normals.reduce((best, m) => ((m.startup ?? 9) < (best?.startup ?? 9) ? m : best), null)
  const specials = mv.filter((m) => m.slot === 'special' && (m.damage ?? 0) > 0)
  const projectiles = mv.filter((m) => m.type === 'projectile')
  const supers = mv.filter((m) => (m.slot === 'super' || m.type === 'super') && (m.damage ?? 0) > 0)

  // What a typical exchange from this kit looks like. The scheduler divides
  // by this to keep proposals honest RELATIVE to each other — a kit of
  // haymakers and a kit of pokes both fill their budget, but within each
  // kit the big move still reads bigger than the small one.
  const samples = [
    ...combos.map((c) => c.dmg),
    ...specials.map((m) => m.damage ?? 0),
    ...(fastestMove ? [(fastestMove.damage ?? 45) + 40] : []),
  ].filter((d) => d > 0)
  const avgRaw = samples.length ? samples.reduce((a, b) => a + b, 0) / samples.length : 110

  return {
    char,
    skill: skill || 0,
    archetype: char?.archetype || 'All-Rounder',
    combos,
    specials,
    supers,
    projectiles,
    grabs: mv.filter((m) => m.type === 'command grab'),
    counters: mv.filter((m) => m.type === 'counter'),
    antiAirs: mv.filter((m) => m.type === 'anti-air'),
    fastestMove,
    fastest: fastestMove?.startup ?? 8,
    avgRaw,
    // Moves an opponent can punish ON BLOCK — real frame data, real notes.
    // Unblockables are excluded for the obvious reason: you cannot block a
    // throw, so you cannot punish one on block either.
    unsafe: mv.filter((m) => (m.onBlock ?? -5) <= -8 && m.slot !== 'super'
      && m.d?.guard !== 'unblockable'),
    plus: mv.filter((m) => (m.onBlock ?? -5) >= 2),
    // Moves an opponent can punish ON WHIFF: long recovery is what makes
    // reaching for something at the wrong range genuinely cost you.
    laggy: mv.filter((m) => (m.recovery ?? 15) >= 22 && (m.slot !== 'super')),
    // How far they can hit from, and the button they do it with. Reach is the
    // other half of footsies: out-ranging someone means winning the ground
    // without ever being in danger.
    // A poke is long AND quick — a slow heavy that reaches is not a footsies
    // tool, and measuring raw reach makes every character look identical
    // because they all carry a heavy.
    pokes: mv.filter((m) => (m.range ?? 50) >= 65 && (m.startup ?? 11) <= 11
      && (m.damage ?? 0) > 0 && m.type !== 'projectile'),
    reach: Math.max(0, ...mv.filter((m) => (m.meterCost ?? 0) === 0 && (m.damage ?? 0) > 0
      && m.type !== 'projectile' && (m.startup ?? 11) <= 12).map((m) => m.range ?? 50)),
    stubby: mv.filter((m) => (m.range ?? 50) <= 30 && (m.damage ?? 0) > 0),
    // The guessing game: what has to be blocked standing, what has to be
    // blocked crouching, and whether they own both.
    overheads: mv.filter((m) => m.d?.guard === 'overhead'),
    lows: mv.filter((m) => m.d?.guard === 'low'),
    // A kit that wants to hold you at range and make you walk through it.
    zoner: projectiles.length >= 2 || ['Zoner', 'Setplay', 'Charge'].includes(char?.archetype),
    // Owning a fast one of each is what makes blocking a coin flip.
    mixup: mv.some((m) => m.d?.guard === 'overhead' && (m.startup ?? 99) <= 18)
      && mv.some((m) => m.d?.guard === 'low' && (m.startup ?? 99) <= 12),
  }
}

/**
 * Narrate a full set. `spice` > 1 runs extra seeds and keeps the most
 * dramatic script — use it for money matches, finals, EVO.
 */
export function narrateSet(opts) {
  const spice = clamp(opts.spice || 1, 1, 4)
  const baseSeed = (opts.seed ?? 1) >>> 0
  let best = null
  for (let i = 0; i < spice; i++) {
    const script = simulateOnce(opts, (baseSeed + i * 9973) >>> 0)
    if (!best || script.drama > best.drama) best = script
  }
  return best
}

function simulateOnce({
  aName, bName, charA, charB, skillA = 0, skillB = 0, statsA = null, statsB = null,
  probA = 0.5, winnerIsA, long = false, winnerPhrase = '', seriesNote = null,
  grudge = false, watcherCount = 0, stageName = null, marquee = false,
  rules = null,
}, seed) {
  // The universal mechanics this game is played under. A save that predates
  // them plays by the defaults, which are the behaviour it already had.
  const R_ = { ...defaultRules(), ...(rules || {}) }
  const R = rngOf(seed)
  // Never hand back the same line twice running from the same pool — the
  // fastest way to break the illusion is to punish Zenith Cutter with the
  // identical sentence two exchanges apart.
  const lastPick = new Map()
  const pick = (arr) => {
    if (arr.length === 1) return arr[0]
    let i = Math.floor(R() * arr.length)
    if (lastPick.get(arr) === i) i = (i + 1 + Math.floor(R() * (arr.length - 1))) % arr.length
    lastPick.set(arr, i)
    return arr[i]
  }
  const odds = (p) => R() < p
  const irnd = (lo, hi) => lo + Math.floor(R() * (hi - lo + 1))
  const jitter = (lo, hi) => lo + R() * (hi - lo)

  // Each fighter carries their OWN bar: a tank genuinely takes longer to put
  // down, and every threshold below is a fraction of the relevant side's max
  // rather than of some global constant.
  const maxA = Math.round(HEALTH * healthMultOf(charA))
  const maxB = Math.round(HEALTH * healthMultOf(charB))
  const A = { side: 'A', name: aName, kit: kitOf(charA, skillA), stats: statsA || DEFAULT_STATS, max: maxA, hp: maxA, meter: 0, games: 0 }
  const B = { side: 'B', name: bName, kit: kitOf(charB, skillB), stats: statsB || DEFAULT_STATS, max: maxB, hp: maxB, meter: 0, games: 0 }
  const winner = winnerIsA ? A : B
  const loser = winnerIsA ? B : A
  const winnerProb = winnerIsA ? probA : 1 - probA
  const closeness = 1 - Math.abs(probA - 0.5) * 2
  const severity = winnerProb < 0.22 ? 'severe' : winnerProb < 0.4 ? 'mild' : 'none'
  const target = long ? 3 : 2

  const lines = []
  const meta = []
  const hud = []
  const drama = { leadChanges: 0, drops: 0, supers: 0, comebacks: 0, clutch: 0, whiffs: 0, phases: 0, timeOvers: 0 }
  const snap = () => ({
    hpA: Math.round((clamp(A.hp, 0, A.max) / A.max) * 100), hpB: Math.round((clamp(B.hp, 0, B.max) / B.max) * 100),
    mA: Math.round(clamp(A.meter, 0, 100)), mB: Math.round(clamp(B.meter, 0, 100)),
    gA: A.games, gB: B.games,
  })
  const push = (text, m = {}) => {
    lines.push(text)
    meta.push({
      kind: m.kind || 'beat', actor: m.actor || null, move: m.move || null,
      ...(m.hits && m.hits > 1 ? { hits: m.hits, curve: m.curve || 'even' } : {}),
      ...(m.fx ? { fx: m.fx } : {}),
    })
    hud.push(snap())
  }

  // ---------- pre-match ----------
  if (stageName && !grudge && odds(0.4)) {
    push(pick([
      `${aName} vs ${bName} — cursor lands on ${stageName}.`,
      `Stage select: ${stageName}. ${aName} and ${bName} nod. It's on.`,
      `They take it to ${stageName}, because some fights deserve a backdrop.`,
    ]), { kind: 'opener' })
  } else {
    push((grudge ? pick([
      (a, b) => `There's history here — ${a} and ${b} skip the fist bump entirely.`,
      (a, b) => `The room goes quiet. ${a} vs ${b} is personal and everyone knows it.`,
      (a, b) => `${a} sits down without a word. ${b} doesn't look at them. Here we go.`,
    ]) : pick([
      (a, b) => `${a} and ${b} step up. The cabinet hums.`,
      (a, b) => `${a} cracks their knuckles as ${b} picks their character.`,
      (a, b) => `Quarters up. ${a} versus ${b} — winner keeps the stick warm.`,
      (a, b) => `${a} and ${b} run the customary button check, then it's on.`,
    ]))(aName, bName), { kind: 'opener' })
  }
  if (seriesNote) push(seriesNote, { kind: 'series' })
  if (watcherCount >= 3 && odds(0.6)) {
    push(pick([
      'The railbirds crowd in — this one has juice.',
      'Chairs scrape closer. Everybody wants to see this.',
      `Somebody calls "next" and gets waved off. Nobody is interrupting this.`,
    ]), { kind: 'crowd' })
  }

  // ---------- book the set ----------
  let loserGames = 0
  for (let i = 0; i < target - 1; i++) if (odds(0.12 + closeness * 0.55)) loserGames++
  if (severity !== 'none' && loserGames === 0 && odds(0.6)) loserGames = 1
  const seq = [...Array(target - 1).fill('W'), ...Array(loserGames).fill('L')]
  for (let i = seq.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [seq[i], seq[j]] = [seq[j], seq[i]] }
  seq.push('W')

  // ---------- text helpers ----------
  const fmtPlus = (v) => (v > 0 ? `+${v}` : `${v}`)
  // "the The Standard" reads like a typo — don't double the article.
  const art = (name) => (/^the\s/i.test(name) ? name : `the ${name}`)
  const pctOf = (side) => Math.round((clamp(side.hp, 0, side.max) / side.max) * 100)

  // ==========================================================================
  // BEAT PROPOSALS
  // A proposal is a beat that hasn't happened yet: it knows what it wants to
  // do and roughly how hard it hits, but not its final number. The scheduler
  // decides that, then calls text(dmg) so the printed damage is always the
  // damage the bar actually loses.
  // ==========================================================================

  // An offensive exchange from att against def.
  //   small    — reach for something that fits a nearly-empty health bar
  //   finisher — this beat must be able to end the game
  const proposeOffense = (att, def, { matchPoint = false, finisher = false, small = false, room = null } = {}) => {
    const k = att.kit
    const dstats = att.stats
    const low = att.hp <= att.max * 0.25
    const comeback = low && dstats.xfactor >= 7 && odds(0.55)
    // The name comes from the line that follows, so the prefix must not
    // repeat it — "Ari is one hit from death — Ari confirms" reads badly.
    const pre = comeback ? pick([
      `One hit from death and playing like it's warmup — `,
      `Down to a sliver and going UP a gear: `,
    ]) : ''
    if (comeback) drama.comebacks++
    // Near the end of a bar, stop reaching for things that can't finish and
    // stop narrating fumbles — a KO should never land on "couldn't convert".
    const closing = def.hp <= def.max * 0.35
    // And don't call something a full combo when there's only a sliver of
    // budget left to pay for it.
    const roomy = (room ?? def.max) > def.max * 0.16

    // --- the last sliver: reach for something small and appropriate -------
    // This is the fix for "one huge hit takes them all the way down". When
    // there's almost nothing left, you don't cash out a super into it.
    if (small) {
      // Chip only gets to take the last of someone's health if the game says
      // it can — otherwise the finish has to be a real hit.
      const proj = chipCanKill(R_) && k.projectiles.length ? pick(k.projectiles) : null
      if (proj && odds(0.5)) {
        return {
          raw: 40, hits: irnd(2, 3), curve: 'even', fx: 'projectile', kind: 'beat', actor: att.name, move: proj.name,
          cap: def.max * 0.12,
          text: (d) => `${def.name} is holding on by a thread and ${att.name} just keeps throwing — ${proj.name} chips the last ${d} away.`,
        }
      }
      if (k.fastestMove && odds(0.6)) {
        return {
          raw: 45, hits: 1, kind: 'beat', actor: att.name, move: k.fastestMove.name,
          cap: def.max * 0.12,
          text: (d) => pick([
            `${att.name} doesn't reach for anything fancy — a ${k.fastest}f ${k.fastestMove.name} for ${d} is all that's left to do.`,
            `No route needed. ${k.fastestMove.name}, ${d}, and that's the bar.`,
          ]),
        }
      }
      return {
        raw: 50, hits: 1, kind: 'beat', actor: att.name, move: null, cap: def.max * 0.12,
        text: (d) => pick([
          `${att.name} walks ${def.name} into the corner and takes the last ${d} with a single button.`,
          `One more poke. ${d}. That's all it needed to be.`,
        ]),
      }
    }

    // --- super cash-out: needs the real meter, spends the real cost -------
    const superMove = k.supers.length ? pick(k.supers) : null
    const superCost = superMove ? Math.min(100, superMove.meterCost ?? 100) : 100
    if (superMove && att.meter >= superCost && roomy && (finisher || odds(0.32))) {
      att.meter -= superCost
      drama.supers++
      // "Closes the round with a cinematic X" is a lie unless it's the kill.
      const verbs = verbsFor(superMove)
      const sRiders = riderClausesFor(superMove)
      const sRider = sRiders ? ' ' + pick(sRiders).replaceAll('{o}', def.name) : ''
      return {
        raw: superMove.damage ?? 250, hits: irnd(7, 13), curve: 'accel', fx: 'super',
        kind: 'beat', actor: att.name, move: superMove.name, cap: def.max * 0.46,
        text: (d) => `${pre}${att.name} ${pick(verbs).replaceAll('{m}', superMove.name).replaceAll('{o}', def.name)} ${d} damage.${sRider}`,
      }
    }

    // --- hit-confirm into a real combo: skill converts, composure holds ---
    if (k.combos.length && roomy && odds(finisher ? 0.55 : 0.42)) {
      const combo = pick(k.combos)
      const convert = 0.35 + k.skill * 0.006 + att.stats.mastery * 0.01
      if (!finisher && !closing && !odds(convert)) {
        // Got the hit, couldn't convert — pokes only.
        return {
          raw: k.avgRaw * 0.4, hits: 1, kind: 'beat', actor: att.name, move: null,
          momentum: -0.2, cap: def.max * 0.13, // a dropped conversion is a poke, not a combo

          text: (d) => pick([
            `${att.name} gets the hit but can't find the confirm — ${d} and the moment passes.`,
            `${att.name} lands the poke and hesitates on the follow-up. ${d}, when it could have been the round.`,
            `A clean touch for ${att.name}, but the hands don't answer — ${d} and back to neutral.`,
            `${att.name} clips ${def.name} for ${d}. The full route was there. The execution wasn't.`,
          ]),
        }
      }
      const dropP = clamp(0.05 + combo.len * 0.02 - att.stats.composure * 0.014 - k.skill * 0.0008 + (matchPoint ? 0.07 : 0), 0.02, 0.4)
      if (!finisher && !closing && odds(dropP)) {
        drama.drops++
        if (matchPoint) drama.clutch++
        return {
          raw: combo.dmg * 0.42, hits: Math.max(2, Math.min(combo.len - 1, 4)), curve: 'decel',
          kind: 'struggle', actor: att.name, move: combo.name, momentum: -0.6, fx: 'drop',
          cap: def.max * 0.2, // only part of the route landed — bill it that way
          text: (d) => `${att.name} confirms into ${art(combo.name)}… and DROPS it${matchPoint ? ' under match point pressure' : ''} — only ${d} of it lands.`,
        }
      }
      return {
        raw: combo.dmg, hits: Math.max(2, Math.min(combo.len, 6)), curve: 'decel',
        kind: 'beat', actor: att.name, move: combo.name, momentum: 0.3,
        text: (d) => `${pre}${att.name} ${pick([
          `confirms into ${art(combo.name)} — ${d} damage, the crowd counting every hit`,
          `lands the full ${combo.name}. ${d} off one touch`,
          `finds an opening and runs ${art(combo.name)} for ${d}`,
        ])}.`,
      }
    }

    // --- footsies: winning the ground with reach alone -------------------
    if (k.pokes.length && k.reach > def.kit.reach + 12 && odds(0.4)) {
      const poke = pick(k.pokes)
      return {
        raw: (poke.damage ?? k.avgRaw) * 0.9, hits: 1, kind: 'beat',
        actor: att.name, move: poke.name, momentum: 0.3, fx: 'impact',
        text: (d) => pick([
          `${att.name} stands exactly where ${poke.name} reaches and ${def.name} doesn't. ${d}, and nothing ${def.name} has can answer from there.`,
          `Pure spacing — ${poke.name} catches ${def.name} at the tip, ${d}, and ${att.name} strolls back out of range.`,
          `${def.name} steps in, gets clipped by ${poke.name} on the way, and pays ${d} for the ground.`,
        ]),
      }
    }

    // --- the high/low guess: they had to choose, and they chose wrong -----
    if ((k.overheads.length || k.lows.length) && odds(k.mixup ? 0.4 : 0.22)) {
      const high = k.overheads.length && (!k.lows.length || odds(0.5))
      const mv2 = high ? pick(k.overheads) : pick(k.lows)
      return {
        raw: (mv2.damage ?? k.avgRaw) * 1.05,
        hits: k.combos.length ? Math.max(2, Math.min(k.combos[0].len, 4)) : 1, curve: 'decel',
        kind: 'beat', actor: att.name, move: mv2.name, momentum: 0.45, fx: 'impact',
        text: (d) => (high
          ? pick([
            `${att.name} goes upstairs — ${mv2.name} has to be blocked standing and ${def.name} was crouching. ${d}.`,
            `${def.name} sits down on the block, and ${att.name} was waiting for it: ${mv2.name} overhead, ${d}.`,
            `The overhead. ${mv2.name} comes down over the guard for ${d} — ${def.name} guessed high when it mattered.`,
          ])
          : pick([
            // Every character's universal normal is literally called "Sweep",
            // so none of these may use the word as a verb.
            `${att.name} takes the legs — ${mv2.name} goes under the standing block for ${d}.`,
            `${def.name} stands up to block the overhead and eats ${mv2.name} low instead. ${d}.`,
            `${mv2.name} slips in under the guard. ${d}, and now ${def.name} has to guess all over again.`,
            `Low. ${mv2.name} catches ${def.name} standing for ${d}.`,
          ])),
      }
    }

    // --- punish an actual unsafe move ON BLOCK ---------------------------
    if (def.kit.unsafe.length && odds(0.3)) {
      const bad = pick(def.kit.unsafe)
      // With a universal cancel system, the punish isn't free — they can pay
      // meter to erase the recovery and walk away from it.
      if (cancelsEnabled(R_) && def.meter >= 50 && odds(0.35)) {
        def.meter -= 50
        return {
          raw: 0, kind: 'struggle', actor: def.name, move: bad.name, momentum: 0.3, fx: 'block',
          text: () => pick([
            `${def.name} throws ${bad.name}, sees it blocked, and burns half a bar to cancel out of the recovery. The punish evaporates.`,
            `${bad.name} gets blocked — and ${def.name} spends meter to make it safe anyway. ${att.name} has nothing.`,
          ]),
        }
      }
      return {
        raw: k.combos.length ? k.combos[0].dmg : k.avgRaw * 1.1,
        hits: k.combos.length ? Math.max(2, Math.min(k.combos[0].len, 5)) : 1, curve: 'decel',
        kind: 'beat', actor: att.name, move: bad.name, momentum: 0.4, fx: 'block',
        text: (d) => pick([
          `${def.name} throws ${bad.name} into a block — ${fmtPlus(bad.onBlock ?? -9)} — and ${att.name} takes the free punish: ${d}.`,
          `${bad.name} gets blocked. At ${fmtPlus(bad.onBlock ?? -9)} that's not a gamble, it's a donation — ${att.name} collects ${d}.`,
          `${att.name} holds the block on ${bad.name}, sees ${fmtPlus(bad.onBlock ?? -9)}, and makes ${def.name} pay ${d} for it.`,
          `Blocked. ${bad.name} is ${fmtPlus(bad.onBlock ?? -9)} and ${att.name} has known that all night: ${d}.`,
        ]),
      }
    }

    // --- command grab momentum -------------------------------------------
    if (k.grabs.length && odds(0.32)) {
      const grab = pick(k.grabs)
      return {
        raw: grab.damage ?? k.avgRaw, hits: 1, fx: 'grab', kind: 'beat', actor: att.name, move: grab.name, momentum: 0.35,
        text: (d) => `${pre}${att.name} ${pick(verbsFor(grab)).replaceAll('{m}', grab.name).replaceAll('{o}', def.name)} — ${d}.`,
      }
    }

    // --- zoning volley: real chip, ticking one projectile at a time ------
    if (k.projectiles.length && odds(0.32)) {
      const proj = pick(k.projectiles)
      const throws = irnd(3, 6)
      return {
        raw: Math.max(30, (proj.chip ?? 5) * throws + 40), hits: throws, curve: 'even', fx: 'projectile',
        kind: 'beat', actor: att.name, move: proj.name, momentum: 0.2,
        text: (d) => `${att.name} ${pick(verbsFor(proj)).replaceAll('{m}', proj.name).replaceAll('{o}', def.name)} — ${throws} of them, ${d} shaved off.`,
      }
    }

    // --- speed check: my fastest button beats yours, and here's the math --
    if (k.fastestMove && def.kit.fastestMove && k.fastest < def.kit.fastest && odds(0.3)) {
      const mirror = k.fastestMove.name === def.kit.fastestMove.name
      return {
        raw: (k.fastestMove.damage ?? 45) + 45, hits: 1, kind: 'beat', actor: att.name, move: k.fastestMove.name, momentum: 0.25,
        text: (d) => (mirror
          ? `The jab war goes to ${att.name} — their ${k.fastestMove.name} is ${k.fastest}f to ${def.name}'s ${def.kit.fastest}f, and a frame is a frame: ${d}.`
          : `Scramble — ${att.name}'s ${k.fastestMove.name} is ${k.fastest}f to ${def.kit.fastestMove.name}'s ${def.kit.fastest}f, and frame math doesn't lie: ${d}.`),
      }
    }

    // --- a special with its move verb -------------------------------------
    if (k.specials.length && odds(0.68)) {
      const m = pick(k.specials)
      const verbs = verbsFor(m)
      // Heavies and multi-hitting specials land in more than one piece.
      const hits = (m.type === 'heavy' || m.type === 'trap') && odds(0.5) ? irnd(2, 3) : 1
      // If the designer hung a rider on this move, show it going off.
      const riders = riderClausesFor(m)
      const rider = riders && odds(0.65) ? ' ' + pick(riders).replaceAll('{o}', def.name) : ''
      return {
        raw: m.damage ?? k.avgRaw * 0.8, hits, curve: 'even',
        fx: m.type === 'projectile' ? 'projectile' : m.type === 'command grab' ? 'grab' : 'impact',
        kind: 'beat', actor: att.name, move: m.name, momentum: 0.25,
        text: (d) => `${pre}${att.name} ${pick(verbs).replaceAll('{m}', m.name).replaceAll('{o}', def.name)} — ${d}.${rider}`,
      }
    }

    // --- archetype fundamentals (also the no-kit fallback) ----------------
    const pool = ARCHETYPE_FLAVOR[k.archetype] || ARCHETYPE_FLAVOR['All-Rounder']
    return {
      raw: k.avgRaw * 0.7, hits: 1, kind: 'beat', actor: att.name, move: null, momentum: 0.15,
      text: (d) => `${pre}${att.name} ${pick(pool).replaceAll('{o}', def.name)} — ${d} over the exchange.`,
    }
  }

  // ---------- neutral: the space between the hits ----------
  // Zero-damage beats. They cost no health budget, which is exactly why they
  // exist: they let a game run long and tense without running bloody, and
  // they're where spacing, baiting and risk actually become visible.
  const proposeNeutral = (att, def, gi) => {
    const k = att.kit

    // A bait: deliberately CAUSE the whiff, then take your turn. The skill
    // expression of neutral, gated on the player who reads people.
    if (def.stats.analysis >= 7 && k.laggy.length && odds(0.4)) {
      const bad = pick(k.laggy)
      drama.whiffs++
      return {
        raw: 0, fx: 'whiff', kind: 'struggle', actor: def.name, move: bad.name, momentum: -1,
        text: () => pick([
          `${def.name} walks it back just outside the range, lets ${bad.name} sail past, and strolls in. Nothing lands — but the turn just changed hands.`,
          `${def.name} has seen ${bad.name} all set. They dip out of range on purpose, and ${att.name} is left holding ${bad.recovery ?? 24} frames of recovery.`,
        ]),
      }
    }

    // A plain whiff: reached for something at the wrong range. Short buttons
    // are the ones that sail past, so prefer them when the kit has them.
    if ((k.laggy.length || k.stubby.length) && odds(0.5)) {
      const bad = k.stubby.length && odds(0.6) ? pick(k.stubby) : pick(k.laggy.length ? k.laggy : k.stubby)
      drama.whiffs++
      return {
        raw: 0, fx: 'whiff', kind: 'struggle', actor: att.name, move: bad.name, momentum: -0.7,
        text: () => pick([
          `${att.name} reaches for ${bad.name} from way too far out. It whiffs through empty air and ${def.name} just… watches it.`,
          `${bad.name} comes out at nothing. ${att.name} is stuck in it, and ${def.name} is already moving.`,
          `A whiffed ${bad.name}. No damage, no harm — except ${def.name} now knows it's in there.`,
        ]),
      }
    }

    // The download: analysis turning into knowing.
    if (gi > 0 && def.stats.analysis >= 7 && odds(0.45)) {
      return {
        raw: 0, kind: 'beat', actor: def.name, momentum: -0.5,
        text: () => pick([
          `${def.name} has the download now — the trick that won game ${gi} gets blocked on sight.`,
          `${def.name} stops guessing and starts KNOWING. Everything ${att.name} tries gets checked.`,
        ]),
      }
    }

    // Two people not doing anything, which in a fighting game is everything.
    return {
      raw: 0, kind: 'crowd', actor: def.name, momentum: -0.25,
      text: () => pick([
        `${def.name} blocks it all — the round slows to a staring contest at half screen.`,
        `${def.name} weathers the storm, life bar intact, meter ticking up.`,
        `Nothing lands for a beat. Two characters walking back and forth, both bars frozen. Somebody has to blink.`,
        `${att.name} inches forward, ${def.name} inches back. Neither wants to press first.`,
      ]),
    }
  }

  // BURST: the universal escape. Nothing lands, but the turn ends — which is
  // exactly what makes pressure characters worse in a game that has one.
  const proposeBurst = (def, att) => ({
    raw: 0, kind: 'struggle', actor: def.name, momentum: -1, fx: 'block',
    text: () => pick([
      `${def.name} BURSTS out of it — the combo dies mid-route and ${att.name} gets launched off.`,
      `${def.name} has had enough and cashes the burst. ${att.name}'s turn is over, just like that.`,
      `The burst. ${def.name} refuses to sit in another blockstring and blows ${att.name} off them.`,
    ]),
  })

  // GUARD CRUSH: blocking forever stops being free once there's a gauge.
  const proposeGuardCrush = (att, def) => ({
    raw: def.max * 0.09, hits: 1, kind: 'beat', actor: att.name, momentum: 0.7,
    cap: def.max * 0.2, fx: 'impact',
    text: (d) => pick([
      `${def.name}'s guard finally gives — the gauge empties and ${att.name} walks straight through it for ${d}.`,
      `Guard crush. ${def.name} held the block one string too long and pays ${d} for it.`,
    ]),
  })

  // A true WHIFF PUNISH — distinct from punishing a blocked move. The
  // severity comes off the whiffed move's recovery, which is the only place
  // in the engine where recovery frames get to matter.
  const proposeWhiffPunish = (att, def) => {
    // `def` here is whoever just whiffed. Fall back to any move of theirs
    // rather than trusting the caller's guard.
    const bad = def.kit.laggy.length ? pick(def.kit.laggy) : (def.kit.specials[0] || def.kit.fastestMove)
    if (!bad) return null
    const rec = bad.recovery ?? 24
    const k = att.kit
    return {
      raw: (k.combos.length ? k.combos[0].dmg : k.avgRaw) * clamp(rec / 24, 0.7, 1.5),
      hits: k.combos.length ? Math.max(2, Math.min(k.combos[0].len, 5)) : 1, curve: 'decel',
      kind: 'beat', actor: att.name, move: bad.name, momentum: 0.6,
      text: (d) => pick([
        `There it is — ${def.name} whiffs ${bad.name} and ${rec} frames of recovery is an invitation. ${att.name} walks in and takes ${d}.`,
        `${bad.name} whiffs, and ${att.name} was already running. ${rec} frames is a lifetime: ${d}.`,
        `${att.name} whiff punishes ${bad.name} on reaction — ${d}, and it was free the moment ${def.name} pressed it.`,
      ]),
    }
  }

  // ==========================================================================
  // THE SCHEDULER
  // ==========================================================================

  // How much of their bar the game's loser gets to take off the winner, and
  // over how many exchanges. This is the whole pacing rework in one function.
  const bookArc = ({ gWinProb, isFinal, matchPoint }) => {
    const closeGame = 1 - Math.abs(gWinProb - 0.5) * 2
    const w = {
      stomp: 0.7 + gWinProb * 1.9,
      grind: 1.9 + closeGame * 1.0,
      comeback: 0.6 + closeGame * 0.8 + (marquee ? 0.25 : 0),
      photo: 0.3 + closeGame * 1.1 + (matchPoint ? 0.8 : 0) + (marquee ? 0.35 : 0) + (isFinal ? 0.3 : 0),
    }
    const total = w.stomp + w.grind + w.comeback + w.photo
    let roll = R() * total
    let kind = 'grind'
    for (const key of ['stomp', 'grind', 'comeback', 'photo']) {
      if (roll < w[key]) { kind = key; break }
      roll -= w[key]
    }
    const endFrac = kind === 'stomp' ? jitter(0.45, 0.72)
      : kind === 'grind' ? jitter(0.22, 0.42)
        : kind === 'comeback' ? jitter(0.1, 0.24)
          : jitter(0.02, 0.08)
    // How big a typical bite is THIS game. Beat counts fall out of this
    // rather than being picked directly, which matters for two reasons:
    // the per-beat share stays well under the hard cap (so damage numbers
    // spread out instead of piling up on the cap), and a photo finish
    // automatically plays out in smaller, tenser increments than a stomp.
    // Does the clock beat them to it? A stomp never goes the distance, and a
    // 'draw' rule or no timer means it never happens at all.
    const timeOver = kind !== 'stomp' && odds(timeOverChance(R_))
    const chunkFrac = kind === 'stomp' ? jitter(0.33, 0.39)
      : kind === 'comeback' ? jitter(0.25, 0.31)
        : kind === 'photo' ? jitter(0.2, 0.26)
          : jitter(0.29, 0.35)
    return { kind, endFrac, chunkFrac, timeOver }
  }

  // Scale a proposal to fit the remaining budget, commit it, and push the
  // line with the number the bar is actually going to lose.
  const commit = (prop, actorSide, defSide, sched) => {
    let dmg = 0
    if (prop.raw > 0) {
      const s = sched[actorSide.side]
      const perBeat = s.budget / Math.max(1, s.beats)
      // Relative honesty, bounded. A wide band sounds better than it plays:
      // most proposals (pokes, chip, dropped confirms) sit well under the kit
      // average, so a loose floor quietly doubles the number of exchanges a
      // bar takes to clear — and doubles the line count with it.
      const factor = clamp(prop.raw / Math.max(actorSide.kit.avgRaw, 1), 0.65, 1.5)
      // Re-centre it. Most proposals sit under the kit average, so a raw
      // factor averages ~0.85 — every beat quietly undershoots its share and
      // the bar needs extra exchanges to clear, inflating the whole match.
      // This maps the band onto a mean of 1 while preserving the ordering.
      const share = 0.55 + factor * 0.5
      // The cap is absolute. Nothing — not a super, not the last beat on the
      // ledger, not the finisher — is allowed to take a bar in one line.
      // A full combo taking 35-45% of a bar is what real fighting games do.
      // The thing we're preventing is a SINGLE hit ending a healthy fighter,
      // not big damage as such.
      // Jittered, because a fixed ceiling that gets hit often stops reading as
      // damage and starts reading as a constant — four 380s in one set.
      const cap = Math.min(prop.cap ?? defSide.max * 0.38, defSide.max * 0.48) * jitter(0.84, 1)
      dmg = Math.round(perBeat * share * jitter(0.85, 1.15))
      // Guts: damage falls off as the defender's health does, so the last
      // chunk of a bar genuinely refuses to melt.
      dmg = Math.round(dmg * gutsFactor(R_, clamp(defSide.hp, 0, defSide.max) / defSide.max))
      dmg = clamp(dmg, Math.round(defSide.max * 0.03), Math.round(cap))
      dmg = Math.max(0, Math.min(dmg, s.budget))
      // Don't leave behind a scrap so small it needs its own line to clear.
      const leftover = s.budget - dmg
      if (leftover > 0 && leftover <= defSide.max * 0.04 && s.budget <= cap) dmg = s.budget
      s.budget -= dmg
      s.beats = Math.max(0, s.beats - 1)
      defSide.hp -= dmg
      actorSide.meter += irnd(8, 15)
      defSide.meter += irnd(4, 9)
    } else {
      actorSide.meter += irnd(5, 10)
      defSide.meter += irnd(5, 10)
    }
    // A tick has to be worth rendering: drop hits until the SMALLEST step
    // still moves the bar about a percent. Decel curves taper hard, so this
    // matters most exactly where it's prettiest.
    let hits = prop.raw > 0 ? Math.max(1, Math.floor(prop.hits || 1)) : 1
    while (hits > 1 && Math.min(...tickWeights(hits, prop.curve)) * dmg < 12) hits--

    // The visual. Magnitude is the share of a full bar this line took, so a
    // chip volley pops small and a super shakes the cabinet.
    const mag = clamp(dmg / (defSide.max * 0.42), 0, 1)
    const fxType = prop.fx || (prop.raw > 0 ? 'impact' : null)
    const fx = fxType && {
      t: fxType,
      side: defSide.side,
      mag: prop.raw > 0 ? Math.max(mag, 0.12) : 0.2,
      word: prop.raw > 0 && fxType !== 'block' ? fxWordFor(mag, R()) : null,
      ko: defSide.hp <= 0,
    }
    push(prop.text(dmg), {
      kind: prop.kind, actor: prop.actor, move: prop.move,
      hits, curve: prop.curve, fx,
    })
    return dmg
  }

  // ---------- possession phases: one side holds the turn ----------
  // A zoner doesn't take turns. They set a wall up and make you walk through
  // it, and the story of the round is the walk. Same shape covers pressure
  // sequences and okizeme.
  const runPhase = (att, def, sched, { length }) => {
    const k = att.kit
    const zoning = k.zoner && k.projectiles.length > 0
    const proj = k.projectiles.length ? pick(k.projectiles) : null
    drama.phases++

    if (zoning && proj) {
      push(pick([
        `${att.name} backs up to the corner and starts building the wall — ${proj.name}, then another, then another. ${def.name} has to come get it.`,
        `${att.name} takes centre screen and puts ${proj.name} on a metronome. There is no way to ${def.name} that isn't through it.`,
      ]), { kind: 'crowd', actor: att.name, move: proj.name })
    } else {
      const plus = k.plus.length ? pick(k.plus) : null
      push(plus
        ? `${att.name} gets in behind ${plus.name} — ${fmtPlus(plus.onBlock ?? 2)} on block — and simply does not leave.`
        : `${att.name} corners ${def.name} and starts the turn that doesn't end.`,
        { kind: 'crowd', actor: att.name, move: plus?.name || null })
    }

    // The walk: chip accumulating while the other side tries to close.
    for (let i = 0; i < length; i++) {
      if (sched[att.side].budget <= 0) break
      if (zoning && proj) {
        const throws = irnd(2, 4)
        commit({
          raw: Math.max(24, (proj.chip ?? 5) * throws + 25), hits: throws, curve: 'even', fx: 'projectile',
          kind: 'beat', actor: att.name, move: proj.name, cap: def.max * 0.16,
          text: (d) => pick([
            `${def.name} creeps forward behind a block and eats ${throws} more on the way in — ${d}.`,
            `${def.name} tries to jump it. ${att.name} was waiting: ${d} and back to full screen.`,
            `Another ${throws} ${proj.name}. ${def.name} is closer, and ${d} lighter for it.`,
          ]),
        }, att, def, sched)
      } else {
        commit({
          raw: def.max * 0.06, hits: irnd(2, 4), curve: 'even',
          kind: 'beat', actor: att.name, move: null, cap: def.max * 0.14,
          text: (d) => pick([
            `${def.name} blocks the string and takes ${d} in chip for the privilege.`,
            `${att.name} resets the pressure. ${d} more off the top, and ${def.name} still hasn't had a turn.`,
          ]),
        }, att, def, sched)
      }
      if (def.hp <= 0) return 0
    }

    // How the siege breaks.
    if (odds(0.55)) {
      push(zoning
        ? pick([
          `And then ${def.name} is just… there. Point blank, past the wall, and the whole room exhales. ${att.name}'s turn is over.`,
          `${def.name} finally slips through at the exact right angle. ${att.name} has nowhere to throw it now.`,
        ])
        : pick([
          `${def.name} finds the gap in the string and takes their turn back.`,
          `${def.name} guesses right for once, and ${att.name} is the one on the back foot.`,
        ]), { kind: 'struggle', actor: def.name })
      return -1 // possession flips to def
    }
    push(zoning
      ? pick([
        `${def.name} commits to the approach, guesses wrong at the threshold, and gets sent right back to where they started.`,
        `${def.name} gets impatient. ${att.name} has been waiting for impatient all round.`,
      ])
      : pick([
        `${def.name} mashes at the gap that isn't there. ${att.name} keeps the turn.`,
        `${def.name} tries to escape and finds the exit is also covered.`,
      ]), { kind: 'crowd', actor: att.name })
    return 1 // possession holds
  }

  // ---------- play the games ----------
  let w = 0
  let l = 0
  // Sieges are a SET-level allowance, not a per-game one. One good zoning
  // wall is a story; one every game is a chore.
  let phaseBudget = marquee ? 2 : 1
  seq.forEach((g, gi) => {
    const isFinal = gi === seq.length - 1
    const gWinner = g === 'W' ? winner : loser
    const gLoser = g === 'W' ? loser : winner
    const matchPoint = isFinal && seq.length > 1 && l === target - 1

    // The bell: fresh health, carried meter — its own line, so the bars
    // visibly reset on screen.
    A.hp = A.max; B.hp = B.max
    if (gi === 0) {
      push(pick([
        'Both bars fill. Game one — fight.',
        'Character select locks in. Round one.',
        'The bars flash full and the first game is live.',
      ]), { kind: 'bell' })
    } else if (matchPoint) {
      push(`Final game. Match point both ways. The whole arcade holds its breath.`, { kind: 'crowd' })
    } else {
      const meterNote = gWinner.meter >= 70 ? ` ${gWinner.name} walks in with a full bar banked.`
        : gLoser.meter >= 70 ? ` ${gLoser.name} has the meter — everyone knows what that means.` : ''
      const score = w === l ? `${w}–${l}` : `${Math.max(w, l)}–${Math.min(w, l)}`
      push(pick([
        `Game ${gi + 1}. Fresh bars, same tension — ${score} in the set.${meterNote}`,
        `They run it back. Game ${gi + 1}.${meterNote}`,
        `Bars reset. ${score}. Game ${gi + 1} is live.${meterNote}`,
      ]), { kind: 'bell' })
    }

    // Book the shape of this game, then turn it into two ledgers.
    const gWinProb = gWinner === winner ? winnerProb : 1 - winnerProb
    const arc = bookArc({ gWinProb, isFinal, matchPoint })
    // A timed-out round ends with BOTH fighters standing, so the two bars get
    // booked against each other: the winner simply has more left. A
    // photo-finish decision is where the one-pixel wins live.
    const timeOver = arc.timeOver
    const loserEndFrac = timeOver ? jitter(0.05, 0.3) : 0
    const decisionGap = arc.kind === 'photo' ? jitter(0.01, 0.05) : jitter(0.06, 0.22)
    const winnerEndFrac = timeOver ? Math.min(0.85, loserEndFrac + decisionGap) : arc.endFrac
    // The loser's budget is a share of the WINNER's bar (that's whose health
    // they're eating into); the winner's is the loser's whole bar.
    const loserBudget = Math.round(gWinner.max * (1 - winnerEndFrac))
    // Each side needs however many exchanges its own ledger implies.
    const wBeats = Math.max(3, Math.round(1 / arc.chunkFrac))
    const lBeats = loserBudget > 0 ? Math.max(1, Math.round((loserBudget / gWinner.max) / arc.chunkFrac)) : 0
    const wTotal = Math.round(gLoser.max * (1 - loserEndFrac))
    const lTotal = loserBudget
    const sched = {
      [gWinner.side]: { budget: Math.round(gLoser.max * (1 - loserEndFrac)), beats: wBeats },
      [gLoser.side]: { budget: loserBudget, beats: lBeats },
    }
    // A side is "done" once there's not enough left to be worth a line.
    const spent = (side) => 1 - sched[side.side].budget / Math.max(1, side === gWinner ? wTotal : lTotal)
    const drained = (side) => sched[side.side].budget < (side === gWinner ? gLoser.max : gWinner.max) * 0.03

    // Neutral is free health-wise, so it needs its own leash or a match
    // turns into two people staring at each other.
    let neutralLeft = marquee ? irnd(0, 2) : irnd(0, 1)
    let burstsLeft = burstEnabled(R_) ? 1 : 0
    let crushesLeft = guardCrushEnabled(R_) ? 1 : 0
    // A siege isn't only a zoner holding you out — a pressure character who
    // simply refuses to give the turn back runs the same shape, and runPhase
    // already narrates both.
    // A threshold of 2 plus-moves swung this metric between 45% and 88% run
    // to run — too brittle against generation dice. Anything that can hold a
    // turn qualifies: a wall, a plus button, or a setup to sit behind.
    const sieger = (s) => s.kit.zoner || s.kit.plus.length >= 1
      || s.kit.char?.moves?.some((m) => ['set up', 'trap'].includes(m.type))
    const phaseAllowed = phaseBudget > 0 && (sieger(gWinner) || sieger(gLoser) || marquee)
    let possession = gWinner // whoever currently has the turn
    let momentum = 0.35 // >0 favours the game's winner keeping it
    let lastLeader = null
    let guard = 60

    const flipTo = (side) => { possession = side; momentum = side === gWinner ? 0.25 : -0.25 }

    const roundLive = () => (timeOver ? !drained(gWinner) : gLoser.hp > gLoser.max * 0.03)
    while (roundLive() && guard-- > 0) {
      const att = possession
      const def = att === gWinner ? gLoser : gWinner
      const attSched = sched[att.side]

      // A held phase: only the side with real momentum and budget gets one.
      if (phaseAllowed && phaseBudget > 0 && attSched.budget > def.max * 0.3 && attSched.beats >= 3 && odds(0.6)) {
        phaseBudget--
        const held = runPhase(att, def, sched, { length: marquee ? irnd(2, 3) : 1 })
        if (def.hp <= 0) break
        if (held < 0) flipTo(def)
        continue
      }

      // The universal defensive escape: available once, and only when the
      // side eating it is genuinely under the cosh.
      if (burstsLeft > 0 && momentum * (att === gWinner ? 1 : -1) > 0.5 && odds(0.4)) {
        burstsLeft--
        commit(proposeBurst(def, att), def, att, sched)
        flipTo(def)
        continue
      }

      // Guard crush: the payoff for a gauge system, and the answer to
      // somebody simply holding back forever.
      if (crushesLeft > 0 && attSched.budget > def.max * 0.15 && odds(0.3)) {
        crushesLeft--
        commit(proposeGuardCrush(att, def), att, def, sched)
        if (def.hp <= 0) break
        continue
      }

      // Neutral: nothing lands, and that's the point.
      if (neutralLeft > 0 && odds(0.3)) {
        neutralLeft--
        const n = proposeNeutral(att, def, gi)
        commit(n, att, def, sched)
        momentum += n.momentum ?? 0
        // A whiff is an opening — sometimes the other side actually takes it.
        // The punish reads the WHIFFER's laggy moves (att is the one who just
        // reached), so that's the side that has to have one. This guard used
        // to check `def` and check it inverted; it only ever worked because
        // every generated kit happened to own a slow-recovery move.
        if (n.move && att.kit.laggy.length > 0 && sched[def.side].budget > 0 && odds(0.45)) {
          const wp = proposeWhiffPunish(def, att)
          if (wp) {
            commit(wp, def, att, sched)
            flipTo(def)
          }
        } else if ((n.momentum ?? 0) <= -0.7) {
          flipTo(def)
        }
        continue
      }

      // A damaging exchange. Momentum says who's likelier to land it — but
      // the schedule gets a vote. A side running behind its own ledger gets
      // pulled forward, so the booked ending actually arrives instead of the
      // winner quietly running away with every game.
      const behind = clamp((spent(gWinner) - spent(gLoser)) * 0.55, -0.28, 0.28)
      let actor = odds(clamp(0.5 + momentum * 0.35 - behind, 0.12, 0.9)) ? gWinner : gLoser
      if (drained(actor)) actor = actor === gWinner ? gLoser : gWinner
      if (drained(actor)) break
      const victim = actor === gWinner ? gLoser : gWinner

      // Fit the finish: if the victim is nearly out, reach for something small.
      const small = victim.hp <= victim.max * 0.15
      const prop = proposeOffense(actor, victim, { matchPoint, small, room: sched[actor.side].budget })
      commit(prop, actor, victim, sched)
      momentum = clamp(momentum + (actor === gWinner ? 1 : -1) * (prop.momentum ?? 0.2), -1, 1)
      if (actor !== possession) flipTo(actor)

      // The booked loser can NEVER close the game: their would-be killing
      // blow becomes the drop everyone remembers.
      if (gWinner.hp <= 0) {
        gWinner.hp = irnd(15, 60)
        drama.drops++
        drama.clutch++
        lines[lines.length - 1] = `${gLoser.name} has the kill on screen — and drops the route that ends it. ${gWinner.name} survives on ${pctOf(gWinner)}%.`
        meta[meta.length - 1] = { kind: 'struggle', actor: gLoser.name, move: null }
        hud[hud.length - 1] = snap()
        sched[gLoser.side].budget = 0
        flipTo(gWinner)
      }
      if (gLoser.hp <= 0) break

      const leader = A.hp === B.hp ? lastLeader : (A.hp > B.hp ? 'A' : 'B')
      if (lastLeader && leader !== lastLeader) drama.leadChanges++
      lastLeader = leader
    }

    // The kill: if the game isn't over yet, the winner closes it now — with
    // something that FITS. No 400-damage supers into 40 health.
    // TIME. Nobody went down, so the health lead decides it — and when the
    // margin is a sliver, this is the most exciting ending the game has.
    if (timeOver && gLoser.hp > 0) {
      const wPct = pctOf(gWinner)
      const lPct = pctOf(gLoser)
      const margin = wPct - lPct
      if ((R_.timeoutRule ?? 'health lead wins') === 'sudden death') {
        push(pick([
          `TIME — and it's dead level. SUDDEN DEATH: first clean hit ends it.`,
          `The clock hits zero with nothing between them. Sudden death. One hit.`,
        ]), { kind: 'crowd' })
        commit(proposeOffense(gWinner, gLoser, { matchPoint, finisher: true, small: true, room: gLoser.hp }),
          gWinner, gLoser, sched)
        gLoser.hp = 0
        hud[hud.length - 1] = snap()
      } else {
        push(margin <= 3 ? pick([
          `TIME! ${gWinner.name} takes it on the health lead — ${wPct}% to ${lPct}%. A PIXEL. The room loses it.`,
          `The clock beats them both. ${wPct}% to ${lPct}% — ${gWinner.name} wins the decision by a sliver of red.`,
        ]) : pick([
          `TIME! No knockout — ${gWinner.name} takes the decision, ${wPct}% to ${lPct}%.`,
          `The clock runs out with both still standing. ${gWinner.name} was ahead where it counted: ${wPct}% to ${lPct}%.`,
        ]), { kind: 'beat', actor: gWinner.name })
        if (margin <= 3) drama.clutch += 2
        drama.timeOvers++
      }
    }

    // Close it out. Each blow still respects the cap, so a big remaining bar
    // takes more than one — which is the point. The last one is FITTED to
    // whatever sliver is left.
    let closing = timeOver ? 0 : 4
    while (gLoser.hp > 0 && closing-- > 0) {
      const small = gLoser.hp <= gLoser.max * 0.15
      sched[gWinner.side].budget = Math.max(sched[gWinner.side].budget, gLoser.hp)
      sched[gWinner.side].beats = Math.max(1, Math.ceil(gLoser.hp / (gLoser.max * 0.3)))
      commit(proposeOffense(gWinner, gLoser, { matchPoint, finisher: true, small }), gWinner, gLoser, sched)
    }
    if (gLoser.hp > 0 && !timeOver) {
      const pct = pctOf(gLoser)
      gLoser.hp = 0
      lines[lines.length - 1] += ' ' + pick([
        `The knockdown pressure takes the rest.`,
        `${gWinner.name} stays glued to the wakeup and the last ${pct}% evaporates.`,
        `The corner does the rest of the work.`,
        `From there it's oki until the bar is gone.`,
      ])
      hud[hud.length - 1] = snap()
    }
    if (g === 'W') w++
    else l++
    gWinner.games++

    // Fold the game call into the KO line itself: one line ends the game,
    // and the HUD ticks the round pip on that exact line.
    const winnerPct = pctOf(gWinner)
    const clutchKO = winnerPct <= 8
    if (clutchKO) drama.clutch++
    if (!isFinal) {
      let clause
      if (gi === 0) clause = pick([', and takes the opener', ', to bank game one'])
      else if (w === l) clause = `, evening the set at ${Math.max(w, l)}–${Math.min(w, l)}`
      else {
        const score = gWinner === winner ? `${w}–${l}` : `${l}–${w}`
        clause = pick([`, to go up ${score}`, ` — ${score}, and ${gLoser.name} is one game from the exit`])
      }
      lines[lines.length - 1] = lines[lines.length - 1].replace(/[.!]\s*$/, '') + clause + '.'
      meta[meta.length - 1] = { ...meta[meta.length - 1], kind: 'game' }
    }
    hud[hud.length - 1] = snap() // the KO line shows the fresh pip and empty bar
  })

  // ---------- the closer ----------
  const score = `${target}–${loserGames}`
  const finalPct = pctOf(winner)
  let closer
  if (severity === 'severe') {
    closer = pick([
      `${winner.name} takes the set ${score}. The arcade ERUPTS — nobody had this on their card.`,
      `It's over — ${winner.name} wins ${score}. ${loser.name} stares at the screen, controller still in hand.`,
    ])
  } else if (finalPct <= 8) {
    closer = pick([
      `${winner.name} wins the set ${score} with ${finalPct}% left on the bar. A pixel. That's the whole margin.`,
      `${finalPct}%. That's what ${winner.name} has left after ${score}. Nobody in the building is sitting down.`,
    ])
  } else if (severity === 'mild') {
    closer = pick([
      `${winner.name} closes it out ${score}. A quiet upset — the room saw it coming a game too late.`,
      `${winner.name} takes the set ${score}, and ${loser.name} is already asking for the runback.`,
    ])
  } else if (loserGames === target - 1) {
    closer = pick([
      `Last hit lands — ${winner.name} escapes the set ${score} with ${finalPct}% left!`,
      `${winner.name} clutches the decider ${score}. What a set.`,
    ])
  } else if (loserGames === 0 && winnerProb > 0.7) {
    closer = pick([
      `A clean ${score} sweep. ${winner.name} never looked worried.`,
      `${winner.name} sweeps it ${score}. Total control from the character select screen.`,
    ])
  } else {
    closer = pick([
      `${winner.name} takes the set ${score}.`,
      `That's the set — ${winner.name} wins ${score}.`,
    ])
  }
  push(closer, { kind: 'closer', actor: winner.name })

  if (winnerPhrase && odds(0.4)) {
    push(`${winner.name} stands up: "${winnerPhrase}"`, { kind: 'phrase', actor: winner.name })
  }

  // Density, not volume. Every drama ingredient also costs lines, so without
  // the length penalty `spice` would just keep whichever seed rambled longest.
  const dramaScore = drama.timeOvers * 3 + drama.leadChanges * 2 + drama.drops * 2 + drama.supers * 2
    + drama.comebacks * 3 + drama.clutch * 4 + drama.phases * 2 + drama.whiffs
    + (loserGames === target - 1 ? 4 : 0)
    - lines.length * 0.4
  return { lines, meta, hud, score, target, loserGames, seed, drama: dramaScore }
}
