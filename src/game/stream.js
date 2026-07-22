// The arcade's stream channel: viewers, live chat, and channel growth.
//
// Quality of a streamed match is driven by exactly what the player is
// incentivized to hunt for: popular personalities, high skill on both
// sticks, and a genuinely close matchup. Tournaments auto-stream every
// match; EVO is always packed.

import { clamp, rand, randInt, choice, chance } from './util.js'
import { CHAT_NAME_PARTS, CHAT_LINES } from './names.js'
import { upsetSeverityOf } from './match.js'
import { econLog } from './economy.js'

// How famous an arcade player is, 0..1. Respect and glory are the resume.
export function personalityOf(player) {
  return clamp((player.respect + player.glory * 1.2) / 100, 0, 1)
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

/**
 * Viewers grow organically out of the follower base: followers come first
 * (from good streams and word of mouth), live viewers are a slice of them.
 * Tournaments concentrate your existing community, not conjure a new one —
 * a channel nobody follows gets a handful of curious walk-ins at best.
 * EVO is the one exception: it's the world's broadcast, not yours.
 */
export function viewersFor(save, quality, context) {
  const { hype, followers } = save.stream
  let qmult = 0.3 + quality / 80
  // A community souring on (or loving) the current patch watches accordingly.
  if (context !== 'evo' && save.settings?.mode !== 'sandbox') {
    qmult *= 1 + (save.patchMorale || 0) / 50
  }
  let v
  if (context === 'evo') {
    v = 500 + followers * 0.15 + hype * 8 + rand() * 150
  } else if (context === 'tournament') {
    v = (2 + followers * 0.035 + hype * 0.8) * qmult + rand() * 2
  } else {
    v = followers * (0.012 + hype * 0.00025) * qmult + (hype > 10 ? rand() * 3 : 0)
  }
  return Math.max(0, Math.round(v))
}

function chatName() {
  return `${choice(CHAT_NAME_PARTS.a)}${choice(CHAT_NAME_PARTS.b)}${choice(CHAT_NAME_PARTS.c)}`
}

/**
 * Pre-bakes chat so it can play back alongside the narration reveal.
 * Each comment has `at`: the narration line index it reacts to. When line
 * metadata is available, chat reacts to what actually happened on that line
 * — the specific move, the game win, the actor — and upset reactions are
 * graded by how shocking the result really was.
 */
export function generateComments({ viewers, narration, meta = [], aName, bName, winnerName, probA, upsetSeverity = 'none', context }) {
  if (viewers <= 0 || !narration.length) return []
  const total = clamp(Math.round(viewers / 3), 1, 34)
  const users = Array.from({ length: clamp(Math.ceil(total / 3), 1, 12) }, chatName)
  const lastIdx = narration.length - 1
  const close = Math.abs(probA - 0.5) < 0.15
  const smallStream = viewers < 12
  const comments = []
  const seenTexts = new Set()

  const reactTo = (at, onFinish) => {
    const m = meta[at] || {}
    // React to the specific thing that just happened on this line.
    if ((m.kind === 'game' || m.kind === 'beat') && m.move && chance(0.5)) {
      return choice(CHAT_LINES.moveReact).replaceAll('{m}', m.move)
    }
    if (m.kind === 'game' && m.actor && chance(0.35)) {
      return choice(CHAT_LINES.gameWin).replace('{p}', m.actor)
    }
    if (m.kind === 'struggle' && m.actor && chance(0.4)) {
      return choice([`${m.actor} is crumbling`, `somebody help ${m.actor}`, `${m.actor} needs a timeout`])
    }
    if (onFinish) {
      if (upsetSeverity === 'severe' && chance(0.55)) return choice(CHAT_LINES.upsetSevere)
      if (upsetSeverity === 'mild' && chance(0.5)) return choice(CHAT_LINES.upsetMild)
      if (chance(0.6)) return choice(CHAT_LINES.winnerBurst).replace('{w}', winnerName)
    }
    if (context === 'evo' && chance(0.3)) return choice(CHAT_LINES.evo)
    if (smallStream && chance(0.25)) return choice(CHAT_LINES.newViewer)
    if (close && chance(0.35)) return choice(CHAT_LINES.close)
    if (chance(0.3)) return choice(CHAT_LINES.playerRef).replace('{p}', chance(0.5) ? aName : bName)
    return choice(CHAT_LINES.hype)
  }

  for (let i = 0; i < total; i++) {
    // Weight comments toward the end of the match; ~35% land on the finish.
    const onFinish = i >= total * 0.65
    const at = onFinish ? lastIdx : randInt(0, Math.max(0, lastIdx - 1))
    // Chat repeats itself in real life too, but not THIS much: two re-rolls
    // against exact duplicates keeps it varied.
    let text = reactTo(at, onFinish)
    if (seenTexts.has(text)) text = reactTo(at, onFinish)
    if (seenTexts.has(text)) text = reactTo(at, onFinish)
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
  level, personality, probA, aWins, narration, meta = [], aName, bName, winnerName, context,
}) {
  const upsetSeverity = upsetSeverityOf(probA, aWins)
  // Hidden variance: some sets just deliver, some just don't. The pre-match
  // read is never a guarantee — that's the risk in picking.
  const quality = clamp(
    matchQuality({ level, personality, probA, upset: upsetSeverity !== 'none' }) + randInt(-8, 8),
    0, 100)
  const viewers = viewersFor(save, quality, context)
  const comments = generateComments({ viewers, narration, meta, aName, bName, winnerName, probA, upsetSeverity, context })

  const st = save.stream
  st.totalStreams += 1
  // Viewer-count firsts go in the collective memory.
  if (save.chronicle) {
    for (const threshold of [10, 100, 1000]) {
      if (st.peakViewers < threshold && viewers >= threshold) {
        save.chronicle.unshift({
          day: save.day, year: save.year, icon: '📡',
          text: `${st.channelName} broke ${threshold} live viewers for the first time`,
        })
      }
    }
  }
  st.peakViewers = Math.max(st.peakViewers, viewers)
  // Even a zero-viewer stream of a great match seeds a few followers — the
  // clips get around. Growth is capped per stream and saturates as the
  // channel approaches local-celebrity size, so it can't compound forever.
  const saturation = Math.max(0.05, 1 - st.followers / 20000)
  st.followers += Math.round(Math.min(viewers * 0.05, 25) * saturation)
    + (quality > 55 ? 2 : quality > 35 ? 1 : 0)
  // Hand-picked daily streams move the needle most — that's the curation
  // game. Tournament coverage grinds slowly; EVO is always a boost. Growth
  // has diminishing returns as the channel gets big.
  let gain = context === 'evo' ? 3 + quality / 50
    : context === 'tournament' ? (quality - 45) / 55
    : (quality - 32) / 14
  if (gain > 0) gain *= 1 - st.hype / 120
  st.hype = clamp(st.hype + gain, 0, 100)

  // Ad revenue: pennies per viewer, capped — this is a community arcade
  // channel, not a media empire.
  if (save.economy && viewers > 0) {
    const revenue = Math.min(20, Math.round(viewers) / 100)
    if (revenue >= 1) econLog(save, revenue, 'stream ad revenue')
    else save.economy.money = Math.round((save.economy.money + revenue) * 100) / 100
  }

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
    meta: matchEvent.narrationMeta || [],
    aName: matchEvent.aName,
    bName: matchEvent.bName,
    winnerName: matchEvent.winnerName,
    context,
  })
}

/**
 * Idle auto-streaming: does the cadence allow a stream on this day?
 * `hourly` and `weekends` gate by day only (the once-per-hour cap is enforced
 * separately by hour.streamedSetup); `daily`/`weekly` also gate on when the
 * last auto-stream actually fired. Returns true if a stream may fire now.
 */
export function autoStreamAllowed(save, absDay, weekday, cadence) {
  const last = save.idle?.autoStream?.lastStreamAbsDay ?? null
  if (cadence === 'weekends') return weekday === 0 || weekday === 6
  if (cadence === 'daily') return last == null || absDay > last
  if (cadence === 'weekly') return last == null || absDay - last >= 7
  return true // hourly
}

/**
 * Pick which match of an hour to auto-stream, per the selector. Only considers
 * live matches not already streamed. Returns the setupIndex, or null if none.
 */
export function pickAutoStreamSetup(save, hour, selector) {
  const candidates = (hour?.events || []).filter((e) => e.type === 'match' && !e.stream)
  if (!candidates.length) return null
  let pick
  if (selector === 'first') {
    pick = candidates.reduce((a, b) => (a.setupIndex <= b.setupIndex ? a : b))
  } else if (selector === 'best') {
    const score = (ev) => {
      const a = save.players[ev.aId]
      const b = save.players[ev.bId]
      if (!a || !b) return -1
      const level = ((a.charSkill[a.mainCharId] || 0) + (b.charSkill[b.mainCharId] || 0)) / 200
      const personality = (personalityOf(a) + personalityOf(b)) / 2
      return level + personality
    }
    pick = candidates.reduce((a, b) => (score(a) >= score(b) ? a : b))
  } else {
    // 'closest': nearest to a 50/50.
    pick = candidates.reduce((a, b) =>
      (Math.abs(a.probA - 0.5) <= Math.abs(b.probA - 0.5) ? a : b))
  }
  return pick.setupIndex
}

export function hypeLabel(hype) {
  if (hype >= 80) return 'a phenomenon'
  if (hype >= 60) return 'blowing up'
  if (hype >= 40) return 'a known channel'
  if (hype >= 20) return 'a growing channel'
  if (hype >= 5) return 'a tiny channel'
  return 'streaming into the void'
}
