// The world outside your arcade, and where your people sit in it.
//
// `evoRoster` has always existed — 64 elites with elo, a region and a tier —
// but it was only ever visible for one day a year, at EVO. That made the
// single most motivating thing in the game invisible for the other 335: there
// was no way to look up and see how far away the top actually is.
//
// This ranks the world and your cast on one ladder. It is available from the
// first day of a lineage, it is not earned, and it is not flattering: a player
// you just created lands somewhere around 70th and stays there until you do
// something about it.

import { statusOf } from './constants.js'

const bestSkillOf = (p) => Math.max(0, ...Object.values(p.charSkill || {}), 0)

/**
 * Everyone the world would recognise, ranked.
 *
 * Elo is the ladder because it is the one number both halves of the world
 * actually share — elites carry it, your players earn it, and they update
 * against each other whenever they meet.
 *
 * Filler is deliberately absent. The forgettable regular who wanders into your
 * arcade on a Tuesday is not a globally ranked competitor, and putting forty of
 * them in the table would bury the thing the table is for.
 */
export function worldRankings(save) {
  if (!save) return []
  const elites = (save.evoRoster || []).map((e) => ({
    id: e.id,
    kind: 'elite',
    name: e.alias,
    region: e.region,
    tier: e.tier,
    elo: Math.round(e.elo || 0),
    skill: Math.round(e.skill || 0),
    titles: e.titles || 0,
    charId: e.mainCharId || null,
    yours: false,
  }))
  const cast = Object.values(save.players || {})
    .filter((p) => !p.npc && !p.banished)
    .map((p) => ({
      id: p.id,
      kind: 'yours',
      name: p.alias || `${p.firstName} ${p.lastName}`,
      region: 'home',
      tier: statusOf(p)?.key || 'newbie',
      elo: Math.round(p.elo || 0),
      skill: Math.round(bestSkillOf(p)),
      titles: p.evoTitles || 0,
      charId: p.mainCharId || null,
      yours: true,
      retired: !!p.retired,
    }))
  return [...elites, ...cast]
    .sort((a, b) => b.elo - a.elo || b.skill - a.skill || b.titles - a.titles)
    .map((r, i) => ({ ...r, rank: i + 1 }))
}

/** Where one of yours currently sits, or null if they aren't ranked. */
export function worldRankOf(save, playerId) {
  const row = worldRankings(save).find((r) => r.id === playerId)
  return row ? row.rank : null
}

/** Your best-ranked player right now — the one the climb is measured by. */
export function bestRanked(save) {
  return worldRankings(save).find((r) => r.yours && !r.retired) || null
}

/**
 * The elites your scene is realistically chasing next: the block of the ladder
 * immediately above your best player. "Beat these four" is a goal; "reach #1"
 * is a wish.
 */
export function theClimb(save, span = 4) {
  const rows = worldRankings(save)
  const mine = rows.find((r) => r.yours && !r.retired)
  if (!mine) return []
  const above = rows.filter((r) => r.rank < mine.rank)
  return above.slice(-span)
}

/** Is anyone of yours inside the world's top `n`? Drives world-feed interest. */
export const rankedInTop = (save, n) =>
  worldRankings(save).filter((r) => r.yours && !r.retired && r.rank <= n)
