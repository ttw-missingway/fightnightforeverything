// The eureka spine — REVISION §1. The most important system in the game.
//
// Every player carries PER-STAT pressure (never one bare meter — §1.1), fed
// by three channels: WOUND (what kept costing them — the dominant channel),
// EDGE (what keeps working), and INFLUENCE (who they spend time with, and
// what their character demands of them). The meter is the sum. When it fills,
// the top K pressured stats GLOW — K is talent breadth, from the spirit
// roll's flatness — and somebody chooses one: the owner for the cast they
// made, the sim for everyone else. A breakthrough is a permanent stat point,
// a mood spike, and a purple patch.
//
// Three load-bearing properties, all bought by per-stat accounting:
//  - the inspector can show exactly WHY a stat glows (sources ring),
//  - the journal can foreshadow (a stat crossing a fraction of its
//    requirement is "beginning to glow" weeks before the payoff),
//  - what lights up derives from history, so it is always defensible in
//    fiction.
//
// §1.7 — THE CONVERSION SPLIT, the game's thesis as an equation: an adversity
// event does not go straight into the meter. It is split between eureka and
// passion drain by determination|dominance, temperance, composure, mood,
// relationship health and belief. Suffering is only productive in a well-run
// room. All three levers land in this split.
//
// §1.8 — belief sets the expectation adversity is measured against. A player
// who never believed they could win does not suffer meaningfully when they
// lose, and therefore does not grow. This is WHY NPCs never become monsters:
// nobody streams them, so belief stays low, so their adversity converts to
// burnout. The arcade is the growth engine — mechanically, not as flavour.

import { clamp, rand, pairKey, displayName } from './util.js'
import {
  PERSONAL_KEYS, TEMPERAMENTS, SOCIAL_TEMPERAMENTS, statLevel, absDayOf,
  STAT_UNIT, STAT_MAX_POINTS, ARCHETYPE_DEMANDS, SPIRIT_ROLL, talentBreadth,
  PERSONAL_STATS, SOCIAL_STATS,
} from './constants.js'
import { chronicle, remember, newEureka } from './model.js'
import { bumpPassion } from './career.js'
import { rivalOf } from './social.js'
import { writeJournal, openThread, threadOf, closeThread, isJournaled } from './journal.js'
import { pushToast, dismissToastByKey } from './notify.js'

// ---------- Tuning (§1.10's hypothesis, adjusted by measurement) ----------
// The targets: 2–4 productive pressure/week for a focused player, 8–11
// breakthroughs across a six-year career, front-loaded and thinning.
export const EUREKA = {
  FIRST_THRESHOLD: 25,
  GROWTH: 1.35, // threshold multiplier per breakthrough
  FORCED_MULT: 2.5, // a single stat at this × threshold stops being a choice
  CARRY: 0.55, // unchosen candidates keep this share (§1.4: wounds return)
  GLOW_FRAC: 0.35, // share of threshold a stat needs to glow on its own
  ROW_IN: 0.8, // in-temperament glow requirement multiplier (cheaper)
  ROW_OUT: 1.5, // cross-row multiplier (identity costs more — §1.5)
  REPEAT: 0.35, // extra requirement per prior breakthrough on the same stat
  ROW_SHIFT_AT: 7, // cross-row breakthroughs into one row before temperament changes
  PASSION_PER_BURNOUT: 1.5, // passion drained per point of non-productive adversity
  PURPLE_DAYS: 14,
  PURPLE_PERF: 2.2, // performance bonus during the patch (match.js reads it)
  STAGE: { casual: 0.75, tournament: 1.2, evo: 1.8 },
}

// Radiance — the spirit axes' effect on OTHERS (§1.6). Tuned separately from
// the caps on purpose. Strength scales with the roll AND with how much of it
// is realised: a day-one Guru radiates a quarter of what a built one does.
export const RADIANCE = {
  SKILL_STANDARDS: 0.5, // multiplier reach of "the room's normal just rose"
  MANA_ATTENTION: 0.6, // how much harder a magnetic person's example pulls
  LOVE_COHESION: 0.10, // productive-share bonus from high-love company
}

const STAT_LABEL = Object.fromEntries([...PERSONAL_STATS, ...SOCIAL_STATS].map(([k, d]) => [k, d]))
const isPersonal = (stat) => PERSONAL_KEYS.includes(stat)
const bagOf = (player, stat) => (isPersonal(stat) ? player.personal : player.social)
const bestSkillOf = (p) => Math.max(0, ...Object.values(p.charSkill || {}), 0)
const abs = (save) => absDayOf(save.day, save.year)

/** The temperament row a stat belongs to, across both lists. */
export function rowOfStat(stat) {
  return TEMPERAMENTS.find((t) => t.stats.includes(stat))
    || SOCIAL_TEMPERAMENTS.find((t) => t.stats.includes(stat))
    || null
}

const playerRowKey = (player, stat) =>
  isPersonal(stat) ? player.temperament : player.socialTemperament

// ---------- Radiance reads ----------

function axisRealisation(person, axis) {
  const ceil = person.spiritCeil
  if (!ceil) return 0
  if (axis === 'skill') return (person.skill ?? bestSkillOf(person)) / Math.max(1, ceil.skill)
  if (axis === 'love') return (person.community ?? 0) / Math.max(1, ceil.community)
  return (person.popularity ?? 0) / Math.max(1, ceil.popularity)
}

/** 0..1: how strongly this person radiates an axis right now. */
export function radianceOf(person, axis) {
  const ceil = person.spiritCeil
  if (!ceil) return 0
  const roll = axis === 'skill' ? ceil.skill : axis === 'love' ? ceil.community : ceil.popularity
  const [lo, hi] = SPIRIT_ROLL
  const rollFactor = clamp((roll - lo) / (hi - lo), 0, 1)
  const realised = clamp(axisRealisation(person, axis) / 0.6, 0.25, 1)
  return rollFactor * realised
}

/** Cohesion from the company they keep — feeds the split's room term. */
function loveAuraOf(save, player) {
  let aura = 0
  for (const [otherId, rel] of Object.entries(player.relationships || {})) {
    if (rel < 30) continue
    const other = save.players[otherId]
    if (!other || other.retired || other.banished) continue
    aura = Math.max(aura, radianceOf(other, 'love'))
  }
  return aura
}

// ---------- The split (§1.7) ----------

/** Mean of the three warmest relationships, 0..1 — "someone to talk to". */
function relHealthOf(player) {
  const vals = Object.values(player.relationships || {}).filter((v) => v > 0)
  if (!vals.length) return 0
  vals.sort((a, b) => b - a)
  return clamp(vals.slice(0, 3).reduce((s, v) => s + v, 0) / (3 * 100), 0, 1)
}

/**
 * What share of an adversity event becomes growth rather than burnout.
 * `convKey` is 'determination' for losses and 'dominance' for won-but-costly
 * events — the conversion-rate stats doing the job their blurbs always
 * described. A miserable, isolated player converts almost nothing.
 */
export function productiveShare(save, player, convKey = 'determination') {
  const s = player.personal || {}
  let share = 0.16
    + statLevel(s[convKey]) * 0.042
    + statLevel(s.temperance) * 0.018
    + statLevel(s.composure) * 0.014
    + ((player.mood ?? 5) - 5) * 0.028
    + relHealthOf(player) * 0.10
    + (player.belief ?? 0) * 0.0009
  share += loveAuraOf(save, player) * RADIANCE.LOVE_COHESION
  return clamp(share, 0.06, 0.92)
}

// ---------- Pressure accrual ----------

const SOURCE_RING = 6

export function addPressure(save, player, stat, amount, why, kind = 'wound') {
  if (amount <= 0) return
  const e = (player.eureka ??= newEureka())
  // A maxed stat cannot glow again — §1.9's thinning is what forces breadth
  // late and eventually hands veterans to P5. Pressure aimed at it dissipates.
  const val = bagOf(player, stat)?.[stat] ?? 0
  if (val >= STAT_MAX_POINTS * STAT_UNIT) return
  e.pressure[stat] = (e.pressure[stat] || 0) + amount
  const ring = (e.sources[stat] ??= [])
  ring.push({ absDay: abs(save), why, amt: Math.round(amount * 100) / 100, kind })
  if (ring.length > SOURCE_RING) ring.shift()
}

/**
 * An adversity event: split, then pressure the implicated stats (60/40 when
 * two). The burnout half drains passion — pushing a player is a wager, and
 * this line is where the bill accrues.
 */
export function adversity(save, player, { weight, stats, why, convKey = 'determination' }) {
  if (!player.eureka || player.retired || weight <= 0) return
  const share = productiveShare(save, player, convKey)
  const productive = weight * share
  const burnout = weight * (1 - share)
  player.eureka.adversity += weight
  player.eureka.burnout += burnout
  bumpPassion(player, -burnout * EUREKA.PASSION_PER_BURNOUT * 0.1)
  const split = stats.length > 1 ? [0.6, 0.4] : [1]
  stats.slice(0, 2).forEach((stat, i) => addPressure(save, player, stat, productive * split[i], why, 'wound'))
}

/** A success pressures the stat that produced it. No split, no drain. */
export function edge(save, player, { weight, stats, why }) {
  if (!player.eureka || player.retired || weight <= 0) return
  const split = stats.length > 1 ? [0.6, 0.4] : [1]
  stats.slice(0, 2).forEach((stat, i) => addPressure(save, player, stat, weight * split[i], why, 'edge'))
}

// ---------- Glow, candidates, choice ----------

/** Pressure a stat needs to glow: temperament inertia and repeat escalation. */
export function glowRequirement(player, stat) {
  const e = player.eureka
  const inRow = rowOfStat(stat)?.key === playerRowKey(player, stat)
  const rowMult = inRow ? EUREKA.ROW_IN : EUREKA.ROW_OUT
  const repeats = e.perStat[stat] || 0
  return EUREKA.GLOW_FRAC * e.threshold * rowMult * (1 + EUREKA.REPEAT * repeats)
}

const eligible = (player, stat) =>
  (bagOf(player, stat)?.[stat] ?? 0) < STAT_MAX_POINTS * STAT_UNIT

/** Stats past a visible fraction of their requirement — the foreshadow read. */
export function glowingStats(player) {
  const e = player.eureka
  if (!e) return []
  return Object.entries(e.pressure)
    .filter(([stat, p]) => eligible(player, stat) && p >= 0.65 * glowRequirement(player, stat))
    .sort((a, b) => b[1] - a[1])
    .map(([stat, p]) => ({ stat, pressure: p, requirement: glowRequirement(player, stat) }))
}

/** The kind that has fed this stat most — labels the choice and the log. */
export function dominantKindOf(player, stat) {
  const ring = player.eureka?.sources?.[stat] || []
  const byKind = {}
  for (const s of ring) byKind[s.kind] = (byKind[s.kind] || 0) + s.amt
  return Object.entries(byKind).sort((a, b) => b[1] - a[1])[0]?.[0] || 'wound'
}

/** When the meter fills: the top K glowing stats, wound and edge distinct. */
export function candidatesFor(player) {
  const e = player.eureka
  const k = talentBreadth(player)
  const qualified = Object.entries(e.pressure)
    .filter(([stat, p]) => eligible(player, stat) && p >= glowRequirement(player, stat))
    .sort((a, b) => b[1] - a[1])
  let picks = qualified.slice(0, k)
  if (!picks.length) {
    // Meter full but pressure spread thin — the most-pressured stat stands in.
    picks = Object.entries(e.pressure)
      .filter(([stat]) => eligible(player, stat))
      .sort((a, b) => b[1] - a[1])
      .slice(0, 1)
  }
  return picks.map(([stat, pressure]) => ({
    stat,
    pressure: Math.round(pressure * 10) / 10,
    kind: dominantKindOf(player, stat),
    label: STAT_LABEL[stat] || stat,
    inRow: rowOfStat(stat)?.key === playerRowKey(player, stat),
  }))
}

const meterOf = (e) => Object.values(e.pressure).reduce((s, v) => s + v, 0)

/**
 * The sim's chooser — NPCs, and the competent player answering promptly.
 * Highest pressure, with a mild preference for who they already are.
 */
export function autoPickStat(player, candidates) {
  let best = null
  for (const c of candidates) {
    const score = c.pressure * (c.inRow ? 1.5 : 1)
    if (!best || score > best.score) best = { ...c, score }
  }
  return best?.stat || null
}

/**
 * Apply a breakthrough: the permanent point, the mood spike, the purple
 * patch — or, forced, the version that resolves badly (§1.4). Handles
 * temperament inertia bookkeeping and the rare temperament change (§1.5).
 */
export function chooseBreakthrough(save, player, stat, { forced = false } = {}) {
  const e = player.eureka
  if (!e || !eligible(player, stat)) return null
  const bag = bagOf(player, stat)
  bag[stat] = Math.min(bag[stat] + STAT_UNIT, STAT_MAX_POINTS * STAT_UNIT)

  const kind = dominantKindOf(player, stat)
  const row = rowOfStat(stat)
  const cross = row && row.key !== playerRowKey(player, stat)
  const name = displayName(player, save)
  const today = abs(save)

  // THE ONE-ANNOUNCEMENT RULE (REVISION §0.4): a stat change speaks in the
  // journal and nowhere else. The chronicle keeps collective, numberless
  // moments; toasts point at the journal, they do not repeat it.
  const topWhy = (e.sources[stat] || []).at(-1)?.why || 'everything lately'
  if (forced) {
    // They resolved it themselves — badly, at a cost. The point lands, but
    // something breaks with it: mood, passion, and sometimes a friendship.
    player.mood = clamp(player.mood - 2, 0, 10)
    bumpPassion(player, -9)
    const rels = Object.entries(player.relationships || {}).sort((a, b) => a[1] - b[1])
    if (rels.length && rels[0][1] < 20 && rand() < 0.35) {
      player.relationships[rels[0][0]] = clamp(rels[0][1] - 25, -100, 100)
    }
    writeJournal(save, player, 'forced', {
      stat, always: true, deltas: [{ stat, points: 1 }],
      thread: openThread(save, player, 'crisis')?.id,
    })
    if (isJournaled(player)) {
      pushToast(save, { icon: '💥', text: `${name} went through something. Their journal has the shape of it.`, see: { screen: 'players' }, sticky: true })
    }
  } else {
    player.mood = clamp(player.mood + 2.5, 0, 10)
    bumpPassion(player, 6)
    e.purpleUntilAbs = today + EUREKA.PURPLE_DAYS
    // Influence has two faces: a PERSON who rubbed off, or a CHARACTER whose
    // demands were finally met. The entry must know which — "courtesy of
    // watching Piper" about a fictional grappler is nonsense prose.
    let entryKind = kind === 'edge' ? 'breakthroughEdge' : kind === 'influence' ? 'breakthroughInfluence' : 'breakthroughWound'
    let mentorName = null
    if (kind === 'influence') {
      const company = [...(e.sources[stat] || [])].reverse()
        .find((s) => / is simply better at this$/.test(s.why))
      if (company) mentorName = company.why.replace(/ is simply better at this$/, '')
      else entryKind = 'breakthroughDemand'
    }
    writeJournal(save, player, entryKind, {
      stat, why: topWhy, opp: mentorName || undefined,
      char: (e.sources[stat] || []).find((s) => / demands it$/.test(s.why))?.why.replace(/ demands it$/, ''),
      always: true, deltas: [{ stat, points: 1 }],
    })
    if (!player.npc) {
      remember(save, player, 'eureka', `the breakthrough on ${stat}${cross ? ' — becoming someone new' : ''}`)
    }
    // A breakthrough closes the crisis chapter, if one was open.
    closeThread(save, player, threadOf(player, 'crisis'))
  }

  // Inertia bookkeeping, and the rare identity shift: enough cross-row
  // breakthroughs into ONE row and their temperament changes — among the
  // largest things that can happen to a person in this game.
  if (cross) {
    e.crossRowBy[row.key] = (e.crossRowBy[row.key] || 0) + 1
    if (e.crossRowBy[row.key] >= EUREKA.ROW_SHIFT_AT) {
      const personal = isPersonal(stat)
      if (personal) player.temperament = row.key
      else player.socialTemperament = row.key
      e.crossRowBy = {}
      e.rowShifts = (e.rowShifts || 0) + 1 // §1.11: temperament-change rate
      writeJournal(save, player, 'shift', { row: row.label, always: true, deltas: [{ stat: 'temperament', points: 0 }] })
      if (!player.npc) {
        // The room noticing is a collective moment, and numberless — the
        // chronicle may keep it. The stat mechanics stay in the journal.
        chronicle(save, '🦋', `${name} isn't who they were. The room would tell you: they're ${row.label} now.`)
        remember(save, player, 'eureka', `becoming ${row.label}`)
      }
    }
  }

  e.log.push({ absDay: today, stat, kind, cross: !!cross, forced })
  e.count += 1
  e.perStat[stat] = (e.perStat[stat] || 0) + 1
  e.threshold = Math.round(e.threshold * EUREKA.GROWTH * 10) / 10
  e.pressure[stat] = 0
  for (const k of Object.keys(e.pressure)) e.pressure[k] *= EUREKA.CARRY
  delete e.sources[stat]
  if (e.glowNoted) delete e.glowNoted[stat] // the glow may foreshadow again
  e.pending = null
  dismissToastByKey(save, `verge_${player.id}`) // the question was answered
  return { stat, kind, cross: !!cross, forced }
}

/**
 * The daily meter check. NPCs resolve on the spot; the cast waits for YOU
 * (eureka.pending) — you cannot call a breakthrough, only answer it, and
 * ignoring one has a deadline: any stat crossing FORCED_MULT × threshold
 * resolves itself (§1.4).
 */
export function checkEureka(save, player) {
  const e = player.eureka
  if (!e || player.retired || player.banished) return
  // The deadline first — it applies whether or not a choice is pending.
  for (const [stat, p] of Object.entries(e.pressure)) {
    if (eligible(player, stat) && p >= EUREKA.FORCED_MULT * e.threshold) {
      chooseBreakthrough(save, player, stat, { forced: true })
      return
    }
  }
  if (e.pending) return
  if (meterOf(e) < e.threshold) return
  const candidates = candidatesFor(player)
  if (!candidates.length) return
  const isCast = !player.npc && player.createdBy === 'user'
  if (isCast) {
    e.pending = { sinceAbs: abs(save), candidates }
    // The prompt is a toast, not a chronicle line: you cannot call a
    // breakthrough, only answer it — and this is the game telling you one
    // is waiting. Sticky, because sitting on it has a deadline.
    pushToast(save, {
      icon: '✨',
      text: `${displayName(player, save)} is on the verge of something — the choice is yours.`,
      see: { screen: 'players' },
      sticky: true,
      key: `verge_${player.id}`,
    })
  } else {
    chooseBreakthrough(save, player, autoPickStat(player, candidates))
  }
}

// ---------- The wound table at the point of a match result (§1.2) ----------

/**
 * Causal wound attribution for a lost set. Every branch is a row of §1.2's
 * table, and every row is legible enough that the journal entry can write
 * itself ("I had it. Game five, I had it."). Weight is scaled by stage and by
 * §1.8's expectation gap: adversity = expected minus actual, and belief sets
 * the expectation.
 */
export function matchWound(save, loser, winner, { probSelf, stage = 'casual', streamed = false }) {
  if (!loser.eureka) return
  let stat = null, alt = null, base = 0.9, why
  const h = loser.h2h?.[winner.id]
  const deficit = h ? h.l - h.w : 0
  const lossStreak = (loser.form || []).slice(0, 5).every((r) => r === 'l') && (loser.form || []).length >= 5

  if (stage !== 'casual' && probSelf >= 0.55) {
    stat = 'composure'; base = 2.2; why = 'led it on the big stage and lost it'
  } else if (deficit >= 5) {
    stat = 'adaptation'; alt = 'analysis'; base = 1.6; why = `the ${displayName(winner, save)} matchup keeps costing them`
  } else if (deficit >= 3) {
    stat = 'analysis'; base = 1.4; why = `losing the same way to ${displayName(winner, save)} again`
  } else if (probSelf >= 0.62) {
    stat = 'dominance'; base = 1.5; why = 'could not close from in front'
  } else if ((loser.mood ?? 5) <= 2.1) {
    stat = 'temperance'; base = 1.2; why = 'tilted, and it cost the next game too'
  } else if (lossStreak) {
    stat = 'determination'; base = 1.6; why = 'losing and getting nothing out of it'
  } else {
    // The character's own demands are what failed them tonight.
    const charId = loser.mainCharId
    const arch = save.game.characters.find((c) => c.id === charId)?.archetype
    stat = (ARCHETYPE_DEMANDS[arch] || ['determination'])[0]
    base = 0.9
    why = 'another loss their character had answers for'
  }
  const expectation = 0.35 + probSelf // the gap belief is measured against
  const believed = 0.55 + (loser.belief ?? 0) / 110
  const weight = base * expectation * believed * (EUREKA.STAGE[stage] ?? 1) * (streamed ? 1.15 : 1)
  adversity(save, loser, { weight, stats: alt ? [stat, alt] : [stat], why, convKey: 'determination' })
}

/**
 * The edge channel at the same moment: success pressures what produced it —
 * but only NOTABLE success. An ordinary Tuesday win pressures nothing;
 * measured with a default-win edge, the whole spine collapsed to 1:8
 * edge-heavy and every career became the same dominance/analysis skill tree.
 * The wound stays the dominant channel because the edge is selective.
 */
export function matchEdge(save, winner, loser, { probSelf, stage = 'casual', streamed = false, viewers = 0, rivals = false }) {
  if (!winner.eureka) return
  let stats, base, why
  const streak = (winner.form || []).slice(0, 5).every((r) => r === 'w') && (winner.form || []).length >= 5
  const h = winner.h2h?.[loser.id]
  if (probSelf <= 0.38) {
    stats = ['xfactor', 'determination']; base = 1.0; why = 'stole a set they had no business winning'
  } else if (rivals && h && h.l > h.w) {
    stats = ['analysis']; base = 0.7; why = 'finally solved the rival who owned them'
  } else if (streamed && viewers >= 120) {
    stats = ['presence']; base = 0.9; why = 'popped off and the chat detonated'
  } else if (streak) {
    stats = ['mastery', 'loyalty']; base = 0.7; why = 'their character keeps answering'
  } else {
    return // an unremarkable win sharpens nothing
  }
  edge(save, winner, { weight: base * (EUREKA.STAGE[stage] ?? 1), stats, why })
}

/**
 * A bracket exit that HURT — the tournament-scale wound (§1.10: elimination
 * when they believed, 3–5). `late` marks a long day (stamina), `favored` a
 * seeding they failed (composure).
 */
export function eliminationWound(save, player, { believed, late = false, favored = false, stage = 'tournament' }) {
  if (!player.eureka || !believed) return
  const belief = player.belief ?? 0
  const weight = (3 + 2 * clamp((belief - 45) / 55, 0, 1)) * (EUREKA.STAGE[stage] ?? 1) / EUREKA.STAGE.tournament
  const stat = late ? 'stamina' : favored ? 'composure' : 'determination'
  const why = late ? 'fell apart late on a long day' : favored ? 'seeded to make it, and did not' : 'out early, again'
  adversity(save, player, { weight, stats: [stat], why, convKey: 'determination' })
}

// ---------- The daily/weekly pass ----------

/**
 * Called once per active player per day (sim.js endDay). Carries the
 * influence channel — character demands daily, company and radiance weekly —
 * plus plateau, absence, ruptures, the community meter, and the meter check.
 */
export function processEurekaDaily(save, player, ctx = {}) {
  const e = (player.eureka ??= newEureka())
  if (player.retired || player.banished) return
  const today = abs(save)

  if (ctx.attendedToday) {
    e.lastAttendedAbs = today
    e.weekAttends = (e.weekAttends || 0) + 1
    // CHARACTER DEMANDS (§1.2 influence): what they play asks things of them.
    // Against the grain of their own sheet generates more friction — and
    // opens glows otherwise out of reach.
    const charId = player.currentInterest?.charId || player.mainCharId
    const char = save.game.characters.find((c) => c.id === charId)
    const demands = ARCHETYPE_DEMANDS[char?.archetype] || []
    for (const stat of demands) {
      const grain = (bagOf(player, stat)?.[stat] ?? 0) === 0 ? 1.4 : 1
      addPressure(save, player, stat, 0.045 * grain, `${char?.name || 'their character'} demands it`, 'influence')
    }
  }

  // The community meter — love's capped quantity. Grown by being the room's
  // connective tissue; capped by the love axis; radiated back out through
  // radianceOf. (Lives here rather than social.js so every spirit quantity
  // updates in one pass.)
  {
    let delta = -0.04
    if ((save.mentorships || []).some((m) => m.mentorId === player.id)) delta += 0.2
    if (player.teamId && save.teams[player.teamId]?.founderId === player.id) delta += 0.09
    const warm = Object.values(player.relationships || {}).filter((v) => v >= 40).length
    delta += Math.min(0.14, warm * 0.022)
    const cap = player.spiritCeil?.community ?? 100
    player.community = clamp((player.community || 0) + delta, 0, cap)
  }

  // Cap realisation (§1.11): the first day each axis reaches its ceiling is
  // the narrative attractor showing up — or not — in the data.
  if (player.spiritCeil) {
    // "Reached" is asymptotic — the last stretch of every capped quantity is
    // a grind by design, so the wall is FELT at ~92% of it, not at equality.
    const t = (e.axisToppedAbs ??= {})
    if (t.skill == null && bestSkillOf(player) >= player.spiritCeil.skill * 0.92) t.skill = today
    if (t.community == null && (player.community || 0) >= player.spiritCeil.community * 0.92) t.community = today
    if (t.popularity == null && (player.popularity || 0) >= player.spiritCeil.popularity * 0.92) t.popularity = today
  }

  // Weekly block: company, plateau, absence, ruptures.
  if (today - (e.lastWeeklyAbs || 0) >= 7) {
    weeklyPass(save, player, e, today)
    e.lastWeeklyAbs = today
    e.weekSkillMark = bestSkillOf(player)
    e.weekAttends = 0
  }

  checkEureka(save, player)
}

function weeklyPass(save, player, e, today) {
  // COMPANY (§1.2): a sustained relationship — friend OR rival, it needs
  // intensity, not warmth — with someone materially stronger in a stat makes
  // that stat glow-eligible. Mentorship without a mentorship system.
  for (const [otherId, rel] of Object.entries(player.relationships || {})) {
    if (Math.abs(rel) < 35) continue
    const other = save.players[otherId]
    if (!other || other.retired || other.banished || !other.personal) continue
    const intensity = Math.abs(rel) / 100
    const pull = 1 + radianceOf(other, 'mana') * RADIANCE.MANA_ATTENTION
    const standards = 1 + radianceOf(other, 'skill') * RADIANCE.SKILL_STANDARDS
    // Their two most commanding leads over you are what rubs off.
    const leads = []
    for (const [stat, val] of [...Object.entries(other.personal), ...Object.entries(other.social || {})]) {
      const mine = bagOf(player, stat)?.[stat] ?? 0
      if (val >= mine + 2 * STAT_UNIT) leads.push([stat, val])
    }
    leads.sort((a, b) => b[1] - a[1])
    for (const [stat] of leads.slice(0, 2)) {
      addPressure(save, player, stat, 0.28 * intensity * pull * standards,
        `${displayName(other, save)} is simply better at this`, 'influence')
    }
  }

  // PLATEAU: an active week with nothing to show for it. Below the ceiling it
  // wounds the climb (mastery, learning); AT the ceiling it is §1.6's
  // steering — the wall redirects pressure toward the other axes, and hitting
  // the spirit wall itself must arrive in fiction, never as a number.
  if ((e.weekAttends || 0) >= 3) {
    const now = bestSkillOf(player)
    const gain = now - (e.weekSkillMark || 0)
    if (gain < 0.35 && now > 12) {
      e.plateauStreak = (e.plateauStreak || 0) + 1
      const spiritWall = player.spiritCeil && now >= player.spiritCeil.skill - 2
      if (spiritWall) {
        adversity(save, player, { weight: 1.2, stats: ['presence', 'community'], why: 'the ceiling is real, and they can feel it', convKey: 'determination' })
        if (!e.capFeltAbs) {
          e.capFeltAbs = today
          // §1.6's obligation: the wall arrives as a sentence, never a number
          // — and it arrives in the JOURNAL, where discoveries live.
          writeJournal(save, player, 'wall', { always: true })
          if (!player.npc) remember(save, player, 'eureka', 'realising the climb was over')
        }
      } else if (e.plateauStreak >= 4) {
        // §1.6's steering, at the ceiling that is actually stopping them: a
        // LONG plateau stops being about the climb and starts redirecting the
        // person — toward the room, the crowd, whatever their shape wants
        // next. This is how a Healer becomes a pillar without a script.
        adversity(save, player, { weight: 1.1, stats: ['presence', 'community'], why: 'months at the same wall — maybe the game is bigger than the bracket', convKey: 'determination' })
      } else {
        adversity(save, player, { weight: 1.0, stats: ['mastery', 'learning'], why: 'a week of reps that went nowhere', convKey: 'determination' })
      }
    } else if (gain >= 0.35) {
      e.plateauStreak = 0
    }
  }

  // ABSENCE: stopped turning up — the spark wound.
  if (player.isRegular && today - (e.lastAttendedAbs || today) > 12) {
    adversity(save, player, { weight: 0.8, stats: ['spark'], why: 'the arcade stopped pulling them in', convKey: 'determination' })
  }

  // RUPTURES: a relationship gone properly bad, counted once per pair.
  // Sensitivity is deliberately double-edged here (§1.2): the same event is a
  // politeness wound for the one who did not read the room and a sensitivity
  // wound for the one the room got to. The journal must distinguish those —
  // they are different entries about different people (§1.2's ruling).
  for (const [otherId, rel] of Object.entries(player.relationships || {})) {
    if (rel > -55) continue
    const key = pairKey(player.id, otherId)
    if (e.feudSeen.includes(key)) continue
    e.feudSeen.push(key)
    const s = player.social || {}
    const caused = (s.politeness ?? 0) + (s.sportsmanship ?? 0) <= STAT_UNIT
    const stat = caused ? ((s.politeness ?? 0) <= (s.sportsmanship ?? 0) ? 'politeness' : 'sportsmanship') : 'sensitivity'
    const why = caused ? 'they did not read the room, and it cost a friendship' : 'the falling out got all the way in'
    adversity(save, player, { weight: 3, stats: [stat], why, convKey: 'determination' })
    const other = save.players[otherId]
    if (other) {
      const grudge = openThread(save, player, 'grudge', otherId)
      writeJournal(save, player, caused ? 'ruptureCaused' : 'ruptureAbsorbed', {
        opp: other.alias || other.firstName, thread: grudge?.id,
      })
    }
  }

  // FRIENDSHIPS: the warm crossing, once per pair — the counterweight so the
  // journal is a life, not a casualty list.
  for (const [otherId, rel] of Object.entries(player.relationships || {})) {
    if (rel < 55) continue
    const key = pairKey(player.id, otherId)
    if ((e.friendSeen ??= []).includes(key)) continue
    e.friendSeen.push(key)
    const other = save.players[otherId]
    if (other) writeJournal(save, player, 'friend', { opp: other.alias || other.firstName })
  }

  // RIVALRY: a genuine rival earns a thread and a page of their own —
  // the company channel already makes them productive; this makes them plot.
  // One page per PERSON, ever (a rekindled rivalry is P4+ material), and the
  // torch passes: a new rival closes the old thread.
  {
    const rival = rivalOf(save, player)
    if (rival && !threadOf(player, 'rival', rival.id)) {
      for (const t of player.threads || []) {
        if (t.kind === 'rival' && !t.closedAbs) closeThread(save, player, t)
      }
      const thread = openThread(save, player, 'rival', rival.id)
      // One page per person ever, and no more than one new-rival page a
      // season — the churn of who counts as "the rival" is real, but a diary
      // that re-announces it monthly reads like a form letter.
      if (!(e.rivalSeen ??= []).includes(rival.id) && today - (e.rivalNotedAbs || 0) > 84) {
        e.rivalSeen.push(rival.id)
        e.rivalNotedAbs = today
        writeJournal(save, player, 'rivalOpen', { opp: rival.alias || rival.firstName, thread: thread?.id })
      }
    }
  }

  // THE SLUMP: opened off recent form, closed off recent form — journal-side
  // continuity for what the wound channel already taxes.
  {
    const form = player.form || []
    const slump = threadOf(player, 'slump')
    if (!slump && form.length >= 5 && form.slice(0, 5).every((r) => r === 'l')) {
      const thread = openThread(save, player, 'slump')
      writeJournal(save, player, 'slumpOpen', { thread: thread?.id })
    } else if (slump && form.length >= 3 && form.slice(0, 3).every((r) => r === 'w')) {
      closeThread(save, player, slump)
      writeJournal(save, player, 'slumpClose', { thread: slump.id })
    }
  }

  // GLOW FORESHADOW: the first time a stat crosses into the glow band since
  // its last reset, the journal says so — weeks before the payoff. This is
  // the two-hands-ahead read, in fiction.
  {
    e.glowNoted ??= {}
    for (const g of glowingStats(player).slice(0, 2)) {
      if (e.glowNoted[g.stat]) continue
      e.glowNoted[g.stat] = true
      writeJournal(save, player, 'glow', { stat: g.stat })
    }
  }

  // PASSION CROSSINGS: the early warning arrives as an entry you could skim
  // past; the late one is a toast, because by then it is nearly too late.
  {
    const p = player.passion ?? 80
    e.passionStage ??= 'ok'
    if (e.passionStage === 'ok' && p < 36) {
      e.passionStage = 'low'
      writeJournal(save, player, 'passionLow', { always: true })
    } else if (e.passionStage === 'low' && p < 21) {
      e.passionStage = 'out'
      writeJournal(save, player, 'passionOut', { always: true, thread: openThread(save, player, 'crisis')?.id })
      if (isJournaled(player)) {
        pushToast(save, {
          icon: '🔥',
          text: `${displayName(player, save)} is burning out. Their journal has been saying so for a while.`,
          see: { screen: 'players' },
          sticky: true,
        })
      }
    } else if (p > 50 && e.passionStage !== 'ok') {
      e.passionStage = 'ok' // recovered — re-arm the warnings for next time
    }
  }
}
