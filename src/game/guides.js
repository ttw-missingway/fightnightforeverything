// CHARACTER GUIDES — notoriety for people who aren't loud.
//
// Fame in this game had exactly one road: be a personality, get streamed, grow
// a following. That left the Stoic and the Scholar — the person who plays one
// character for a thousand hours, and the person who takes it apart — with no
// way to be known for it, which is backwards. In a real scene the definitive
// document on a character IS the reputation.
//
// So: the player who leads their peers on a character can write the guide for
// it. Whether it catches on depends on how good they ACTUALLY are, not on how
// loud they are. A guide that catches on raises the arcade's relevance (people
// outside come looking) and the author's popularity.
//
// This is also the counterweight to the taste layer. `interest.js` pushes
// people to chase new characters, buffs and the tier list; nothing pushed the
// other way, toward staying put and going deep. This does.

import { uid, clamp } from './util.js'
import { absDayOf } from './constants.js'

// How many people need real reps on a character before "leads their peers"
// means anything. Without this the contrarians the taste layer produces —
// often the only person on their pick — would print a guide on day one.
// Calibrated against what the game actually produces, not against what "good"
// sounds like: measured over a 500-day run, the BEST player on a given
// character sits between 5 and 20 skill, because per-character skill is spread
// much thinner than skill-on-your-main. The first cut of this used 45 and
// produced zero guides in six runs.
const MIN_PEERS = 3
const MIN_REPS = 8       // games on the character before you count as a peer
const LEAD_MARGIN = 4    // how far clear of the next-best you must be
const MIN_SKILL = 15     // nobody writes the book on a character they're mediocre at
const REACH_SPAN = 25    // skill above MIN_SKILL that counts as definitive

/** Everyone with real reps on a character, best first. */
function peersOn(save, charId) {
  return Object.values(save.players)
    .filter((p) => !p.retired && !p.banished && p.isRegular)
    .filter((p) => {
      const rec = p.charRecord?.[charId]
      return rec && rec.w + rec.l >= MIN_REPS
    })
    .sort((a, b) => (b.charSkill[charId] || 0) - (a.charSkill[charId] || 0))
}

/**
 * Is this player the definitive voice on this character right now?
 *
 * Relative to peers, not absolute — being the best Zoner in a room of six
 * Zoners is the qualification. Absolute skill decides whether the guide is any
 * good, which is a separate question handled below.
 */
export function leadsCharacter(save, player, charId) {
  const peers = peersOn(save, charId)
  if (peers.length < MIN_PEERS) return false
  if (peers[0].id !== player.id) return false
  const mine = player.charSkill[charId] || 0
  const next = peers[1] ? (peers[1].charSkill[charId] || 0) : 0
  return mine >= MIN_SKILL && mine >= next + LEAD_MARGIN
}

/** Has this character already been written up by this author? */
const alreadyWrote = (save, playerId, charId) =>
  (save.guides || []).some((g) => g.authorId === playerId && g.charId === charId)

/**
 * A guide's reach: how far it travels. Driven by ABSOLUTE skill (is the advice
 * actually good) plus a little of the author's standing — a known name gets
 * read, but a nobody with genuinely great tech still gets passed around.
 */
function reachOf(player, charId) {
  const skill = player.charSkill[charId] || 0
  const known = Math.min(1, ((player.respect || 0) + (player.popularity || 0)) / 90)
  return clamp((skill - MIN_SKILL) / REACH_SPAN * 0.8 + known * 0.35, 0, 1)
}

/**
 * Once a day, per attendee: do they write the book on their character?
 *
 * Deliberately rare and tied to `mastery` and `loyalty` — this is the payoff
 * for depth, and depth is what those two stats are for.
 */
export function maybeWriteGuide(save, player, events, chance) {
  const charId = player.mainCharId
  if (!charId || !player.settledMain) return
  if (alreadyWrote(save, player.id, charId)) return
  if (!leadsCharacter(save, player, charId)) return
  const per = player.personal
  const p = 0.004 + (per.mastery || 0) * 0.0016 + (per.loyalty || 0) * 0.0011
    + (per.analysis || 0) * 0.0009
  if (!chance(p)) return

  const char = save.game.characters.find((c) => c.id === charId)
  if (!char) return
  const reach = reachOf(player, charId)
  save.guides ??= []
  const guide = {
    id: uid('guide'),
    charId,
    charName: char.name,
    authorId: player.id,
    day: save.day,
    year: save.year,
    absDay: absDayOf(save.day, save.year),
    skill: Math.round(player.charSkill[charId] || 0),
    reach: +reach.toFixed(2),
    // Resolved later — a guide has to be out in the world before anyone knows
    // whether it caught on.
    landed: null,
  }
  save.guides.unshift(guide)
  if (save.guides.length > 60) save.guides.pop()
  return guide
}

/**
 * A little after publication, the scene decides whether the guide mattered.
 *
 * Separated from writing it on purpose: the lag is what makes it read as the
 * community picking something up rather than the author declaring themselves
 * important.
 */
export function resolveGuides(save, events, chance, pName) {
  const abs = absDayOf(save.day, save.year)
  for (const g of save.guides || []) {
    if (g.landed !== null) continue
    if (abs - g.absDay < 7) continue
    const author = save.players[g.authorId]
    if (!author) { g.landed = false; continue }
    g.landed = chance(g.reach)
    if (!g.landed) continue
    // It caught on: the arcade gets known as the place that produced it, and
    // the author gets a name without ever having been a personality.
    const bump = 2 + g.reach * 5
    save.relevance = clamp((save.relevance ?? 55) + bump, 0, 100)
    author.popularity = clamp((author.popularity || 0) + 4 + g.reach * 10, 0, 100)
    author.respect += 3
    events?.push({
      type: 'guide',
      text: `${pName(author)}'s ${g.charName} guide is getting passed around — people outside the scene are reading it. (+${bump.toFixed(1)} relevance)`,
    })
  }
}

/** Guides for one character, newest first — for the Codex. */
export const guidesFor = (save, charId) =>
  (save.guides || []).filter((g) => g.charId === charId)
