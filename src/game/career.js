// Player careers: passion, burnout, and retirement. A player's passion is how
// much they still LOVE the game. It starts high and erodes with years of
// dedication — you can only grind one fighting game for so long. Wins, fresh
// content, and a lively scene top it back up; a stale game and quiet losses
// drain it. When it runs dry, they retire, opening a slot for the next
// generation. This is the engine of the late-game: veterans you cultivated for
// years start walking away, and you have to keep them engaged or replace them.

import { clamp, chance, displayName, rand, randInt } from './util.js'
import { statLevel } from './constants.js'
import { chronicle, remember } from './model.js'
import { writeJournal, isJournaled } from './journal.js'
import { pushToast } from './notify.js'

export const PASSION_MAX = 100

// ---------- AGE (P5) — the clock nobody argues with ----------
//
// Passion is the burnout arc: it answers "do they still want this?" and it can
// be topped back up by a good night. Age answers a different question — "can
// they still do it?" — and nothing tops it back up. That is what makes it the
// engine of Act 3: a room can be perfectly run, beloved and solvent, and still
// need a next generation, because the one you built is getting older whatever
// you do.
//
// The two clocks must not collapse into one. If age simply drained passion,
// metric 5 (retirement dispersion) would spike — everyone leaving in the same
// narrow band — and the bulk-exodus bug the metric exists to catch would be
// back wearing a hat. So age carries its OWN retirement pressure, and every
// person rolls their own peak and their own ending: some are done at 28, some
// are still turning up at 41, and the room can't tell you which in advance.

/** Where a fresh arcade regular is in life. School and college kids, mostly. */
export const rollAge = () => (chance(0.62) ? randInt(16, 22) : randInt(23, 31))

/**
 * The two ages that decide a career's shape, rolled per person so the cohort
 * never moves as a block:
 *  · `peakAge`  — when execution stops improving with time and starts eroding
 *  · `hangUpAge`— roughly when this person, specifically, is done
 * The spread on hangUpAge is deliberately wide (a decade) because that spread
 * IS metric 5.
 */
export function rollCareerClock() {
  const peakAge = randInt(25, 31)
  return { peakAge, hangUpAge: peakAge + randInt(4, 14) }
}

/** How far past their peak they are, in years (0 while still climbing). */
export const yearsPastPeak = (p) => Math.max(0, (p.age ?? 22) - (p.peakAge ?? 28))

/**
 * Execution decay: past the peak, the hands go before the head. Applied to
 * charSkill yearly — small, compounding, and never below a floor, because a
 * veteran does not become a beginner. They become someone whose reads are
 * better than their hands, which is exactly the person who should be writing
 * guides and coaching (veteran-tier eureka, §1.9).
 */
export const DECLINE_FLOOR = 0.55 // of their peak skill; below this, age stops taking

export function ageDeclineFor(p) {
  const past = yearsPastPeak(p)
  if (past <= 0) return 0
  // Gentle at first — the year after your peak is barely a year — then real.
  return Math.min(0.045, 0.004 * past)
}

/**
 * Where they are in a career, in words. Drives the legibility half of the
 * task: retirement must stop being a surprise. This is what the player card
 * reads out, and it is deliberately vague about the number — a room can tell
 * that someone is past it without knowing their birthday.
 */
export function careerStageOf(p) {
  const age = p.age ?? 22
  const past = yearsPastPeak(p)
  if (age <= 19) return { key: 'kid', label: 'a kid', blurb: 'Years of runway. Everything is still ahead of them.' }
  if (past <= 0) return { key: 'rising', label: 'rising', blurb: 'Still climbing. The best is genuinely still coming.' }
  if (past <= 2) return { key: 'peak', label: 'at their peak', blurb: 'Right at the top of what they have. Make it count.' }
  if (past <= 5) return { key: 'veteran', label: 'a veteran', blurb: 'The hands have slowed a step. The reads have not.' }
  if (past <= 9) return { key: 'late', label: 'late career', blurb: 'Running on craft now. Every season is a decision.' }
  return { key: 'twilight', label: 'in their twilight', blurb: 'Nobody would blame them for stopping. They keep showing up.' }
}

export function passionLabel(v) {
  if (v >= 78) return 'obsessed'
  if (v >= 55) return 'invested'
  if (v >= 35) return 'going through the motions'
  if (v >= 18) return 'burning out'
  return 'ready to walk away'
}

export function bumpPassion(player, delta) {
  if (player.retired) return
  player.passion = clamp((player.passion ?? 80) + delta, 0, PASSION_MAX)
}

/**
 * One day of passion drift for a regular. Tenure accelerates burnout (the
 * grind wears on the dedicated most), mastery adds to it (the mountain's been
 * climbed), and a game left to stagnate bores everyone. Loyalty resists it.
 * Showing up and — especially — winning tops it back up a little.
 *
 * ctx: { attendedToday, wonToday, staleDays }
 */
/**
 * How much a good thing still lands, 0.22–1.15.
 *
 * Everything that rekindles passion runs through this. A first night at the
 * arcade is electric; the thousandth is a Tuesday. Burnout in this game is not
 * bad things happening — it is good things stopping working, which is both
 * truer and the only way a veteran ever actually leaves.
 */
export const noveltyOf = (player) =>
  clamp(1.15 - (player.daysAttended || 0) / 480, 0.22, 1.15)

export function passionDaily(save, player, ctx) {
  if (player.retired || !player.isRegular) return
  const tenure = player.daysAttended || 0
  const skill = Math.max(0, ...Object.values(player.charSkill || {}), 0)

  // Tenure is the engine of the whole late game, and it was far too weak: over
  // two years, everything that ADDS passion totalled 14,231 against 2,693 taken
  // away — five to one — so every regular simply pinned at the cap and nobody
  // in the game had ever retired. A long-serving veteran now loses ground even
  // on a good week, which is what burnout is.
  let decay = 0.05 + Math.max(0, tenure - 90) * 0.0016
  if (skill >= 88) decay += 0.05 // fully mastered — less left to chase
  const stale = ctx.staleDays || 0
  if (stale > 90) decay += Math.min(0.12, (stale - 90) * 0.0007) // no fresh content wears thin
  // A scene the world has moved on from drains the will to keep grinding.
  const rel = save.relevance ?? 55
  if (rel < 35) decay += (35 - rel) * 0.004
  // A toxic, hateful scene is exhausting — it burns people out faster.
  decay += (save.scene?.toxicity || 0) * 0.09
  decay *= clamp(1.3 - statLevel(player.personal.loyalty) * 0.06, 0.5, 1.3)
  bumpPassion(player, -decay)

  if (ctx.attendedToday) {
    // NOVELTY FADES. A good night at the arcade rekindles a newcomer and barely
    // touches somebody on their thousandth. Without this the refresher (+0.18 a
    // visit) simply outran the decay (0.05 a day) for anyone attending more
    // than a third of the time — measured over two years, average passion sat
    // at 99 and NOBODY in the game ever retired. The whole burnout arc was off.
    const novelty = noveltyOf(player)
    // CHECKED OUT (metric 9). Measured: inject a star at passion 10 — deep
    // inside the retirement zone — leave it completely alone, and 112 days
    // later they are back at 40. The crisis cured itself, which is why
    // metric 9's burnout curve reads ~0.83 recovery at every lag: the
    // counterplay was never the thing doing the work.
    //
    // The fix is the file's own thesis, applied to the state it describes:
    // "burnout is not bad things happening — it is good things stopping
    // working." That is modelled for TENURE (noveltyOf) but not for burnout
    // itself, so somebody already checked out still got the full lift from a
    // good night. Now the lift fades as passion falls, which makes burnout
    // STICKY without making it terminal: they can still be pulled out, but
    // by wins, the spotlight and being backed — not by waiting.
    const engaged = clamp(0.35 + (player.passion ?? 80) / 40, 0.35, 1)
    bumpPassion(player, (0.18 + (player.mood - 5) * 0.05) * novelty * engaged)
    if (ctx.wonToday) bumpPassion(player, 0.5 * novelty * engaged)
  }
}

/**
 * A birthday for everyone in the building, run at the year rollover. Returns
 * the cast members whose bodies noticed, so the caller can say so.
 *
 * The erosion is applied to charSkill rather than to a hidden modifier because
 * the sheet is the thing the player reads and reasons about — a decline you
 * cannot see on the card is a decline you cannot plan a succession around.
 */
export function ageYearly(save) {
  const declined = []
  for (const p of Object.values(save.players)) {
    if (p.banished) continue
    p.age = (p.age ?? 22) + 1
    if (p.retired) continue
    p.peakSkill = Math.max(p.peakSkill || 0, ...Object.values(p.charSkill || {}), 0)
    const rate = ageDeclineFor(p)
    if (rate <= 0) continue
    const floor = (p.peakSkill || 0) * DECLINE_FLOOR
    let took = 0
    for (const [charId, v] of Object.entries(p.charSkill || {})) {
      if (v <= floor) continue
      const next = Math.max(floor, v * (1 - rate))
      took += v - next
      p.charSkill[charId] = next
    }
    if (took > 0.5 && !p.npc) declined.push(p)
  }
  return declined
}

/**
 * Once passion runs out — or the years do — a veteran hangs it up for good.
 * Newbies and casuals don't "retire"; they just haven't caught the bug yet.
 * Retirement frees their roster slot and their team seat, and the greats get a
 * send-off in the chronicle. Returns true if they retired.
 *
 * TWO INDEPENDENT DOORS (P5). Passion is "I don't want this any more"; age is
 * "I can't do this any more", and a person can leave through either. Keeping
 * them separate is what holds metric 5's dispersion up: the passion door fires
 * on the run's events (a bad stretch, a toxic room), the age door fires on a
 * clock that was rolled at birth, and the two never line up across a cast.
 */
export function checkRetirement(save, player, events) {
  if (player.retired || !player.isRegular) return false
  const passion = player.passion ?? 80
  const age = player.age ?? 22
  const hangUp = player.hangUpAge ?? 36
  // The age door. Opens as they reach their own ending and widens past it —
  // but never slams: someone can play on years past their hang-up age, and
  // some do. Gated on a real career so a 30-year-old who just walked in
  // doesn't retire before they have played a night.
  const overdue = age - hangUp
  const ageOdds = overdue >= 0 && (player.daysAttended || 0) >= 120
    ? clamp(0.0006 + overdue * 0.0007, 0, 0.006)
    : 0
  const passionOpen = passion < 16 && (player.daysAttended || 0) >= 90
  const passionOdds = passionOpen ? clamp((16 - passion) * 0.02, 0.02, 0.4) : 0
  if (!passionOpen && ageOdds <= 0) return false
  // Whichever door is open; if both are, the more insistent one.
  if (!chance(Math.max(passionOdds, ageOdds))) return false
  const viaAge = ageOdds > passionOdds

  player.retired = true
  player.retiredDay = save.day
  player.retiredYear = save.year
  // WHICH DOOR (P6). Metric 4 is "of the most-pushed players, who broke
  // through and who burned out" — and burning out is a specific thing, not a
  // synonym for having stopped. A career that ran its full length and aged
  // out is the system working, so the instrument has to be able to tell the
  // two apart or it just measures mortality, which over a fifteen-year run
  // is 1 by construction.
  player.retiredVia = viaAge ? 'age' : 'passion'
  const name = displayName(player, save)

  // Vacate their team seat.
  if (player.teamId && save.teams[player.teamId]) {
    const team = save.teams[player.teamId]
    team.memberIds = team.memberIds.filter((id) => id !== player.id)
    if (!team.history) team.history = []
    team.history.push({ day: save.day, year: save.year, text: `${name} retired from the game` })
    player.teamId = null
  }

  // The final entry — written before the book closes, whatever else the week
  // held. The toast is for the owner; the entry is for the player. Which door
  // they left through decides the page: burning out and ageing out are not the
  // same ending and must not read like it.
  writeJournal(save, player, viaAge ? 'retireAge' : 'retire',
    { days: player.daysAttended, wins: player.wins, age: player.age, always: true })
  if (isJournaled(player)) {
    pushToast(save, {
      icon: '🏁',
      text: `${name} retired. Their journal's last page is written.`,
      see: { screen: 'players' },
      sticky: true,
    })
  }

  // SCENES DIE IN CLUMPS (metric 9). Losing someone you came here for costs
  // you something, so one departure makes the next likelier and catching the
  // FIRST one is worth doing. Deliberately small and friends-only: metric 5
  // (retirement dispersion, currently ~1700 days) exists to catch exactly the
  // bulk-exodus bug an aggressive version of this would reintroduce.
  for (const other of Object.values(save.players)) {
    if (other.id === player.id || other.retired || other.banished || !other.isRegular) continue
    const bond = other.relationships?.[player.id] ?? 0
    if (bond < 35) continue
    bumpPassion(other, -(2 + (bond / 100) * 4))
    other.mood = clamp(other.mood - 0.5, 0, 10)
  }

  const glorious = (player.glory || 0) >= 40
  events.push({
    type: 'retirement',
    text: viaAge
      ? `🏁 ${name} is calling it — ${player.daysAttended} nights, ${player.wins}–${player.losses}, and a body that's done arguing. ${glorious ? 'A legend of the scene steps away.' : 'They got further than most.'}`
      : `🏁 ${name} is hanging it up — after ${player.daysAttended} nights and ${player.wins}–${player.losses}, the fire's gone out. ${glorious ? 'A legend of the scene steps away.' : 'One more regular moves on with life.'}`,
  })
  chronicle(save, '🏁', glorious
    ? `${name} retired — an all-time great of ${save.arcade.name}, walking away on their own terms`
    : viaAge
      ? `${name} played their last night at ${save.arcade.name} after ${player.daysAttended} of them`
      : `${name} quietly retired from the game after ${player.daysAttended} nights`)
  if (glorious) remember(save, player, 'retire', `retiring as a legend of ${save.arcade.name}`)
  return true
}

/**
 * The warning shot. Once a year, the people who are visibly running out of
 * road say so in their own journal — which is the whole legibility half of
 * the task: the owner should never be told about a succession problem by the
 * retirement notice. Returns who was warned.
 */
export function ageWarnings(save) {
  const warned = []
  for (const p of Object.values(save.players)) {
    if (p.retired || p.banished || p.npc || !p.isRegular) continue
    const stage = careerStageOf(p)
    if (stage.key !== 'late' && stage.key !== 'twilight') continue
    if (p.ageWarnedStage === stage.key) continue
    p.ageWarnedStage = stage.key
    writeJournal(save, p, stage.key === 'twilight' ? 'twilight' : 'slowingDown',
      { age: p.age, days: p.daysAttended, always: true })
    warned.push(p)
  }
  return warned
}

// Is this player active in the scene right now (not retired)?
export const isActive = (p) => !p.retired && !p.banished

// Passion's pull on turnout: a burnt-out player barely shows, a fired-up one
// never misses. A multiplier on attendance.
export function passionAttendanceFactor(player) {
  return clamp(0.5 + (player.passion ?? 80) / 160, 0.5, 1.05)
}
