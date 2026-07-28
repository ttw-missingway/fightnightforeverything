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
import { regionFlag, arcadeFlag } from './flags.js'

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
/**
 * How many places the world ranking actually has.
 *
 * Sixty-four, and no more. Everyone below the cut is simply UNRANKED — the
 * alternative is inventing thousands of nobodies so that a fresh player can be
 * "#4,812th", which is both a lie and a worse feeling than being told the
 * truth: you are not on the list yet.
 */
export const WORLD_RANK_SIZE = 64

/**
 * Everyone the world would recognise, ranked — plus everyone who isn't, with a
 * null rank.
 *
 * Elo is the ladder because it is the one number both halves of the world
 * actually share. The top 64 is a fixed number of PLACES, not a fixed set of
 * people: when one of yours climbs into it, an elite drops out of it. That is
 * the whole fantasy.
 *
 * Filler is deliberately absent. The forgettable regular who wanders in on a
 * Tuesday is not a globally ranked competitor.
 */
export function worldRankings(save) {
  if (!save) return []
  const elites = (save.evoRoster || []).map((e) => ({
    id: e.id,
    kind: 'elite',
    name: e.alias,
    region: e.region,
    flag: regionFlag(e.region),
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
      flag: arcadeFlag(save), // your cast fly the arcade's colours
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
    .map((r, i) => ({ ...r, rank: i < WORLD_RANK_SIZE ? i + 1 : null }))
}

/** Just the ranked ones — the list the world actually publishes. */
export const rankedWorld = (save) => worldRankings(save).filter((r) => r.rank != null)

/** The elo you would need right now to appear on the list at all. */
export function cutoffElo(save) {
  const ranked = rankedWorld(save)
  return ranked.length ? ranked[ranked.length - 1].elo : 0
}

/** Where one of yours currently sits, or null if they aren't ranked. */
export function worldRankOf(save, playerId) {
  const row = worldRankings(save).find((r) => r.id === playerId)
  return row ? row.rank : null
}

/**
 * Your best player, ranked or not — the one the climb is measured by. Their
 * `rank` is null until they actually break into the world's top 64.
 */
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
  // Unranked? Then the thing to chase is the bottom of the list itself.
  const above = rows.filter((r) => r.elo > mine.elo && r.rank != null)
  return above.slice(-span)
}

/** Is anyone of yours inside the world's top `n`? Drives world-feed interest. */
export const rankedInTop = (save, n) =>
  worldRankings(save).filter((r) => r.yours && !r.retired && r.rank != null && r.rank <= n)

/**
 * Everything the game actually knows about one ranked competitor, gathered
 * from the broadcasts it kept.
 *
 * Elites carry no match history of their own — they exist between tournaments
 * as a name and an elo — so their record has to be reconstructed from the VODs,
 * which is also the honest answer to "what do you know about this person?".
 * You know what you watched.
 */
export function dossier(save, id) {
  const rows = worldRankings(save)
  const row = rows.find((r) => r.id === id)
  if (!row) return null
  const mine = new Set(Object.values(save.players || {}).filter((p) => !p.npc).map((p) => p.id))

  const records = [save.lastTournament, ...(save.vods || [])].filter(Boolean)
  const seen = new Set()
  const bouts = []
  for (const rec of records) {
    if (seen.has(rec.id)) continue
    seen.add(rec.id)
    for (const round of rec.rounds || []) {
      for (const m of round.matches || []) {
        if (m.bye) continue
        if (m.aId !== id && m.bId !== id) continue
        const isA = m.aId === id
        const oppId = isA ? m.bId : m.aId
        bouts.push({
          matchId: m.id,
          event: rec.name || (rec.type === 'evo' ? `EVO ${rec.year}` : 'a tournament'),
          dateLabel: rec.dateLabel,
          round: round.title,
          opponent: isA ? m.bName : m.aName,
          versusYou: mine.has(oppId),
          won: m.winnerId === id,
          score: m.setScore,
        })
      }
    }
  }
  const vsYou = bouts.filter((b) => b.versusYou)

  // VODs roll off after a dozen or so broadcasts, so tape alone leaves most of
  // the world with an empty file. The hall of fame keeps EVO placings forever,
  // which is exactly the history that ought to be permanent about a world-class
  // competitor: what they did at the majors.
  const bare = (n) => String(n || '').replace(/^[^\p{L}]+/u, '').trim()
  const self = bare(row.name)
  const majors = []
  for (const rec of save.hallOfFame || []) {
    if (rec.type !== 'evo') continue
    if (bare(rec.champion) === self) { majors.push({ year: rec.year, place: 1, event: rec.name }); continue }
    const pl = (rec.placements || []).find((x) => bare(x.name) === self)
    if (pl) majors.push({ year: rec.year, place: pl.place, event: rec.name })
  }
  majors.sort((a, b) => b.year - a.year)

  return {
    row,
    majors,
    bouts: bouts.slice(0, 40),
    record: { w: bouts.filter((b) => b.won).length, l: bouts.filter((b) => !b.won).length },
    vsYou: { w: vsYou.filter((b) => b.won).length, l: vsYou.filter((b) => !b.won).length, bouts: vsYou.slice(0, 10) },
  }
}

/** Where this competitor sits in the pecking order, in words. */
export const TIER_LABEL = {
  god: 'One of the very best alive',
  legend: 'A name everybody knows',
  killer: 'A genuine threat in any bracket',
  contender: 'Ranked, and dangerous on the day',
}
