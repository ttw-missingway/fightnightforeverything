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
import { getMatchup } from './model.js'
import { fill, guides as GUIDES } from '../content/index.js'

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

/**
 * How far clear of the field this player is on the character, -1..+1.
 * Leading is not a gate on WRITING — anybody can write a guide — it is most of
 * what decides whether the guide is any good.
 */
function standingOn(save, player, charId) {
  const peers = peersOn(save, charId).filter((p) => p.id !== player.id)
  if (!peers.length) return 0
  const mine = player.charSkill[charId] || 0
  const best = peers[0].charSkill[charId] || 0
  const spread = Math.max(6, best)
  return clamp((mine - best) / spread, -1, 1)
}

/** Has this character already been written up by this author? */
const alreadyWrote = (save, playerId, charId) =>
  (save.guides || []).some((g) => g.authorId === playerId && g.charId === charId)

/**
 * A guide's reach: how far it travels. Driven by ABSOLUTE skill (is the advice
 * actually good) plus a little of the author's standing — a known name gets
 * read, but a nobody with genuinely great tech still gets passed around.
 */
function reachOf(save, player, charId) {
  const skill = player.charSkill[charId] || 0
  const known = Math.min(1, ((player.respect || 0) + (player.popularity || 0)) / 90)
  const standing = standingOn(save, player, charId)
  // Absolute skill is most of it — is the advice actually correct — with being
  // demonstrably the best on the character as the other half of the argument,
  // and a little credit for already having a name. A mediocre player writing up
  // a character three people beat them on lands near zero, which is the point:
  // plenty of guides get written, most sink.
  return clamp(
    (skill - MIN_SKILL) / REACH_SPAN * 0.55 + standing * 0.4 + known * 0.25,
    0, 1)
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
  // Anybody who has actually put the reps in can write one. Leading the field
  // is NOT required — a scene produces plenty of guides from players nobody
  // rates, and those simply go nowhere. Gating writing on being the best made
  // guides a rare trophy (~2 a run) instead of a thing the community does.
  const rec = player.charRecord?.[charId]
  if (!rec || rec.w + rec.l < MIN_REPS) return
  const per = player.personal
  const p = (0.0024 + (per.mastery || 0) * 0.0010 + (per.loyalty || 0) * 0.0007
    + (per.analysis || 0) * 0.0009)
    // The person who IS the authority is likelier to sit down and write it.
    * (leadsCharacter(save, player, charId) ? 2.6 : 1)
  if (!chance(p)) return

  const char = save.game.characters.find((c) => c.id === charId)
  if (!char) return
  const reach = reachOf(save, player, charId)
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

// ---------- Reading one ----------

/**
 * THE GUIDE, WRITTEN OUT.
 *
 * A guide used to be four fields and a boolean — author, character, date, did
 * it catch on — which is a record that a document exists rather than a
 * document. The Codex could list them; nobody could read one. That is a strange
 * gap in a game whose whole argument for the Stoic and the Scholar is "the
 * definitive write-up on a character IS the reputation".
 *
 * So the body is composed on demand from what the author ACTUALLY knew when
 * they wrote it: their skill on the character, the tech the scene had found by
 * then, the matchup chart the game's own numbers produce, the archetype, and
 * where the community had the character on the tier list that season. Nothing
 * is decorative and nothing is invented — a guide by a mediocre player reads
 * like one, because every section is chosen by their own numbers.
 *
 * Composed rather than stored, deliberately: a stored body would be a second
 * copy of facts that already live on the save, and it would go stale the day
 * somebody discovers a technique. Prose lives in `src/content/guides.json`.
 *
 * `pick` is passed in so callers from a render can supply a stable chooser —
 * the engine's RNG must never be advanced by drawing a screen (the P3 lesson).
 */
export function readGuide(save, guide) {
  if (!guide) return null
  const char = save.game.characters.find((c) => c.id === guide.charId)
  const author = save.players[guide.authorId]
  // Stable per guide: the same document reads the same way every time it is
  // opened, without storing anything. A tiny string hash off the guide id.
  let h = 0
  for (const ch of String(guide.id)) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  let n = 0
  const pick = (arr) => arr[(h + 977 * n++) % arr.length]

  const skill = guide.skill || 0
  // Which voice they wrote it in: how much authority the numbers gave them.
  const band = skill >= 45 ? 'authority' : skill >= 25 ? 'journeyman' : 'hopeful'
  const planBand = skill >= 45 ? 'strong' : skill >= 25 ? 'average' : 'weak'
  const reps = author?.charRecord?.[guide.charId]
    ? author.charRecord[guide.charId].w + author.charRecord[guide.charId].l
    : 0

  // The matchup chart, as the author would have summarised it. Real numbers.
  const others = save.game.characters.filter((c) => c.id !== guide.charId)
  const scored = others.map((c) => ({ c, mu: getMatchup(save.game, guide.charId, c.id) }))
    .sort((a, b) => b.mu - a.mu)
  const best = scored[0]
  const worst = scored[scored.length - 1]

  // The tech that existed when they wrote it — not everything known now.
  const tech = (save.innovations || [])
    .filter((i) => i.charId === guide.charId && absDayOf(i.day, i.year) <= guide.absDay)
    .map((i) => i.name)

  // Where the scene had the character on the nearest tier list at the time.
  const list = (save.tierLists || []).find((l) => absDayOf(l.day, l.year) <= guide.absDay)
  let tierKey = 'unranked'
  if (list) {
    const t = Object.entries(list.tiers || {}).find(([, ids]) => (ids || []).includes(guide.charId))?.[0]
    if (t) tierKey = t === 'S' || t === 'A' ? 'top' : t === 'B' || t === 'C' ? 'mid' : 'low'
  }

  const data = {
    char: char?.name || 'the character',
    author: author ? (author.alias || author.firstName) : 'a departed regular',
    game: save.game.name,
    arch: char?.archetype || 'fighter',
    // Only the fallback line ever prints the archetype as a noun phrase, and
    // "a All-Rounder" is the kind of seam that makes generated prose read as
    // generated. Every archetype has its own paragraph, so this is belt and
    // braces for a game whose roster the player can rename.
    archArticle: /^[aeiou]/i.test(char?.archetype || 'f') ? 'an' : 'a',
    skill: Math.round(skill),
    reps,
    best: best?.c.name || 'nobody in particular',
    worst: worst?.c.name || 'nobody in particular',
    tech: tech.join(', '),
    tier: tierKey,
  }
  const say = (t) => fill(t, data)

  const sections = [
    { heading: 'Why I wrote this', body: say(pick(GUIDES.openings[band])) },
    { heading: 'What the character is', body: say(GUIDES.identity[data.arch] || GUIDES.identity.default) },
    { heading: 'The gameplan', body: say(pick(GUIDES.gameplan[planBand])) },
    {
      heading: 'Matchups',
      body: [say(GUIDES.matchups.best), say(GUIDES.matchups.worst), say(GUIDES.matchups.even)].join(' '),
    },
    { heading: 'Tech', body: say(tech.length ? GUIDES.tech.has : GUIDES.tech.none) },
    { heading: 'What the room thinks', body: say(GUIDES.tier[tierKey]) },
    { heading: 'Last word', body: say(pick(GUIDES.closings[band])) },
  ]

  return {
    guide,
    char,
    author,
    title: `${data.char}: ${band === 'authority' ? 'the long version' : band === 'journeyman' ? 'notes' : 'what I have so far'}`,
    byline: data.author,
    sections,
    matchups: { best: best?.c.name, bestPct: best?.mu, worst: worst?.c.name, worstPct: worst?.mu },
    tech,
    reps,
  }
}

/** Every guide in the run, newest first — for the Codex's library. */
export const allGuides = (save) => [...(save.guides || [])]
  .sort((a, b) => (b.absDay || 0) - (a.absDay || 0))
