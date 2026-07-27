import { absDayOf } from './constants.js'
import { chronicle } from './model.js'

/**
 * The permanent ladder: what a lineage keeps when a run ends.
 *
 * Two rules decide this whole list.
 *
 * The first is that an unlock is EARNED, never bought. Everything here is a
 * tool that makes the arcade easier to run, and a tool you can buy is a tool
 * the struggling owner never gets — the same trap the helpers setting exists
 * to avoid, one tier up. So the currency is proof.
 *
 * The second is what the proof is FOR. Typically it is doing the thing without
 * the tool: you run a full season an hour at a time and idle mode is the
 * reward; you keep a poisonous room together with nothing but matchmaking and
 * the discipline screen is the reward. That ordering is deliberate — the tool
 * arrives with the understanding of what it is for already in place, and a
 * shortcut you have earned the long way round reads as relief instead of as
 * the way the game is meant to be played.
 *
 * Every unlock also pays creation points, because a lineage that has proved
 * all this should be able to build better people, not just click fewer times.
 * The whole ladder is worth 23 — deliberately about what RUNG_ALLOWANCE pays,
 * so the two legacy tracks are peers rather than one swamping the other. Read
 * against a Normal creation budget of FIVE, not against some hundred-point
 * pool: a payout of 4 here would be most of a build. (Phase 7 recalibrates
 * this against everything else; these are first numbers, not settled ones.)
 *
 * PHASE 4 SCOPE: this file is the ledger and the award loop. Nothing consults
 * `unlocks` to gate a feature yet — that is Phase 5, where the catalogue is
 * priced. Until then every tool stays available and the ladder just records
 * what you have shown you can do.
 */
export const ACHIEVEMENTS = [
  {
    key: 'hand-cranked',
    icon: '🕐',
    name: 'Hand-cranked',
    unlock: 'idle',
    unlockLabel: 'Idle mode — the arcade runs while you watch',
    points: 1,
    how: 'Reach day 84 without ever switching on idle mode.',
    check: (s, absDay) => absDay >= 84 && !s.tally?.usedIdle,
  },
  {
    key: 'full-card',
    icon: '📼',
    name: 'Ran the whole card',
    unlock: 'vods',
    unlockLabel: 'The VODs tab — every bracket, rewatchable',
    points: 1,
    how: 'Run twelve tournaments to a finish.',
    check: (s) => (s.hallOfFame || []).length >= 12,
  },
  {
    key: 'own-eyes',
    icon: '📊',
    name: 'Read it yourself',
    unlock: 'tiers',
    unlockLabel: 'The community tier list',
    points: 2,
    // A tier list is a borrowed opinion. A scene that writes its own guides has
    // formed a real one — and somebody had to put the reps in to write each.
    how: 'Have your scene write three character guides of its own.',
    check: (s) => (s.guides || []).length >= 3,
  },
  {
    key: 'word-of-mouth',
    icon: '📱',
    name: 'Word of mouth',
    unlock: 'feed',
    unlockLabel: 'The Feed — what the internet is saying',
    points: 1,
    how: 'Reach 400 followers.',
    check: (s) => (s.stream?.followers || 0) >= 400,
  },
  {
    key: 'as-shipped',
    icon: '📦',
    name: 'As shipped',
    unlock: 'studio',
    unlockLabel: 'The Game Studio — patch your own game',
    points: 2,
    how: 'Reach the end of Year 1 having never released a patch.',
    check: (s, absDay) => absDay >= 168 && s.game.version === '1.0',
  },
  {
    key: 'short-order',
    icon: '🍿',
    name: 'Short order',
    unlock: 'foodpacks',
    unlockLabel: 'Food packs — five more things to stock',
    points: 1,
    how: 'Sell 200 servings across a single run.',
    check: (s) => (s.tally?.foodSold || 0) >= 200,
  },
  {
    key: 'full-house',
    icon: '🎪',
    name: 'Full house',
    unlock: 'arcadepacks',
    unlockLabel: 'Attraction packs — pinball, bowling, VR and the rest',
    points: 2,
    how: 'Draw 24 people through the door in one night.',
    check: (s) => (s.peakAttendance || 0) >= 24,
  },
  {
    key: 'kept-the-peace',
    icon: '🕊',
    name: 'Kept the peace',
    unlock: 'discipline',
    unlockLabel: 'Separating and banning players',
    points: 3,
    // The purest form of the rule: the room got genuinely poisonous and you
    // brought it back with matchmaking, staffing and a clean floor alone.
    how: 'Let the room turn toxic and bring it back — without one warning, separation or ban.',
    check: (s) => (s.tally?.peakToxicity || 0) >= 0.3
      && (s.scene?.toxicity ?? 1) <= 0.12
      && !s.tally?.usedDiscipline,
  },
  {
    key: 'first-time-right',
    icon: '🎯',
    name: 'Right the first time',
    unlock: 'hotfix',
    unlockLabel: 'Hotfixes — small corrections without a full patch',
    points: 2,
    how: 'Land a patch the community genuinely loves.',
    check: (s) => (s.tally?.bestReception || 0) >= 14,
  },
  {
    key: 'solo-shift',
    icon: '🧹',
    name: 'Solo shift',
    unlock: 'family',
    unlockLabel: 'The family business — staff who never quit and never bill you',
    points: 3,
    how: 'Sixty days running the floor alone and finishing every one of them up.',
    check: (s) => (s.tally?.soloBlackDays || 0) >= 60,
  },
  {
    key: 'world-champion',
    icon: '👑',
    name: 'World champion',
    unlock: 'points',
    unlockLabel: 'A permanently larger creation allowance',
    points: 3,
    how: 'Send a player of yours to EVO and have them win it.',
    check: (s) => Object.values(s.players).some((p) => !p.npc && (p.evoTitles || 0) >= 1),
  },
  {
    key: 'handbills',
    icon: '📄',
    name: 'Handbills and hearsay',
    unlock: 'ads',
    unlockLabel: 'The rest of the advertising channels',
    points: 2,
    how: 'Get a year in with 24 regulars, having never paid for advertising.',
    check: (s, absDay) => !s.tally?.usedAds && absDay >= 168
      && Object.values(s.players).filter((p) => p.isRegular && !p.retired && !p.banished).length >= 24,
  },
]

/** Has this lineage earned it? (Reads the permanent record, not the run.) */
export const hasAchievement = (save, key) => !!save?.prestige?.achievements?.[key]

/**
 * Is a tool available to this lineage?
 *
 * Phase 5 will call this at every gate. It answers `true` for anything not in
 * the catalogue on purpose: a feature nobody has decided to lock is not locked.
 */
export const isUnlocked = (save, unlockKey) => {
  if (!ACHIEVEMENTS.some((a) => a.unlock === unlockKey)) return true
  return !!save?.prestige?.unlocks?.[unlockKey]
}

/**
 * Award anything newly proved. Called once a day from endDay.
 *
 * Points land in `prestige.points` immediately rather than in the run's
 * pending pot: an achievement is a lineage fact the moment it happens, and
 * banking it at reset would mean losing it to a run that ends badly — which is
 * exactly the run that most needed the encouragement.
 *
 * Sandbox runs record nothing. The whole ladder is a claim about a scene that
 * had something at stake.
 */
export function checkAchievements(save) {
  if (!save || save.settings?.mode === 'sandbox') return []
  save.prestige.achievements ??= {}
  save.prestige.unlocks ??= {}
  const absDay = absDayOf(save.day, save.year)
  const earned = []
  for (const a of ACHIEVEMENTS) {
    if (save.prestige.achievements[a.key]) continue
    let ok = false
    try { ok = !!a.check(save, absDay) } catch { ok = false }
    if (!ok) continue
    save.prestige.achievements[a.key] = { day: save.day, year: save.year, run: (save.prestige.runs || 0) + 1 }
    save.prestige.unlocks[a.unlock] = true
    save.prestige.points = (save.prestige.points || 0) + a.points
    chronicle(save, a.icon, `${a.name} — ${a.unlockLabel} is yours for good (+${a.points} creation point${a.points === 1 ? '' : 's'})`)
    earned.push(a)
  }
  return earned
}
