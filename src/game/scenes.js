// CASTING: turning 1,280 written scenes into conversations on the floor.
//
// A scene is a short exchange written as a unit — both sides at once — so each
// turn depends on the one before it. That is the whole reason it exists: pools
// of independent lines can produce adjacency but never reference, which is why
// the old floor talk read as four people delivering monologues at each other.
//
// This module's only job is MATCHING. A scene declares what it needs of the
// people in it ("A lost", "B has never beaten A", "they are close") and of the
// world ("a patch just landed"); casting finds people in the room who satisfy
// that, and returns beats. Everything else — what gets said — was decided at
// authoring time.
//
// THE RULE: every predicate below reads state the sim already holds. A
// requirement the engine cannot evaluate is worse than a missing scene, because
// it sits in the corpus costing bundle size and never casts. `dormantReqs()`
// reports any that can never be true, so that failure is visible rather than
// silent.

import { choice, hash01 } from './util.js'
import { absDayOf, runAge, DAYS_PER_YEAR, EVO_DAY, OPENING_DAYS } from './constants.js'
import { familiarity } from './dialogue.js'
import { charPower } from './patch.js'
import SCENES from './data/scenes.js'

// How long a scene is off the table after it plays. The corpus averages ~10
// exchanges per situation, so without this a common situation would cycle
// visibly inside a single week.
const SCENE_COOLDOWN_DAYS = 21

// ---------- Role predicates ----------
// (player, other, ctx) -> boolean. `ctx` carries { save, results, absDay }.

const h2hOf = (p, other) => {
  const h = p.h2h?.[other.id]
  const w = h?.w || 0
  const l = h?.l || 0
  return { w, l, n: w + l }
}

const formOf = (p, want, n = 3) => {
  const f = (p.form || []).slice(0, n)
  return f.length >= n && f.every((r) => r === want)
}

const patchTouched = (save, charId, key) => {
  const last = save.patches?.[0]
  if (!last || !charId) return false
  // Only the most recent patch, and only while it is still news.
  if (daysSince(save, last) > 21) return false
  return (last[key] || []).includes(charId)
}

const daysSince = (save, rec) =>
  (save.year - rec.year) * DAYS_PER_YEAR + (save.day - rec.day)

export const ROLE_PREDICATES = {
  won: (p, o, c) => c.results[p.id] === 'won',
  lost: (p, o, c) => c.results[p.id] === 'lost',

  'rel:stranger': (p, o) => familiarity(p, o) === 'stranger',
  'rel:acquaintance': (p, o) => familiarity(p, o) === 'acquaintance',
  'rel:familiar': (p, o) => familiarity(p, o) === 'familiar',
  'rel:close': (p, o) => familiarity(p, o) === 'close',
  'rel:hostile': (p, o) => familiarity(p, o) === 'hostile',

  'energy:fiery': (p) => p.voice?.energy === 'fiery',
  'energy:chill': (p) => p.voice?.energy === 'chill',
  'humor:dry': (p) => p.voice?.humor === 'dry',
  'humor:earnest': (p) => p.voice?.humor === 'earnest',
  'humor:clowning': (p) => p.voice?.humor === 'clowning',

  'mood:low': (p) => (p.mood ?? 5) < 4,
  'mood:high': (p) => (p.mood ?? 5) > 7,

  'h2h:even': (p, o) => { const { w, l, n } = h2hOf(p, o); return n >= 4 && Math.abs(w - l) <= 1 },
  'h2h:dominant': (p, o) => { const { w, n } = h2hOf(p, o); return n >= 6 && w / n >= 0.65 },
  'h2h:losing': (p, o) => { const { l, n } = h2hOf(p, o); return n >= 6 && l / n >= 0.65 },
  'h2h:never-won': (p, o) => { const { w, n } = h2hOf(p, o); return n >= 3 && w === 0 },

  // daysAttended counts nights ACTUALLY here, and people show up roughly one
  // night in three — so 35 is about four months of turning up, and 60 was a
  // year and a half that nobody in a measured run ever reached.
  newcomer: (p) => (p.daysAttended || 0) < 14,
  veteran: (p) => (p.daysAttended || 0) >= 35,
  exploring: (p) => !p.settledMain,
  settled: (p) => !!p.settledMain,
  'streak:winning': (p) => formOf(p, 'w'),
  'streak:losing': (p) => formOf(p, 'l'),
  'passion:low': (p) => (p.passion ?? 80) < 35,
  retiring: (p) => (p.passion ?? 80) < 18,
  warned: (p) => (p.warnings || []).length > 0,

  'main:nerfed': (p, o, c) => patchTouched(c.save, p.mainCharId, 'nerfedIds'),
  'main:buffed': (p, o, c) => patchTouched(c.save, p.mainCharId, 'buffedIds'),
  // charPower is an average matchup score, so it clusters tightly around 50 —
  // a measured 14-character roster spanned 48.2 to 50.8. Absolute cutoffs of
  // 55/45 were unreachable. Top and bottom tier are relative to the rest of
  // the cast, which is also what "top tier" means when people say it.
  'main:toptier': (p, o, c) => !!p.mainCharId && c.tierRank(p.mainCharId) >= 0.8,
  'main:lowtier': (p, o, c) => !!p.mainCharId && c.tierRank(p.mainCharId) <= 0.2,
  'same-main': (p, o) => !!p.mainCharId && p.mainCharId === o.mainCharId,
  // A pocket pick showing up today: they have one, they are settled, and the
  // character they actually played is not their main.
  'pocket-used': (p, o, c) => {
    const today = c.playedToday[p.id]
    return !!today && !!p.mainCharId && today !== p.mainCharId
      && (p.pocketPicks || []).includes(today)
  },
  'fav-food-stocked': (p, o, c) =>
    (p.foods || []).some((f) => (c.save.arcade.foods || []).includes(f)),

  mentor: (p, o, c) => (c.save.mentorships || []).some((m) => m.mentorId === p.id && m.studentId === o.id),
  student: (p, o, c) => (c.save.mentorships || []).some((m) => m.studentId === p.id && m.mentorId === o.id),
  teammate: (p, o) => !!p.teamId && p.teamId === o.teamId,
}

// ---------- World predicates ----------

export const WORLD_PREDICATES = {
  'arcade:new': (c) => c.runDay <= OPENING_DAYS,
  'arcade:established': (c) => c.runDay > DAYS_PER_YEAR / 2,
  'arcade:dirty': (c) => (c.save.arcade.cleanliness ?? 80) < 45,
  'arcade:packed': (c) => c.attendance >= Math.max(6, (c.save.peakAttendance || 0) * 0.8),
  'arcade:dead': (c) => c.attendance <= Math.max(3, (c.save.peakAttendance || 0) * 0.25),
  'arcade:reopened': (c) => {
    const until = c.save.arcade.closedUntilAbs
    return !!until && c.absDay - until >= 0 && c.absDay - until <= 5
  },
  'concession:stocked': (c) => (c.save.arcade.foods || []).length > 0,
  'setup:broken': () => false, // the sim has no faulty-cabinet state — see dormantReqs()
  'game:new': () => false,     // no install date on side cabinets
  'price:raised': () => false, // no price history
  'staff:new': () => false,    // no hire date on staff

  'patch:fresh': (c) => !!c.save.patches?.length && daysSince(c.save, c.save.patches[0]) <= 10,
  'patch:system': (c) => {
    const last = c.save.patches?.[0]
    return !!last && daysSince(c.save, last) <= 21 && (last.notes || []).some((n) => n.startsWith('SYSTEM'))
  },
  'char:new': (c) => {
    const last = c.save.patches?.[0]
    return !!last && daysSince(c.save, last) <= 21 && (last.notes || []).some((n) => n.startsWith('NEW CHARACTER'))
  },
  'tierlist:new': (c) => {
    const tl = c.save.tierLists?.[0] || c.save.tierList
    return !!tl && daysSince(c.save, tl) <= 10
  },
  'meta:stale': (c) => !!c.save.patches?.length && daysSince(c.save, c.save.patches[0]) > 70,

  // The bracket goes up the morning of, so these are the same fact seen from
  // either side — before it runs, and while it is running.
  'bracket:up': (c) => c.tournamentToday,
  'tournament:today': (c) => c.tournamentToday,
  'evo:soon': (c) => EVO_DAY - c.save.day <= 21 && EVO_DAY - c.save.day >= 0,
  'stream:growing': (c) => (c.save.stream?.followers || 0) >= 120,
  'relevance:falling': (c) => (c.save.relevance ?? 55) < 35,
  'money:tight': (c) => (c.save.economy?.redDays || 0) > 0,
}

/**
 * Requirements no predicate can ever satisfy, and the situations they strand.
 * Called by the test suite rather than the game — the point is that a scene
 * which can never cast shows up as a number somebody has to look at, instead of
 * quietly costing bundle size forever.
 */
export function dormantReqs() {
  const dead = new Set()
  for (const [k, fn] of Object.entries(WORLD_PREDICATES)) if (fn.toString().includes('=> false')) dead.add(k)
  const stranded = Object.entries(SCENES)
    .filter(([, s]) => (s.world || []).some((w) => dead.has(w)))
    .map(([id]) => id)
  return { reqs: [...dead], stranded }
}

// ---------- Casting ----------

const ctxFor = (save, results, extra) => {
  const dip = save.dayInProgress
  return {
    save,
    results,
    absDay: absDayOf(save.day, save.year),
    // "Is this place still new?" is about the ARCADE, not the calendar — a
    // run opens in June, so absDay reads 155 on opening night.
    runDay: runAge(save),
    attendance: dip?.attendeeIds?.length || 0,
    // sim.js owns the event calendar and importing it here would be circular,
    // so the caller passes today's verdict in.
    tournamentToday: !!extra?.tournamentToday,
    playedToday: dip?.charToday || {},
    tierRank: tierRanker(save.game),
  }
}

/**
 * charId -> where that character sits in the roster, 0 (worst) to 1 (best).
 * Computed once per casting attempt rather than per predicate call, because
 * every character's power has to be scored to rank any one of them.
 */
function tierRanker(game) {
  const chars = (game?.characters || []).filter((c) => !c.formOf)
  if (chars.length < 2) return () => 0.5
  const powers = chars.map((c) => [c.id, charPower(game, c.id)]).sort((a, b) => a[1] - b[1])
  const rank = new Map(powers.map(([id], i) => [id, i / (powers.length - 1)]))
  return (charId) => rank.get(charId) ?? 0.5
}

const roleOk = (reqs, p, other, ctx) =>
  reqs.every((r) => (ROLE_PREDICATES[r] ? ROLE_PREDICATES[r](p, other, ctx) : false))

/** Every ordering of `group` onto `roleNames`, as {role: player} maps. */
function* assignments(group, roleNames) {
  if (!roleNames.length) { yield {}; return }
  const [head, ...rest] = roleNames
  for (const p of group) {
    for (const sub of assignments(group.filter((x) => x !== p), rest)) {
      yield { [head]: p, ...sub }
    }
  }
}

function castable(scene, group, ctx) {
  const roleNames = Object.keys(scene.roles)
  if (group.length < roleNames.length) return null
  for (const cast of assignments(group, roleNames)) {
    const ok = roleNames.every((r) => {
      // Requirements are written from this role's point of view toward "the
      // other" — with three roles the other is whoever isn't them, and any of
      // them satisfying the relationship is enough.
      const me = cast[r]
      const others = roleNames.filter((x) => x !== r).map((x) => cast[x])
      return others.length
        ? others.some((o) => roleOk(scene.roles[r], me, o, ctx))
        : roleOk(scene.roles[r], me, me, ctx)
    })
    if (ok) return cast
  }
  return null
}

/**
 * Pick a scene for this group, or null to fall through to the old line pools.
 *
 * Situations are tried in an order seeded by the day and the group, so the same
 * room on the same night is stable, but different rooms don't all reach for the
 * same scene. First match wins — scanning all 120 and weighting them cost more
 * than it bought, since world requirements already narrow the field hard.
 */
export function castScene(save, group, results, extra) {
  if (!group || group.length < 2) return null
  const ctx = ctxFor(save, results, extra)
  save.sceneCooldowns ??= {}

  const worldOk = (s) => (s.world || []).every((w) => WORLD_PREDICATES[w]?.(ctx) ?? false)
  const seed = `${ctx.absDay}:${group.map((p) => p.id).join()}`
  const ids = Object.keys(SCENES)
    .filter((id) => {
      const until = save.sceneCooldowns[id]
      return (!until || ctx.absDay >= until) && worldOk(SCENES[id])
    })
    .sort((a, b) => hash01(`${seed}:${a}`) - hash01(`${seed}:${b}`))

  for (const id of ids) {
    const scene = SCENES[id]
    const cast = castable(scene, group, ctx)
    if (!cast) continue
    const turns = choice(scene.ex)
    if (!turns?.length) continue
    save.sceneCooldowns[id] = ctx.absDay + SCENE_COOLDOWN_DAYS
    return { id, cast, turns }
  }
  return null
}

/**
 * Per-situation diagnosis for a given room: did the world gate open, and could
 * the roles be filled? Uses the real casting code rather than a copy of it,
 * because a diagnostic that reimplements the thing it measures measures the
 * copy. Not used by the game — this is how you find out that a situation you
 * paid to write can never actually play.
 */
export function explainCasting(save, group, results, extra) {
  const ctx = ctxFor(save, results, extra)
  const out = {}
  for (const [id, scene] of Object.entries(SCENES)) {
    const world = (scene.world || []).every((w) => WORLD_PREDICATES[w]?.(ctx) ?? false)
    out[id] = { world, roles: world ? !!castable(scene, group, ctx) : false }
  }
  return out
}

/** How often a matched scene is actually used instead of the old chatter. */
export const SCENE_CHANCE = 0.72

export function sceneBeats(scene, nameOf) {
  return scene.turns.map(([role, text]) => {
    const speaker = scene.cast[role]
    const others = Object.entries(scene.cast).filter(([r]) => r !== role).map(([, p]) => p)
    return {
      speaker: nameOf(speaker),
      text: text
        .replaceAll('{t}', others.length ? nameOf(others[0]) : 'you')
        .replaceAll('{self}', nameOf(speaker)),
    }
  })
}
