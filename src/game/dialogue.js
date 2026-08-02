// Layer-one dialogue: no AI, no API — every player has a VOICE derived from
// their stats (plus an editable quirk), and each dialogue moment draws from
// template pools filtered through that voice. The same player always sounds
// like themselves; two players never sound quite alike.
//
// Voice dimensions:
//   energy: chill | neutral | fiery       (how loud they run)
//   humor:  dry | earnest | clowning      (what their jokes look like)
//   speech: terse | plain | chatty        (how many words they spend)
//   quirk:  a signature flavor that overrides lines ~half the time

import { choice, chance } from './util.js'
import { boundSave } from './rng.js'
import LINES from '../content/dialogue.json' with { type: 'json' }
import QUIRK_LINES from '../content/dialogue-quirks.json' with { type: 'json' }


// NOTE ON IMPORTS: this file must not import social.js. model.js imports
// dialogue.js (for deriveVoice) and social.js imports model.js, so reaching
// for getRel here would close the cycle. Relationships are read straight off
// the player instead — it's a one-line lookup either way.

export const VOICE_ENERGIES = ['chill', 'neutral', 'fiery']
export const VOICE_HUMORS = ['dry', 'earnest', 'clowning']
export const VOICE_SPEECHES = ['terse', 'plain', 'chatty']
export const VOICE_QUIRKS = [
  'none', 'third-person', 'anime', 'old-head', 'technical', 'humble', 'menace', 'philosopher', 'hypeman',
]

export const DEFAULT_VOICE = { energy: 'neutral', humor: 'dry', speech: 'plain', quirk: 'none' }

// Voice falls out of who the player already is. Stats first, dice second.
//
// Calibrated to the SPARSE stat scale: since the temperament rework, stats are
// a 0-5 point buy scaled by STAT_UNIT, so a roster looks like mostly zeroes
// with a few spikes where somebody actually invested. A stat at 0 means "not
// part of this person", not "the low end of a bell curve" — so the thresholds
// have to read investment, not magnitude.
//
// The previous thresholds (>= 7, <= 3, >= 13) were written for the old 1-10
// roll, where 7 was a high roll. Under the point buy, >= 7 needs 4 of 5 points
// on one exact stat and almost never happened, while <= 3 caught every stat
// nobody had spent on — which is most of them. The result was that every
// single person in the arcade derived the identical voice, and every line in
// the game came out of the same three pools.
const INVESTED = 4 // 2 points — this is a trait they actually have
const STRONG = 6 // 3 points — they lead with it

export function deriveVoice(p) {
  const per = p.personal
  const soc = p.social
  // Aggression read across two stats, so either a spike or a spread counts.
  const energy = per.dominance + (per.mojo ?? 0) >= STRONG ? 'fiery'
    : (per.temperance ?? 0) >= INVESTED || per.dominance + (per.mojo ?? 0) + per.spark <= 2 ? 'chill'
      : 'neutral'
  const humor = soc.persona >= INVESTED && soc.politeness < INVESTED ? 'clowning'
    : soc.politeness >= INVESTED ? 'earnest' : 'dry'
  // Terse is the honest default for somebody who spent nothing on expression.
  const speech = soc.charisma >= STRONG ? 'chatty'
    : soc.charisma >= INVESTED || soc.persona >= INVESTED ? 'plain' : 'terse'
  const options = ['none', 'none', 'none']
  if (soc.persona >= STRONG) options.push('third-person')
  if (per.analysis >= INVESTED) options.push('technical')
  if (soc.politeness >= INVESTED && soc.sportsmanship >= INVESTED) options.push('humble')
  if (soc.politeness === 0 && per.dominance >= INVESTED) options.push('menace')
  if ((per.temperance ?? 0) >= STRONG) options.push('philosopher')
  if (soc.charisma >= STRONG) options.push('hypeman')
  options.push(chance(0.5) ? 'anime' : 'old-head')
  return { energy, humor, speech, quirk: choice(options) }
}

// Placeholders: {t} target/opponent, {m} move, {c} character, {mem} memory,
// {self} the speaker's own name (third-person quirk lives on this).
/**
 * The spoken lines live in `src/content/dialogue.json` — see that directory's
 * README. Placeholders: {t} target/opponent, {m} move, {c} character,
 * {mem} memory, {self} the speaker's own name (the third-person quirk lives
 * on this one).
 */


// A quirk hijacks the line about half the time. This is where a voice
// becomes THEIRS.
/* Quirk lines live in `src/content/dialogue-quirks.json`. */


// ---------- Who are we talking to? ----------
// People don't speak to a stranger the way they speak to someone they've
// played a hundred sets against. Everything downstream — which lines are even
// allowed, how much hedging goes on the front, whether a name gets used —
// hangs off this.

export const FAMILIARITY_TIERS = ['stranger', 'acquaintance', 'familiar', 'close', 'hostile']

/**
 * How well `a` knows `b`, from the record they've already built: games played,
 * how they feel about each other, and how many times they've actually spoken.
 */
export function familiarity(a, b) {
  if (!a || !b || a.id === b.id) return 'familiar'
  const rel = a.relationships?.[b.id] || 0
  const h = a.h2h?.[b.id]
  const games = h ? (h.w || 0) + (h.l || 0) : 0
  const spoken = a.met?.[b.id]?.count || 0
  // Bad blood overrides everything: you can know someone very well and still
  // talk to them like an enemy.
  if (rel <= -45) return 'hostile'
  // Thresholds set from a measured 120-day scene rather than guessed: contact
  // per pair runs min 0 / median 2 / p75 4 / p90 7 / max 20, because
  // matchmaking spreads a roster of thirty people thin. The first pass used
  // 2/8/24 and left 88% of the room stuck on "acquaintance" with nobody ever
  // reaching "close".
  const contact = games + spoken
  if (contact >= 9 || rel >= 45) return 'close'
  if (contact >= 4 || rel >= 20) return 'familiar'
  if (contact >= 1 || rel !== 0) return 'acquaintance'
  return 'stranger'
}

/** Record that these two actually spoke. Cheap, and it feeds familiarity. */
export function noteMeeting(a, b, absDay = 0) {
  if (!a || !b || a.id === b.id) return
  if (!a.met) a.met = {}
  const prior = a.met[b.id]
  if (prior) prior.count++
  else a.met[b.id] = { firstDay: absDay, count: 1 }
}

/** True the first time these two have ever exchanged a word. */
export function isFirstMeeting(a, b) {
  if (!a || !b || a.id === b.id) return false
  if (a.met?.[b.id]) return false
  const h = a.h2h?.[b.id]
  return !((h ? (h.w || 0) + (h.l || 0) : 0) > 0)
}

// ---------- Not saying the same thing twice ----------
// Templates are identified by hashing them BEFORE substitution, so the same
// sentence about two different opponents still counts as a repeat. No content
// refactor needed — the pools stay plain strings.

const SAID_RING = 14 // per person
const ROOM_RING = 26 // and the room as a whole

function lineId(template) {
  let h = 5381
  for (let i = 0; i < template.length; i++) h = ((h * 33) ^ template.charCodeAt(i)) >>> 0
  return h.toString(36)
}

// The arcade's short-term memory — what the ROOM has heard lately, so two
// people don't say the same thing in one stretch of simulation. It lives on
// the SAVE (via the bound-save accessor) and not at module level: a module
// ring survives across runs in one process, which made two same-seed runs
// hear each other's echoes and pick different lines — the one determinism
// break the seeded-RNG work didn't catch, because it wasn't randomness.
const roomFallback = [] // menu-time speech with no save bound (UI-only)
function roomRecentOf() {
  const save = boundSave()
  if (!save) return roomFallback
  return (save.dialogueRecent ??= [])
}

function rememberLine(player, id) {
  if (!player.said) player.said = []
  player.said.push(id)
  while (player.said.length > SAID_RING) player.said.shift()
  const roomRecent = roomRecentOf()
  roomRecent.push(id)
  while (roomRecent.length > ROOM_RING) roomRecent.shift()
}

// ---------- The render pipeline ----------
// This is the variety multiplier. One template becomes many different voices
// without writing a single new line: a tic on the front, a casing habit, a
// hedge for someone you've just met, a nickname for someone you haven't.

const TICS = {
  fiery: ['Yo—', 'Nah,', 'Listen—', 'Bro,'],
  neutral: ['Look,', 'Okay so,', 'I mean,'],
  chill: ['I mean,', 'Honestly,', 'Eh—'],
}

// What you say to somebody you barely know before you say the actual thing.
const HEDGES = [
  'No offence,', 'Sorry—', "Don't take this the wrong way, but", 'Genuinely,',
]

// ...and the tag you put on the end for someone you know far too well.
const CLOSE_TAGS = [', man.', ', dude.', ' lol.', ", I'm serious."]
const HOSTILE_TAGS = [' Whatever.', ' Yeah.', ' Sure.']

/**
 * Lowercase the opening letter — but never when the sentence starts with
 * somebody's name or "I". Blindly decapitalising turned "P91 plays defense"
 * into "p91 plays defense", which reads like a typo rather than a voice.
 */
function decap(line, names) {
  const first = line.split(/[\s,.!?]/)[0]
  // "I", and every contraction of it — the apostrophe isn't a split point, so
  // a bare `first === 'I'` check let "I'm" through and produced "i'm".
  if (/^I(['\u2019]|$)/.test(first)) return line
  if (names.some((n) => n && first === n.split(/\s/)[0])) return line
  if (/^[A-Z][a-z]*[A-Z]/.test(first)) return line // CamelCase gamertags
  return line.charAt(0).toLowerCase() + line.slice(1)
}

/**
 * Kinds that are somebody saying their own name for the first time.
 *
 * A hedge is what you put in front of a REMARK — an opinion, a joke, a read on
 * how somebody plays — to take the edge off it. In front of an introduction it
 * is nonsense: "No offence, I'm GrappleFan" apologises for having a name. These
 * kinds are also all stranger-tier by definition, which is exactly when the
 * hedge fires, so every introduction in the game was getting one.
 */
const NO_HEDGE = new Set(['intro', 'openingIntro', 'greet', 'openingGreet'])

function applyVoice(line, v, tier, names = [], kind = null) {
  let out = line

  // A signature filler. Same person, same tic — that's what makes it theirs.
  let opener = false
  if (chance(0.18)) {
    const pool = TICS[v.energy] || TICS.neutral
    out = `${choice(pool)} ${decap(out, names)}`
    opener = true
  }

  // Talking to someone you've just met takes the edge off — but only when
  // there's something to take the edge OFF (see NO_HEDGE). One opener at a
  // time, too: stacked on a tic it reads as a stutter ("Sorry— look, I'm
  // GrappleFan"), and in the opening weeks every line in the building is
  // stranger-tier, so those all landed in the same fortnight.
  if (!opener && !NO_HEDGE.has(kind) && tier === 'stranger' && chance(0.35)) {
    out = `${choice(HEDGES)} ${decap(out, names)}`
  } else if (tier === 'close' && chance(0.25) && /[.!?]$/.test(out)) {
    out = out.replace(/[.!?]$/, choice(CLOSE_TAGS))
  } else if (tier === 'hostile' && chance(0.25)) {
    out += choice(HOSTILE_TAGS)
  }

  // Casing habits. Loud people get loud; quiet people don't bother with caps.
  if (v.energy === 'fiery' && out.length < 46 && chance(0.14)) out = out.toUpperCase()
  else if (v.energy === 'chill' && chance(0.14)) out = decap(out, names)

  // Politeness reads as not contracting. Used sparingly — it's stiff on purpose.
  if (v.humor === 'earnest' && tier === 'stranger' && chance(0.3)) {
    out = out.replace(/\bdon't\b/g, 'do not').replace(/\bcan't\b/g, 'cannot')
      .replace(/\bI'm\b/g, 'I am').replace(/\bit's\b/g, 'it is')
  }
  return out
}

// A joke that crosses the line needs a licence: either you know them well
// enough to get away with it, or you're the sort who doesn't care.
//
// Deliberately a PROBABILITY, not a ban. Refusing outright meant a dry-voiced
// regular never once joked with someone new, which didn't soften the
// interaction — it deleted it, and the whole beat went silent.
function allowedByTier(kind, tier, v) {
  if (kind !== 'joke' && kind !== 'trashTalk') return true
  if (tier === 'close' || tier === 'hostile') return true
  if (v.quirk === 'menace' || v.humor === 'clowning') return true
  if (tier === 'stranger') return chance(kind === 'trashTalk' ? 0.3 : 0.55)
  if (tier === 'acquaintance') return chance(kind === 'trashTalk' ? 0.7 : 0.9)
  return true
}

/**
 * The single entry point: a player says something appropriate to the moment,
 * in their own voice, to whoever is listening. Returns null when no line fits.
 *
 * ctx: {
 *   t: other's display name, to: the other PLAYER (unlocks familiarity),
 *   m: move, c: character, mem: memory text, self: own name, absDay
 * }
 */
export function speak(player, kind, ctx = {}) {
  const v = player.voice || DEFAULT_VOICE
  const spec = LINES[kind]
  if (!spec) return null
  const listener = ctx.to || null
  const tier = listener ? familiarity(player, listener) : 'familiar'
  if (!allowedByTier(kind, tier, v)) return null

  // Talking to someone new, a joke reaches for the gentlest register the
  // pools have rather than whatever this voice would normally pick.
  const softening = tier === 'stranger' && kind === 'joke' && spec.pools.earnest && chance(0.6)
  const dimVal = softening ? 'earnest' : (spec.dimension ? v[spec.dimension] : 'any')
  let candidates = [...(spec.pools[dimVal] || []), ...(spec.pools.any || [])]

  // A pool written FOR this relationship outranks the voice's usual register
  // most of the time — this is where the difference between a stranger and
  // somebody you've played two hundred sets with actually lives. Not always,
  // so the voice still colours who they are.
  const tierPool = spec.tiers?.[tier]
  if (tierPool?.length && chance(0.62)) candidates = tierPool

  const quirkPool = QUIRK_LINES[v.quirk]?.[kind]
  if (quirkPool && chance(0.5)) candidates = quirkPool
  if (!candidates.length) return null

  // Drop anything this person (or the room) has said lately. If that empties
  // the pool, fall back rather than going silent.
  const stale = new Set([...(player.said || []), ...roomRecentOf()])
  const fresh = candidates.filter((c) => !stale.has(lineId(c)))
  const pool = fresh.length ? fresh : candidates

  // Speech length: terse players find the short version, chatty ones commit.
  const picks = [choice(pool), choice(pool), choice(pool)]
  const template = v.speech === 'terse' ? picks.reduce((a, b) => (a.length <= b.length ? a : b))
    : v.speech === 'chatty' ? picks.reduce((a, b) => (a.length >= b.length ? a : b))
    : picks[0]

  rememberLine(player, lineId(template))
  if (listener) noteMeeting(player, listener, ctx.absDay ?? 0)

  const filled = template
    .replaceAll('{t}', ctx.t ?? 'you')
    .replaceAll('{m}', ctx.m ?? 'that')
    .replaceAll('{c}', ctx.c ?? 'your character')
    .replaceAll('{mem}', ctx.mem ?? 'that one time')
    .replaceAll('{self}', ctx.self ?? 'they')
    .replaceAll('{w}', ctx.w ?? '0')
    .replaceAll('{l}', ctx.l ?? '0')
    .replaceAll('{n}', ctx.n ?? '0')
    .replaceAll('{x}', ctx.x ?? 'that')
  // {x} is a proper noun too — a character, a player, a food. Without it in
  // the guard list, a chill-voice decap turns "Piper is the reason I come
  // here" into "piper is the reason I come here".
  return applyVoice(filled, v, tier, [ctx.t, ctx.self, ctx.x], kind)
}

export function voiceSummary(voice) {
  if (!voice) return 'plain'
  const bits = [voice.energy, voice.humor, voice.speech]
  if (voice.quirk && voice.quirk !== 'none') bits.push(`quirk: ${voice.quirk}`)
  return bits.join(' · ')
}
