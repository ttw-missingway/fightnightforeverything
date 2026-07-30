// DEPRECATED (docs/DEPRECATED.md) — the staged exhibition night, CUT by the
// revision rather than fixed: streaming already showcases, and the P4
// calendar generates low-stakes matches. Nothing live imports this file;
// scripts/check-deprecated.mjs enforces that. Kept because the pre-revision
// baseline was measured with this lever live, and because its relevance-
// headroom shape (BALANCE.md §12: "a showcase buys WHEN, not WHETHER") is a
// tuning lesson later pumps must not unlearn.
//
// EVO Media Day's in-broadcast "exhibition" match is unrelated and remains in
// tournament.js.

import { uid, clamp } from '../util.js'
import { formatDay } from '../constants.js'
import { chronicle, pushVod } from '../model.js'
import { trySpend } from '../economy.js'
import { addHype } from '../stream.js'
import { arcadeEntrant, resolveEntrantMatch, castFirst } from '../tournament.js'

export const EXHIBITION_COST = 140
export const EXHIBITION_COOLDOWN = 28
export const EXHIBITION_MIN_FOLLOWERS = 150

export function canStageExhibition(save) {
  if (save.settings.mode === 'sandbox') return { ok: true }
  const followers = save.stream?.followers || 0
  if (followers < EXHIBITION_MIN_FOLLOWERS) {
    return {
      ok: false,
      reason: `nobody would tune in yet — a showcase needs ${EXHIBITION_MIN_FOLLOWERS} followers on the channel (you have ${followers})`,
    }
  }
  const abs = (save.year - 1) * 336 + save.day
  const since = abs - (save.lastExhibitionAbs || 0)
  if (since < EXHIBITION_COOLDOWN) return { ok: false, reason: `the scene needs ${EXHIBITION_COOLDOWN - since} more days between showcases` }
  if (save.economy.money < EXHIBITION_COST) return { ok: false, reason: `booking the night costs $${EXHIBITION_COST}` }
  const candidates = Object.values(save.players)
    .filter((p) => p.isRegular && !p.retired && !p.banished && p.mainCharId)
  if (candidates.length < 4) return { ok: false, reason: 'you need at least 4 established players to headline a card' }
  return { ok: true }
}

export function runExhibition(save) {
  const can = canStageExhibition(save)
  if (!can.ok) return { ok: false, reason: can.reason }
  if (!trySpend(save, EXHIBITION_COST, 'staged an exhibition night')) return { ok: false, reason: 'not enough cash' }

  // The four biggest draws in the building, seeded 1v4 / 2v3.
  const stars = Object.values(save.players)
    .filter((p) => p.isRegular && !p.retired && !p.banished && p.mainCharId)
    .sort(castFirst)
    .slice(0, 4)
    .map((p) => arcadeEntrant(save, p))
  const semi1 = resolveEntrantMatch(save, stars[0], stars[3], { long: true, context: 'tournament' })
  const semi2 = resolveEntrantMatch(save, stars[1], stars[2], { long: true, context: 'tournament' })
  const w1 = stars.find((e) => e.id === semi1.winnerId)
  const w2 = stars.find((e) => e.id === semi2.winnerId)
  const final = resolveEntrantMatch(save, w1, w2, { long: true, context: 'tournament' })
  const champ = [w1, w2].find((e) => e.id === final.winnerId)

  const viewers = (semi1.stream?.viewers || 0) + (semi2.stream?.viewers || 0) + (final.stream?.viewers || 0)
  // The showcase payoff: relevance scaled by who tuned in, faded by staleness,
  // and scaled by HEADROOM so a showcase revives a conversation rather than
  // pinning one at the top. Decline must stay inevitable.
  const staleDays = (save.year - save.lastPatch.year) * 336 + (save.day - save.lastPatch.day)
  const freshness = clamp(1 - Math.max(0, staleDays - 70) / 180, 0.4, 1)
  const rel0 = save.relevance ?? 55
  const headroom = 0.25 + 0.75 * (100 - rel0) / 100
  const relGain = Math.round(clamp(2 + viewers / 110, 2, 7) * freshness * headroom)
  save.relevance = clamp(rel0 + relGain, 0, 100)
  addHype(save, 5)
  champ.ref.glory += 6
  champ.ref.respect += 4
  save.lastExhibitionAbs = (save.year - 1) * 336 + save.day

  const record = {
    id: uid('t'),
    type: 'singles',
    format: 'single',
    name: 'Exhibition Showcase',
    day: save.day, year: save.year, dateLabel: formatDay(save.day, save.year),
    storylines: [`${save.arcade.name} put its four biggest names under the lights — ${viewers} watched live.`],
    revealed: 999999,
    rounds: [
      { title: 'Showcase Semifinals', matches: [semi1, semi2] },
      { title: 'Showcase Final', matches: [final] },
    ],
    placements: [{ place: 1, name: champ.name }],
    champion: champ.name,
    entrantCount: 4,
  }
  pushVod(save, record)
  chronicle(save, '🎪', `Exhibition night: ${champ.name} took the showcase in front of ${viewers} viewers — the scene felt BIG tonight.`)
  return { ok: true, viewers, relGain, record }
}
