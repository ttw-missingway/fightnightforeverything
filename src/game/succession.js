// SUCCESSION — Act 3's actual mechanic (REVISION §0, P5).
//
// The measurement that produced this file: with ageing switched on and eras
// letting a run outlive its game, competent runs still died — every one of
// them down the `dynamics` funnel, in a room that was FULL. Sixty regulars on
// the floor, relevance at 90, money in the bank, and the ending text reading
// "every player you brought into this arcade has hung it up." Because that was
// literally true and there was nothing anyone could do about it: the roster
// window closes on day one and a cast could only ever shrink.
//
// So §0's Act 3 question — "did you build the next generation while you were
// winning?" — had no answer available. You could not build one. This file is
// the answer, and it is deliberately two mechanisms that need each other:
//
//   THE PRODIGY. Filler is built incapable of greatness on purpose (see
//   rollCeilingTier) and that stays true. But rarely — a few times a decade —
//   somebody walks through the door with the real thing. They are announced,
//   because a chance you never knew you had is not a decision.
//
//   THE HANDOFF. Taking someone on needs a MENTOR: one of yours far enough
//   along to teach, which in practice means past their peak. That is the
//   coaching handoff, and it is why a veteran who can no longer win a bracket
//   is the most valuable person in the building. It also means a scene that
//   lets its whole generation age out at once has nobody left to teach with,
//   and dies exactly as §0 warns — not to bad luck, but to bad planning.

import { clamp, chance, rand, randInt, displayName } from './util.js'
import { statLevel, STAT_UNIT } from './constants.js'
import { chronicle } from './model.js'
import { generatePlayer } from './generate.js'
import { writeJournal } from './journal.js'
import { pushToast, dismissToastByKey } from './notify.js'
import { careerStageOf, yearsPastPeak, isActive } from './career.js'
import { shiftRel } from './social.js'

const bestSkill = (p) => Math.max(0, ...Object.values(p.charSkill || {}), 0)

/**
 * Who can teach. Being past your peak is the qualification, which is the whole
 * point of the mechanic: the moment a competitor stops being able to climb is
 * the moment they become able to build somebody who can. Veteran-tier eureka
 * (§1.9) sharpens this — a guide-writer teaches better — but the entry bar is
 * simply having been around the mountain.
 */
export function mentorsFor(save) {
  return Object.values(save.players)
    .filter((p) => !p.npc && isActive(p) && p.isRegular)
    .filter((p) => yearsPastPeak(p) > 0 || bestSkill(p) >= 55)
    .sort((a, b) => bestSkill(b) - bestSkill(a))
}

/** How good a teacher they are, 0..1 — knowledge, patience and standing. */
export function teachingQualityOf(p) {
  const knowledge = Math.min(0.35, (p.guidesWritten || 0) * 0.07 + (p.techniques?.length || 0) * 0.05)
  const patience = statLevel(p.social?.community || 0) * 0.03 + statLevel(p.personal?.learning || 0) * 0.02
  const standing = Math.min(0.25, bestSkill(p) / 240)
  return clamp(0.15 + knowledge + patience + standing, 0.15, 1)
}

/**
 * Who is worth taking on: regulars who actually come in, ranked by what they
 * could BECOME rather than what they are. A prodigy at skill 4 is a better
 * prospect than a journeyman at skill 40, and the whole skill of scouting is
 * being willing to believe that.
 */
export function prospectsFor(save) {
  return Object.values(save.players)
    .filter((p) => p.npc && isActive(p) && p.isRegular && (p.daysAttended || 0) >= 14)
    .map((p) => ({ player: p, score: prospectScore(p) }))
    .sort((a, b) => b.score - a.score)
}

const TIER_RANK = { talent: 4, prospect: 3, regular: 2, spectator: 1 }

export function prospectScore(p) {
  const tier = TIER_RANK[p.ceilingTier || 'regular'] || 2
  const young = Math.max(0, 30 - (p.age ?? 24)) * 0.6
  const spark = statLevel(p.personal?.aptitude || 0) + statLevel(p.personal?.mastery || 0)
  return tier * 14 + young + spark * 1.5 + bestSkill(p) * 0.15
}

/** Reads as a scouting note rather than a number. */
export function prospectLabel(p) {
  const tier = p.ceilingTier || 'regular'
  if (tier === 'talent') return 'the real thing — this one could go all the way'
  if (tier === 'prospect') return 'genuine potential, with the right guidance'
  if (tier === 'regular') return 'a solid regular; unlikely to ever be more'
  return 'here for the company, not the climb'
}

export const MAX_CAST = 8 // a room can only really carry so many projects at once

export const castSize = (save) =>
  Object.values(save.players).filter((p) => !p.npc && isActive(p)).length

export function canTakeOn(save) {
  return castSize(save) < MAX_CAST && mentorsFor(save).length > 0
}

/**
 * TAKE SOMEONE UNDER YOUR WING. The filler flag comes off, they become one of
 * yours — journalled, cultivable, eligible for everything the cast is eligible
 * for — and the mentor pours a piece of their career into them.
 *
 * The inheritance is knowledge, never talent: a great teacher gives a prospect
 * a head start and their own character, but cannot raise the ceiling the
 * prospect was born with. That is what keeps the prodigy rare and precious
 * rather than something you can manufacture out of whoever is standing there.
 */
export function takeUnderWing(save, prospectId, mentorId = null) {
  const p = save.players[prospectId]
  if (!p || !p.npc || !isActive(p)) return null
  if (castSize(save) >= MAX_CAST) return null
  const mentor = mentorId ? save.players[mentorId] : mentorsFor(save)[0]
  if (!mentor || mentor.npc || !isActive(mentor)) return null

  p.npc = false
  p.createdBy = 'user'
  p.mentorId = mentor.id
  p.takenOnDay = save.day
  p.takenOnYear = save.year
  mentor.protegeIds = [...(mentor.protegeIds || []), p.id]

  // What the old head actually hands over: a way of playing, and years of
  // work on one character compressed into a starting position.
  const q = teachingQualityOf(mentor)
  const mainId = mentor.mainCharId
  if (mainId) {
    const inherited = bestSkill(mentor) * q * 0.28
    p.charSkill = { ...(p.charSkill || {}) }
    p.charSkill[mainId] = Math.max(p.charSkill[mainId] || 0, inherited)
    if (!p.mainCharId) p.mainCharId = mainId
  }
  // And a little of who they are — the habits that rub off on anybody who
  // spends a year standing behind someone at a cabinet.
  for (const stat of ['composure', 'determination', 'learning']) {
    if ((p.personal?.[stat] ?? 0) < 3 * STAT_UNIT && chance(q)) {
      p.personal[stat] = (p.personal[stat] || 0) + STAT_UNIT
    }
  }
  p.belief = clamp((p.belief ?? 0) + 8 * q, 0, 100)
  p.passion = clamp((p.passion ?? 80) + 12, 0, 100)
  shiftRel(p, mentor, 35)
  shiftRel(mentor, p, 30)

  const pn = displayName(p, save)
  const mn = displayName(mentor, save)
  writeJournal(save, p, 'takenOn', { mentor: mn, always: true })
  writeJournal(save, mentor, 'tookOn', { student: pn, always: true })
  chronicle(save, '🤝', `${mn} has taken ${pn} under their wing. Whatever ${mn} knows, ${pn} is going to know.`)
  dismissToastByKey(save, `prospect_${p.id}`)
  return { prospect: p, mentor }
}

// ---------- The prodigy walks in ----------

/**
 * Rare on purpose. At these odds a prodigy shows up roughly every three or
 * four years — often enough that a fifteen-year lineage sees three or four,
 * seldom enough that missing one hurts. Gated on a room that is actually worth
 * walking into: talent goes where the scene is, which makes relevance and a
 * full floor into recruiting tools rather than just survival stats.
 */
export function maybeProdigyArrives(save) {
  if (save.settings.mode === 'sandbox') return null
  const rel = save.relevance ?? 55
  if (rel < 30) return null
  const regulars = Object.values(save.players).filter((p) => p.isRegular && isActive(p)).length
  if (regulars < 6) return null
  // ~1 in 900 days at a thriving scene, roughly halved at a merely alive one.
  const odds = 0.0011 * clamp(rel / 70, 0.4, 1.35) * clamp(regulars / 20, 0.5, 1.4)
  if (!chance(odds)) return null

  const p = generatePlayer(save, { npc: true, prodigy: true, age: randInt(15, 19) })
  p.isRegular = true
  p.daysAttended = 14 // they have been coming in a while before anyone noticed
  save.players[p.id] = p
  const name = displayName(p, save)
  chronicle(save, '✨', `Some kid has been quietly demolishing people on the corner cabinet all week. Somebody should find out who they are.`)
  pushToast(save, {
    icon: '✨',
    text: `${name} has been coming in — and they are the real thing. Take them under someone's wing before another room does.`,
    see: { screen: 'players', params: { playerId: p.id } },
    sticky: true,
    key: `prospect_${p.id}`,
  })
  return p
}

/**
 * Talent does not wait. A prodigy nobody takes on drifts to a scene that will
 * have them — which is the cost of not paying attention, and the reason the
 * toast is sticky rather than polite.
 */
export function prodigiesDrift(save) {
  for (const p of Object.values(save.players)) {
    if (!p.npc || !isActive(p) || p.ceilingTier !== 'talent') continue
    if ((p.daysAttended || 0) < 200) continue
    if (!chance(0.004)) continue
    p.banished = true // gone from the scene, not coming back — the same door
    p.leftForBetter = true
    dismissToastByKey(save, `prospect_${p.id}`)
    const name = displayName(p, save)
    chronicle(save, '🚪', `${name} stopped coming in. Word is they're travelling with a crew across town now. That one is going to hurt to watch.`)
    pushToast(save, {
      icon: '🚪',
      text: `${name} has moved on to another scene. Nobody here ever took them on.`,
      see: { screen: 'players' },
    })
  }
}

/**
 * The succession warning: your cast is old and nobody is coming up behind
 * them. Said once a year, and only when it is true, because this is the exact
 * failure §0 promises and it must never arrive as a surprise ending.
 */
export function successionWarning(save) {
  const cast = Object.values(save.players).filter((p) => !p.npc && isActive(p) && p.isRegular)
  if (!cast.length) return null
  const young = cast.filter((p) => yearsPastPeak(p) <= 0).length
  if (young > 0 || cast.length > 3) return null
  const key = `succession_y${save.year}`
  if (save.successionWarnedYear === save.year) return null
  save.successionWarnedYear = save.year
  const oldest = cast.sort((a, b) => (b.age ?? 0) - (a.age ?? 0))[0]
  pushToast(save, {
    icon: '⏳',
    text: `Everyone left in ${save.arcade.name} is ${careerStageOf(oldest).label}. If nobody comes up behind them, this is how it ends.`,
    see: { screen: 'players' },
    sticky: true,
    key,
  })
  chronicle(save, '⏳', `Look around ${save.arcade.name}: the people who built this place are all near the end of it, and there is nobody standing behind them.`)
  return oldest
}
