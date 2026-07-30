// Player careers: passion, burnout, and retirement. A player's passion is how
// much they still LOVE the game. It starts high and erodes with years of
// dedication — you can only grind one fighting game for so long. Wins, fresh
// content, and a lively scene top it back up; a stale game and quiet losses
// drain it. When it runs dry, they retire, opening a slot for the next
// generation. This is the engine of the late-game: veterans you cultivated for
// years start walking away, and you have to keep them engaged or replace them.

import { clamp, chance, displayName } from './util.js'
import { statLevel } from './constants.js'
import { chronicle, remember } from './model.js'
import { writeJournal, isJournaled } from './journal.js'
import { pushToast } from './notify.js'

export const PASSION_MAX = 100

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
    bumpPassion(player, (0.18 + (player.mood - 5) * 0.05) * novelty)
    if (ctx.wonToday) bumpPassion(player, 0.5 * novelty)
  }
}

/**
 * Once passion runs out, a veteran hangs it up for good. Newbies and casuals
 * don't "retire" — they just haven't caught the bug yet. Retirement frees
 * their roster slot and their team seat, and the greats get a send-off in the
 * chronicle. Returns true if they retired.
 */
export function checkRetirement(save, player, events) {
  if (player.retired || !player.isRegular) return false
  const passion = player.passion ?? 80
  if (passion >= 16 || (player.daysAttended || 0) < 90) return false
  if (!chance(clamp((16 - passion) * 0.02, 0.02, 0.4))) return false

  player.retired = true
  player.retiredDay = save.day
  player.retiredYear = save.year
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
  // held. The toast is for the owner; the entry is for the player.
  writeJournal(save, player, 'retire', { days: player.daysAttended, wins: player.wins, always: true })
  if (isJournaled(player)) {
    pushToast(save, {
      icon: '🏁',
      text: `${name} retired. Their journal's last page is written.`,
      see: { screen: 'players' },
      sticky: true,
    })
  }

  const glorious = (player.glory || 0) >= 40
  events.push({
    type: 'retirement',
    text: `🏁 ${name} is hanging it up — after ${player.daysAttended} nights and ${player.wins}–${player.losses}, the fire's gone out. ${glorious ? 'A legend of the scene steps away.' : 'One more regular moves on with life.'}`,
  })
  chronicle(save, '🏁', glorious
    ? `${name} retired — an all-time great of ${save.arcade.name}, walking away on their own terms`
    : `${name} quietly retired from the game after ${player.daysAttended} nights`)
  if (glorious) remember(save, player, 'retire', `retiring as a legend of ${save.arcade.name}`)
  return true
}

// Is this player active in the scene right now (not retired)?
export const isActive = (p) => !p.retired && !p.banished

// Passion's pull on turnout: a burnt-out player barely shows, a fired-up one
// never misses. A multiplier on attendance.
export function passionAttendanceFactor(player) {
  return clamp(0.5 + (player.passion ?? 80) / 160, 0.5, 1.05)
}
