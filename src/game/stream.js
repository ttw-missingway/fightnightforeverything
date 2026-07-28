// The arcade's stream channel: viewers, live chat, and channel growth.
//
// Quality of a streamed match is driven by exactly what the player is
// incentivized to hunt for: popular personalities, high skill on both
// sticks, and a genuinely close matchup. Tournaments auto-stream every
// match; EVO is always packed.

import { clamp, rand, randInt, choice, chance, displayName } from './util.js'
import { CHAT_NAME_PARTS, CHAT_LINES } from './names.js'
import { difficultyOf, statLevel } from './constants.js'
import { upsetSeverityOf } from './match.js'
import { bumpPassion, noveltyOf } from './career.js'
import { chronicle } from './model.js'
import { econLog } from './economy.js'
import { perceivedTier } from './interest.js'

// How famous an arcade player is, 0..1. Respect and glory are the resume; a
// growing public profile (popularity, earned from being featured) adds to it —
// so pointing the camera at someone genuinely makes them a bigger draw.
export function personalityOf(player) {
  // Presence is innate screen-magnetism — the walk-on nobody can look away
  // from. Fame (respect/glory/popularity) is EARNED draw stacked on top of it.
  //
  // Persona is the OTHER kind of draw: the polarising one. It was pure cost —
  // socialDelta splits the room over a big personality and nothing anywhere
  // paid it back, which is why a scene measured HEALTHIER with the whole
  // Dramatic row deleted (death rate 80% -> 60%). People tune in for someone
  // half the room can't stand; that is what a heel is for. Worth less per
  // point than presence, because presence is likeable and this isn't.
  return clamp((player.respect + player.glory * 1.2 + (player.popularity || 0) * 0.4
    + (player.personal?.presence ?? 5) * 3
    + (player.social?.persona ?? 0) * 1.8) / 100, 0, 1)
}

// Being featured under the lights is how a player becomes battle-tested. Every
// streamed set builds BELIEF (the earned stage composure that raises their
// skill ceiling and, crucially, is the antidote to the EVO choke) and
// POPULARITY (a public profile that keeps their passion topped up). Bigger
// crowds and bigger stages give more — which is what makes deep tournament runs
// and EVO worth chasing, and makes WHO you point the daily camera at a real
// decision: the hypest match grows your channel, but your prospect's match is
// what forges a champion.
const STAGE_BASE = { daily: 0.6, moneymatch: 1.6, tournament: 1.0, evo: 4 }

// Belief is a WAGER, not an accrual. What moves it is how you performed against
// what the room EXPECTED of you, amplified by how many people were watching:
//
//     Δ = STAGE_BASE × viewerFactor × (0.35 + 2.6 × (achieved − expected))
//
// Take the underdog who drags a monster to a last game in front of a packed
// channel: they lost, and they walk away MORE sure of themselves, because
// nobody thought they'd get close. The goliath who gets swept by them loses a
// chunk of who they thought they were. And a local king beating the same locals
// every week stops gaining anything at all — his `expected` has caught up with
// him, so the only way left to build is bigger stages and bigger crowds.
//
// That last property is what retired the old per-stage caps: expectation caps
// belief on its own, and it does it in a way the player can reason about.
const EXPOSURE = 0.35 // just being on camera, win or lose
const SURPRISE = 2.6 // how hard the gap between result and expectation bites
const WIN_FLOOR = 0.15 // winning never shakes you, however scrappy it looked
// Being on camera is a thrill the first hundred times and Tuesday after that.
// Exposure alone tops out at "comfortable under the lights" — nowhere near
// champion nerve. Without this ceiling the bump is an accrual again, and a big
// enough channel could idle its way to a 90-belief player on exposure alone.
const EXPOSURE_CAP = 35

// A big swing has to be VISIBLE or the player can never learn the mechanic —
// belief moving silently just reads as luck. Only genuinely notable nights get
// a line, so the chronicle doesn't fill up with every streamed set.
function noteBeliefSwing(save, ref, delta, viewers) {
  if (Math.abs(delta) < 6) return
  const who = displayName(ref, save)
  const crowd = viewers >= 400 ? 'a packed channel' : `${viewers} watching`
  chronicle(save, delta > 0 ? '🔥' : '💔', delta > 0
    ? `${who} did it under the lights with ${crowd} — you can see it in how they carry themselves now`
    : `${who} came apart on stream in front of ${crowd}. Something went out of them that night.`)
}

// A steady head doesn't spiral after a bad night. Composure was already the
// innate half of stage nerve; this makes it the thing that protects the earned
// half too, so the two read as one attribute.
const lossDamp = (ref) => clamp(1.25 - statLevel(ref.personal?.composure) * 0.075, 0.5, 1.25)

// How well a player actually performed, 0..1, read off the real scoreline —
// a 3–0 sweep is 1, a 3–2 war is ~0.67, getting swept is 0.
function achievedFrom(myGames, oppGames, target) {
  if (!target) return null
  return clamp(0.5 + 0.5 * (myGames - oppGames) / target, 0, 1)
}

/**
 * `outcome` is {probA, aWins, target, loserGames} and `players` is [a, b] in
 * that order. Without it (a stage with no set behind it) players just collect
 * the exposure term.
 */
export function applyStageReps(save, players, stream, context = 'daily', weight = 1, outcome = null) {
  const viewers = stream?.viewers || 0
  const base = (STAGE_BASE[context] ?? 0.5) * weight
  const viewerFactor = clamp(0.35 + viewers / 110, 0.35, 3)
  for (let i = 0; i < players.length; i++) {
    const p = players[i]
    if (!p || p.kind === 'elite') continue // elites are already made
    const ref = p.ref || p // accept a raw player or a tournament entrant
    if (!ref || ref.createdBy == null) continue

    const belief = ref.belief ?? 0
    const achieved = outcome
      ? (() => {
        const won = (i === 0) === outcome.aWins
        const my = won ? outcome.target : outcome.loserGames
        const opp = won ? outcome.loserGames : outcome.target
        return { won, value: achievedFrom(my, opp, outcome.target) }
      })()
      : null

    // Familiarity with the camera — fades toward its own low ceiling.
    let delta = base * viewerFactor * EXPOSURE * clamp((EXPOSURE_CAP - belief) / 100, 0, 1)
    // What actually forges a champion: beating what the room expected of you.
    // Gains asymptote toward the top so the last stretch is a grind; losses are
    // flat, so the further you've been built up the further you have to fall.
    if (achieved && achieved.value != null) {
      const expected = i === 0 ? outcome.probA : 1 - outcome.probA
      const swing = base * viewerFactor * SURPRISE * (achieved.value - expected)
      delta += swing >= 0 ? swing * (100 - belief) / 100 : swing * lossDamp(ref)
      if (achieved.won) delta = Math.max(delta, base * viewerFactor * WIN_FLOOR * (100 - belief) / 100)
    }
    ref.belief = clamp(belief + delta, 0, 100)
    noteBeliefSwing(save, ref, delta, viewers)
    // Popularity climbs with eyeballs (fades slowly without them, in endDay).
    const shine = 0.55 + (ref.personal?.presence ?? 5) * 0.09 // the camera finds some people
    ref.popularity = clamp((ref.popularity ?? 0) + base * viewerFactor * 0.9 * shine * (1 - (ref.popularity ?? 0) / 120), 0, 100)
    // Recognition rekindles the fire — being seen is why a lot of people play.
    // Being on the channel is a thrill that wears off like every other one —
    // this was the single biggest passion fountain in the game, handing a
    // streamed player up to +2.5 a night against a decay of ~0.17, which is
    // why nobody ever burned out.
    bumpPassion(ref, Math.min(2.5, 0.25 + viewers / 100) * noveltyOf(ref))
  }
}

export function elitePersonality(elite) {
  return elite.tier === 'god' ? 1 : elite.tier === 'legend' ? 0.85 : 0.7
}

/**
 * 0..100. level: avg skill 0..1; personality: avg fame 0..1;
 * probA: pre-match win chance; upset: did the underdog win?
 */
export function matchQuality({ level, personality, probA, upset, mirror = false, staleness = 0 }) {
  const closeness = 1 - Math.abs(probA - 0.5) * 2
  let q = 100 * (0.32 * level + 0.3 * closeness + 0.32 * personality)
  if (upset) q += 12
  // A mirror is the least interesting version of any matchup — same tools,
  // same answers, and no matchup story to tell.
  if (mirror) q -= 8
  // CHARACTER FATIGUE. `closeness` is 30% of quality, which meant a roster
  // converging on a couple of characters produced ever closer matches and
  // therefore ever better streams: measured, SIX of eight archetype ablations
  // RAISED hype, because deleting a temperament made the room more uniform.
  //
  // This is a SWING, not a tax. The first cut of it was a flat penalty of up
  // to -34, and because stream quality feeds ad revenue it simply made the
  // whole game harder — control 73% -> 90%, and removing the Scholar
  // started HELPING. Signed around the expected rotation, a fresh matchup gains
  // roughly what a stale one loses, so the scene is rewarded for variety
  // without the channel being poorer on average.
  q -= staleness * 16
  return Math.round(clamp(q, 0, 100))
}

// How many recent streamed sets are remembered for fatigue purposes.
const FATIGUE_WINDOW = 24

/**
 * SIGNED, around the expected rotation: -1 means these two are a fresh sight on
 * the channel, +1 means it has been nothing but them. Reads the rolling record
 * of what has actually been broadcast.
 *
 * Signed on purpose — an unsigned penalty is a tax on the whole channel, and
 * since stream quality feeds ad revenue that lands as a difficulty increase
 * rather than as a preference for variety.
 */
export function stalenessOf(save, charIds) {
  const recent = save.stream?.recentChars || []
  if (recent.length < 6) return 0 // too early to be bored
  const ids = charIds.filter(Boolean)
  if (!ids.length) return 0
  const seen = recent.filter((id) => ids.includes(id)).length
  const expected = recent.length * 0.22 // two characters out of a healthy rotation
  return clamp((seen - expected) / Math.max(1, recent.length - expected), -1, 1)
}

function rememberChars(save, charIds) {
  const st = save.stream
  st.recentChars = [...charIds.filter(Boolean), ...(st.recentChars || [])].slice(0, FATIGUE_WINDOW)
}

/**
 * Hype swing from what the RESULT meant, applied after the set is broadcast.
 *
 * Quality decides how good the broadcast was; this decides whether the scene
 * is still talking about it tomorrow. All three of these are stories a real
 * room retells, and none of them were worth anything before.
 */
export function resultNotability(save, { winner, loser, winnerCharId, probA, aIsWinner }) {
  const out = { hype: 0, why: [] }
  if (!winner || !loser) return out
  const winProb = aIsWinner ? probA : 1 - probA

  // The underdog. Graded — a coin-flip upset is not a story.
  if (winProb < 0.4) {
    const shock = (0.4 - winProb) / 0.4 // 0..1
    out.hype += 2 + shock * 6
    if (shock > 0.5) out.why.push('a genuine upset')
  }

  // Somebody winning on a character the community has written off.
  const tier = perceivedTier(save, winnerCharId)
  if (tier === 'C' || tier === 'D') {
    out.hype += tier === 'D' ? 5 : 3
    out.why.push('a low tier just won')
  }

  // The draw who shouldn't have won it. This is the other half of making a
  // polarising personality worth having: people tune in for the heel, and they
  // REALLY tune in when the heel takes one off somebody better.
  const wSkill = winner.charSkill?.[winnerCharId] || 0
  const lSkill = loser.charSkill?.[loser.mainCharId] || 0
  // Key this off PERSONA itself, not off accumulated fame. personalityOf folds
  // in respect and glory, so gating on it meant the bonus only reached players
  // who were already famous — which a polarising newcomer is precisely not.
  // The heel has to be able to earn the room's attention BEFORE they have any.
  const persona = winner.social?.persona || 0
  if (persona >= 4 && wSkill < lSkill - 6) {
    out.hype += 2 + persona * 0.7 + personalityOf(winner) * 4
    out.why.push('the loud one beat the better one')
  }
  return out
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
/**
 * Does this arcade have a channel at all?
 *
 * The streaming rig is bought PER RUN and never carries over — it is the one
 * thing on the whole board you re-buy every time, because the first hundred
 * dollars of a new run going on a camera instead of a cabinet is a real
 * decision, and streaming is the single strongest lever in the game (belief,
 * popularity, followers, and the only way a champion gets forged).
 */
export const canStream = (save) => !!save?.arcade?.streamRig

export const STREAM_RIG_COST = 180

export function buildStream(save, {
  level, personality, probA, aWins, narration, meta = [], aName, bName, winnerName, context,
  mirror = false, staleness = 0,
}) {
  // No rig, no broadcast — every consumer of a stream already null-checks it,
  // so this is the whole gate.
  if (!canStream(save)) return null
  const upsetSeverity = upsetSeverityOf(probA, aWins)
  // Hidden variance: some sets just deliver, some just don't. The pre-match
  // read is never a guarantee — that's the risk in picking.
  const quality = clamp(
    matchQuality({ level, personality, probA, upset: upsetSeverity !== 'none', mirror, staleness })
      + randInt(-8, 8),
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
  // Difficulty throttles (or pads) how fast popularity comes.
  const popMult = save.settings?.mode === 'sandbox' ? 1 : difficultyOf(save).popularityMult
  const saturation = Math.max(0.05, 1 - st.followers / 20000)
  const growth = (Math.min(viewers * 0.05, 25) * saturation
    + (quality > 55 ? 2 : quality > 35 ? 1 : 0)) * popMult
  // Overexposure: each daily stream builds audience fatigue (it decays every
  // night in endDay). Once you're going live constantly, a genuinely WEAK
  // stream sheds followers who tuned in expecting something worth their time.
  // A normal cadence never trips this — fatigue only bites past a couple of
  // streams stacked up — and a good match always nets growth, so the play is
  // still to stream OFTEN, just not to broadcast garbage on a loop.
  let churn = 0
  if (context === 'daily') {
    st.fatigue = (st.fatigue || 0) + 1
    const overexposed = Math.max(0, st.fatigue - 2)
    const weakness = clamp((50 - quality) / 40, 0, 1)
    churn = overexposed * weakness * 3
  }
  st.followers = Math.max(0, st.followers + Math.round(growth - churn))
  // Hand-picked daily streams move the needle most — that's the curation
  // game. Tournament coverage grinds slowly; EVO is always a boost. Growth
  // has diminishing returns as the channel gets big.
  let gain = context === 'evo' ? 3 + quality / 50
    : context === 'tournament' ? (quality - 45) / 55
    : (quality - 32) / 14
  if (gain > 0) gain *= (1 - st.hype / 120) * popMult
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
  if (!canStream(save)) return null
  // What they actually BROUGHT, not what they main — a counterpick or a lab
  // character is what the audience saw.
  const aChar = matchEvent.charAId || a.mainCharId
  const bChar = matchEvent.charBId || b.mainCharId
  const level = ((a.charSkill[aChar] || 0) + (b.charSkill[bChar] || 0)) / 200
  const personality = (personalityOf(a) + personalityOf(b)) / 2
  const aWins = matchEvent.winnerId === a.id
  const stream = buildStream(save, {
    level,
    personality,
    probA: matchEvent.probA,
    aWins,
    narration: matchEvent.narration,
    meta: matchEvent.narrationMeta || [],
    aName: matchEvent.aName,
    bName: matchEvent.bName,
    winnerName: matchEvent.winnerName,
    context,
    mirror: !!aChar && aChar === bChar,
    staleness: stalenessOf(save, [aChar, bChar]),
  })
  rememberChars(save, [aChar, bChar])
  // What the result MEANT, as distinct from how good the broadcast was. An
  // upset, a low tier winning, or the loud one taking down the better player
  // is what the scene is still talking about tomorrow.
  const note = resultNotability(save, {
    winner: aWins ? a : b,
    loser: aWins ? b : a,
    winnerCharId: aWins ? aChar : bChar,
    probA: matchEvent.probA,
    aIsWinner: aWins,
  })
  if (note.hype > 0) {
    save.stream.hype = clamp(save.stream.hype + note.hype, 0, 100)
    stream.notability = note
  }
  // Getting your set picked for the channel is a genuine thrill — the two
  // featured players get a mood lift, bigger when the broadcast actually
  // pulls a crowd.
  const lift = 0.4 + Math.min(0.6, (stream.viewers || 0) / 200)
  a.mood = clamp(a.mood + lift, 0, 10)
  b.mood = clamp(b.mood + lift, 0, 10)
  // ...and, more importantly, they get stage reps: belief, popularity, passion.
  applyStageReps(save, [a, b], stream, context, 1, {
    probA: matchEvent.probA,
    aWins: matchEvent.winnerId === a.id,
    target: matchEvent.ftTarget,
    loserGames: matchEvent.setLoserGames,
  })
  return stream
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
