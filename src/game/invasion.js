// INVASIONS — the world comes to you.
//
// A cultivated player stalls around skill 50–60 no matter how many creation
// points a lineage banks, and the reason is not the ceiling (a maxed build
// reaches 96, above the god tier) — it is that they have nobody left to learn
// from. Their whole career is spent beating a local scene, and with
// `lessonFactor` in place, beating people worse than you teaches almost
// nothing. That is correct, and it leaves a hole: there was no way for a
// local player to ever get world-class reps.
//
// This is the hole. A crew of top players from one region turns up for a day
// (later, a week), plays your regulars in the ordinary daily matchmaking, and
// leaves. Your people take a beating and learn an enormous amount from it —
// and because elo is standard K=32, losing to somebody 600 points above you
// costs about ONE point while stealing a set off them pays about THIRTY. An
// invasion is nearly free downside and the single biggest upside in the game.
//
// It starts happening once you have ever put somebody in the world top 64,
// and gets longer and more frequent as the arcade becomes somewhere worth
// visiting.

import { clamp, choice, chance, randInt, shuffle } from './util.js'
import { absDayOf } from './constants.js'
import { newPlayer, chronicle } from './model.js'
import { rankedInTop } from './world.js'
import { regionFlag } from './flags.js'
import { countryName, countryCluster } from './geo.js'

/** How long a visit lasts, by how much of a destination you have become. */
export const INVASION_MIN_DAYS = 1
export const INVASION_MAX_DAYS = 7
const INVASION_COOLDOWN = 40 // days after one ends before another can start

/**
 * What a visitor blurts out in their own language, by name CLUSTER (geo.js) —
 * every country resolves to one, so a crew from anywhere has a voice. The
 * line is what they say when they forget, or don't care, that they are a long
 * way from home; clusters without an entry just speak English-adjacent
 * arcade-ese and skip the language-barrier gag.
 */
const CLUSTER_VOICE = {
  JP: { hello: 'このゲームセンターが大好きです', tongue: 'Japanese' },
  KR: { hello: '이 오락실 분위기 진짜 좋네요', tongue: 'Korean' },
  CN: { hello: '这家机厅太棒了', tongue: 'Mandarin' },
  VN: { hello: 'chỗ này chơi vui thật sự', tongue: 'Vietnamese' },
  TH: { hello: 'ที่นี่สนุกมากเลย', tongue: 'Thai' },
  ARB: { hello: 'هذه الصالة أسطورية', tongue: 'Arabic' },
  CIS: { hello: 'этот зал — просто пушка', tongue: 'Russian' },
  PL: { hello: 'ta salka jest niesamowita', tongue: 'Polish' },
  IT: { hello: 'questa sala è fantastica', tongue: 'Italian' },
  BR: { hello: 'esse fliperama é muito melhor ao vivo', tongue: 'Portuguese' },
  ES: { hello: 'oigan, este lugar está increíble', tongue: 'Spanish' },
  FR: { hello: 'cette salle est incroyable, franchement', tongue: 'French' },
  DE: { hello: 'diese Halle ist der Wahnsinn', tongue: 'German' },
  SE: { hello: 'det här stället är helt otroligt', tongue: 'Swedish' },
  IN: { hello: 'yaar, this arcade is unreal', tongue: null },
  SG: { hello: 'wah, the setups here damn solid ah', tongue: null },
  MY: { hello: 'the setups here are too good lah', tongue: null },
  ID: { hello: 'tempat ini keren banget', tongue: 'Indonesian' },
  PH: { hello: 'grabe, ang ganda ng lugar na to', tongue: 'Tagalog' },
}
export const voiceOf = (code) => CLUSTER_VOICE[countryCluster(code)] || null

export const regionName = (key) => countryName(key)
// "the United States" needs to become "The United States crew", not
// "The the United States crew" — many country names carry their own article.
const crewName = (key) => {
  const n = regionName(key)
  return `The ${n.replace(/^the /, '')} crew`
}

/**
 * Is the arcade somewhere the world would bother visiting?
 *
 * Keyed on the HIGH-WATER mark rather than the current rankings: once you have
 * put somebody on the world list, you are on the map, and a bad month should
 * not switch the whole feature off.
 */
export function invasionsUnlocked(save) {
  if (save.tally?.everRanked) return true
  if (rankedInTop(save, 64).length) {
    if (save.tally) save.tally.everRanked = true
    return true
  }
  return false
}

/** How much of a destination this arcade is, 0–1. Drives length and frequency. */
export function destinationScore(save) {
  const followers = save.stream?.followers || 0
  const rel = save.relevance ?? 55
  const ranked = rankedInTop(save, 64).length
  return clamp(
    Math.min(1, followers / 6000) * 0.4
    + clamp((rel - 40) / 55, 0, 1) * 0.3
    + Math.min(1, ranked / 4) * 0.3,
    0, 1)
}

/** Turn a world elite into somebody who can actually walk through the door. */
function visitorFrom(save, elite, untilAbs) {
  const p = newPlayer({
    id: `visitor_${elite.id}`,
    createdBy: 'cpu',
    // NPC so they never appear in your roster or the world rankings as yours —
    // the elite already has a row there, from evoRoster.
    npc: true,
    alias: elite.alias,
    firstName: elite.firstName,
    lastName: elite.lastName,
  })
  p.visitor = { eliteId: elite.id, region: elite.region, untilAbs }
  p.isRegular = true
  p.elo = elite.elo
  p.mainCharId = elite.mainCharId
  p.settledMain = true
  p.charSkill = { [elite.mainCharId]: elite.skill }
  // The elite's own build walks through the door — the dossier, the narration
  // and the concession stand all meet the same person. Spark is pinned high
  // regardless: they flew here to play, so they're in the room every day.
  if (elite.personal) p.personal = { ...elite.personal }
  if (elite.social) p.social = { ...elite.social }
  if (elite.temperament) p.temperament = elite.temperament
  if (elite.socialTemperament) p.socialTemperament = elite.socialTemperament
  if (elite.gender) p.gender = elite.gender
  if (elite.heritage) p.heritage = elite.heritage
  if (elite.facePalette) p.facePalette = elite.facePalette
  if (elite.firstName) { p.firstName = elite.firstName; p.lastName = elite.lastName }
  if (elite.catchphrase) p.catchphrase = elite.catchphrase
  if (elite.description) p.description = elite.description
  p.personal = { ...p.personal, spark: 10, composure: Math.max(8, p.personal.composure || 0) }
  p.social = { ...p.social, charisma: Math.max(6, p.social.charisma || 0) }
  p.passion = 100
  p.mood = 7
  return p
}

/**
 * Roll for a visiting crew. Called once a day from the universal tick.
 */
export function maybeInvasion(save) {
  if (!save || save.settings?.mode === 'sandbox') return null
  if (!invasionsUnlocked(save)) return null
  const abs = absDayOf(save.day, save.year)
  if (save.invasion) return null
  if (abs < (save.nextInvasionAbs || 0)) return null

  const score = destinationScore(save)
  // From roughly once a season when you first get on the map, to once a month
  // when the arcade is a genuine destination.
  if (!chance(0.006 + score * 0.028)) return null

  // A crew travels together, so they all come from one place. Any country
  // with at least two elites can field one — which means the big scenes visit
  // often and a two-person crew from somewhere tiny is a genuine event.
  const byRegion = {}
  for (const e of save.evoRoster || []) {
    byRegion[e.region] ??= []
    byRegion[e.region].push(e)
  }
  const regions = Object.keys(byRegion).filter((r) => byRegion[r].length >= 2)
  if (!regions.length) return null
  const region = choice(regions)

  const days = Math.round(INVASION_MIN_DAYS + score * (INVASION_MAX_DAYS - INVASION_MIN_DAYS))
  const untilAbs = abs + Math.max(INVASION_MIN_DAYS, days)
  const size = clamp(2 + Math.round(score * 3), 2, 5)
  const crew = shuffle([...byRegion[region]]).slice(0, size)

  const visitorIds = []
  for (const e of crew) {
    const v = visitorFrom(save, e, untilAbs)
    save.players[v.id] = v
    visitorIds.push(v.id)
  }
  save.invasion = { region, untilAbs, startedAbs: abs, visitorIds, days: untilAbs - abs }

  const flag = regionFlag(region)
  const names = crew.map((e) => e.alias).join(', ')
  chronicle(save, '✈️', `${flag} A crew from ${regionName(region)} is in town for ${untilAbs - abs} day${untilAbs - abs === 1 ? '' : 's'} — ${names}. Everybody is going to want a set.`)
  return save.invasion
}

/**
 * Send them home. Their elo goes back to the world roster, so a visit that
 * went badly for them shows up in the rankings — your scene can genuinely
 * knock somebody down the world list.
 */
export function endInvasion(save) {
  const inv = save.invasion
  if (!inv) return
  const abs = absDayOf(save.day, save.year)
  let beaten = 0
  for (const id of inv.visitorIds) {
    const v = save.players[id]
    if (!v) continue
    const elite = (save.evoRoster || []).find((e) => e.id === v.visitor?.eliteId)
    if (elite) {
      if (v.elo < elite.elo) beaten += 1
      elite.elo = Math.round(v.elo)
    }
    delete save.players[id]
  }
  const flag = regionFlag(inv.region)
  chronicle(save, '👋', beaten
    ? `${flag} ${crewName(inv.region)} went home — and ${beaten} of them left with a worse ranking than they arrived with.`
    : `${flag} ${crewName(inv.region)} went home. Everybody in the arcade got a story out of it.`)
  save.invasion = null
  save.nextInvasionAbs = abs + INVASION_COOLDOWN
}

/** Called on the daily tick: start one, or send the current one home. */
export function invasionDaily(save) {
  if (save.invasion) {
    if (absDayOf(save.day, save.year) >= save.invasion.untilAbs) endInvasion(save)
    return
  }
  maybeInvasion(save)
}

export const isVisiting = (p) => !!p?.visitor
export const currentVisitors = (save) =>
  Object.values(save.players || {}).filter(isVisiting)

// ---------- What a visitor says ----------

const VISITOR_LINES = [
  'This place looks like a dump on stream. It\'s actually really nice?',
  'I flew eleven hours for this and I would do it again.',
  'Your setups are better than the ones at our majors. Genuinely.',
  'Okay, who here is the best? Point at them. I\'ll wait.',
  'Back home nobody would play me at this hour. I love it here.',
  'I don\'t know what you put in this game\'s neutral but we don\'t have it.',
  'Somebody explain the food to me. What is that. I want one.',
  'You have a REGULAR who plays that character? On purpose?',
]

const HOST_REPLIES = [
  'uhhh. thanks?',
  "I'm going to take that as a compliment.",
  'Please stop three-oh-ing our best player.',
  'You can just say you like it, man.',
  'Mate, you are ranked eleventh in the world. Be nice.',
  "That's the nicest thing anyone's said about this carpet.",
  'We were doing fine before you got here, you know.',
]

/** "…I don't speak Japanese." */
const LOST_IN_TRANSLATION = [
  (t) => `oh — sorry, I don't speak ${t}.`,
  (t) => `I have absolutely no idea what that meant, but same to you.`,
  (t) => `...is that ${t}? I did two weeks of ${t} on an app once.`,
  (t) => `nodding politely. Nodding politely.`,
]

/**
 * A visitor exchange for the concession stand: what they say, and what a local
 * says back. Returns null unless somebody in the group is actually a visitor.
 *
 * Deliberately short. These want to feel like overheard fragments, not scenes —
 * two lines and out.
 */
export function visitorExchange(save, group, nameOf) {
  const visitor = group.find(isVisiting)
  if (!visitor) return null
  const local = group.find((p) => p !== visitor && !isVisiting(p))
  if (!local) return null
  const voice = voiceOf(visitor.visitor.region)

  // Sometimes they forget where they are, and the room has to cope.
  if (voice?.tongue && chance(0.35)) {
    return [
      { speaker: nameOf(visitor), text: voice.hello },
      { speaker: nameOf(local), text: choice(LOST_IN_TRANSLATION)(voice.tongue) },
    ]
  }
  if (voice?.hello && !voice.tongue && chance(0.2)) {
    return [
      { speaker: nameOf(visitor), text: voice.hello },
      { speaker: nameOf(local), text: choice(HOST_REPLIES) },
    ]
  }
  return [
    { speaker: nameOf(visitor), text: choice(VISITOR_LINES) },
    { speaker: nameOf(local), text: choice(HOST_REPLIES) },
  ]
}
