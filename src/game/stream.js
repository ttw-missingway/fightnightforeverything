// The arcade's stream channel: viewers, live chat, and channel growth.
//
// Quality of a streamed match is driven by exactly what the player is
// incentivized to hunt for: popular personalities, high skill on both
// sticks, and a genuinely close matchup. Tournaments auto-stream every
// match; EVO is always packed.

import { clamp, rand, randInt, choice, chance } from './util.js'
import { CHAT_NAME_PARTS, CHAT_LINES } from './names.js'

// How famous an arcade player is, 0..1. Respect and glory are the resume.
export function personalityOf(player) {
  return clamp((player.respect + player.glory * 1.2) / 150, 0, 1)
}

export function elitePersonality(elite) {
  return elite.tier === 'god' ? 1 : elite.tier === 'legend' ? 0.85 : 0.7
}

/**
 * 0..100. level: avg skill 0..1; personality: avg fame 0..1;
 * probA: pre-match win chance; upset: did the underdog win?
 */
export function matchQuality({ level, personality, probA, upset }) {
  const closeness = 1 - Math.abs(probA - 0.5) * 2
  let q = 100 * (0.32 * level + 0.3 * closeness + 0.32 * personality)
  if (upset) q += 12
  return Math.round(clamp(q, 0, 100))
}

export function viewersFor(save, quality, context) {
  const hype = save.stream.hype
  let v
  if (context === 'evo') {
    v = (600 + hype * 25) * (0.75 + quality / 200) + rand() * 200
  } else if (context === 'tournament') {
    v = (8 + hype * 6) * (0.25 + quality / 70) + rand() * 4
  } else {
    // A brand-new channel streams into the void: zero viewers until the
    // arcade builds some hype.
    v = hype * 2.5 * (0.25 + quality / 70) + (hype > 3 ? rand() * 3 : 0)
  }
  return Math.max(0, Math.round(v))
}

function chatName() {
  return `${choice(CHAT_NAME_PARTS.a)}${choice(CHAT_NAME_PARTS.b)}${choice(CHAT_NAME_PARTS.c)}`
}

/**
 * Pre-bakes chat so it can play back alongside the narration reveal.
 * Each comment has `at`: the narration line index it reacts to.
 */
export function generateComments({ viewers, narration, aName, bName, winnerName, probA, upset, context }) {
  if (viewers <= 0 || !narration.length) return []
  const total = clamp(Math.round(viewers / 3), 1, 34)
  const users = Array.from({ length: clamp(Math.ceil(total / 3), 1, 12) }, chatName)
  const lastIdx = narration.length - 1
  const close = Math.abs(probA - 0.5) < 0.15
  const comments = []
  const seenTexts = new Set()
  for (let i = 0; i < total; i++) {
    // Weight comments toward the end of the match; ~35% land on the finish.
    const onFinish = i >= total * 0.65
    const at = onFinish ? lastIdx : randInt(0, Math.max(0, lastIdx - 1))
    const pick = () => {
      if (onFinish && upset && chance(0.5)) return choice(CHAT_LINES.upset)
      if (onFinish && chance(0.6)) return choice(CHAT_LINES.winnerBurst).replace('{w}', winnerName)
      if (context === 'evo' && chance(0.3)) return choice(CHAT_LINES.evo)
      if (close && chance(0.35)) return choice(CHAT_LINES.close)
      if (chance(0.3)) return choice(CHAT_LINES.playerRef).replace('{p}', chance(0.5) ? aName : bName)
      return choice(CHAT_LINES.hype)
    }
    // Chat repeats itself in real life too, but not THIS much: two re-rolls
    // against exact duplicates keeps it varied.
    let text = pick()
    if (seenTexts.has(text)) text = pick()
    if (seenTexts.has(text)) text = pick()
    seenTexts.add(text)
    comments.push({ at, user: choice(users), text })
  }
  comments.sort((x, y) => x.at - y.at)
  return comments
}

/**
 * Builds the full stream payload for a resolved match and applies channel
 * growth (hype, followers, peak). Attach the returned object to the match.
 */
export function buildStream(save, {
  level, personality, probA, aWins, narration, aName, bName, winnerName, context,
}) {
  const upset = (aWins && probA < 0.4) || (!aWins && probA > 0.6)
  const quality = matchQuality({ level, personality, probA, upset })
  const viewers = viewersFor(save, quality, context)
  const comments = generateComments({ viewers, narration, aName, bName, winnerName, probA, upset, context })

  const st = save.stream
  st.totalStreams += 1
  st.peakViewers = Math.max(st.peakViewers, viewers)
  st.followers += Math.max(0, Math.round(viewers * (0.015 + quality / 2000)))
  // Hand-picked daily streams move the needle most — that's the curation
  // game. Tournament coverage grinds slowly; EVO is always a boost. Growth
  // has diminishing returns as the channel gets big.
  let gain = context === 'evo' ? 3 + quality / 50
    : context === 'tournament' ? (quality - 50) / 55
    : (quality - 42) / 16
  if (gain > 0) gain *= 1 - st.hype / 120
  st.hype = clamp(st.hype + gain, 0, 100)

  return { viewers, comments, quality, gain: Math.round(gain * 10) / 10 }
}

// Convenience for arcade-vs-arcade daily matches.
export function buildStreamForPlayers(save, a, b, matchEvent, context = 'daily') {
  const level = ((a.charSkill[a.mainCharId] || 0) + (b.charSkill[b.mainCharId] || 0)) / 200
  const personality = (personalityOf(a) + personalityOf(b)) / 2
  return buildStream(save, {
    level,
    personality,
    probA: matchEvent.probA,
    aWins: matchEvent.winnerId === a.id,
    narration: matchEvent.narration,
    aName: matchEvent.aName,
    bName: matchEvent.bName,
    winnerName: matchEvent.winnerName,
    context,
  })
}

export function hypeLabel(hype) {
  if (hype >= 80) return 'a phenomenon'
  if (hype >= 60) return 'blowing up'
  if (hype >= 40) return 'a known channel'
  if (hype >= 20) return 'a growing channel'
  if (hype >= 5) return 'a tiny channel'
  return 'streaming into the void'
}
