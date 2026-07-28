// How much tournament a single arcade can actually run.
//
// A bracket is not free. It is a night the setups belong to the bracket, a
// staff shift, a floor that gets trashed, and a room full of people who then
// go home. Before this the schedule was unbounded, so the strictly best play
// was to book a 32-player double-elim every single week — which is not a
// scene, it is a treadmill nobody could physically run.
//
// Bandwidth is that limit made explicit and put on screen at world creation,
// where the decision belongs. It is measured in MATCHES PER MONTH, because
// that is the thing that actually costs you: a round robin is expensive not
// because it is prestigious but because twenty-eight sets take all day.

import { isUnlocked } from './achievements.js'

/** Sets a single running of this event has to get through. */
export function eventMatches(entry) {
  const size = Math.max(2, entry.size || 8)
  if (entry.type === 'teams') {
    // Fewer entrants, but a crew battle is several sets deep per round.
    return (size - 1) * 3
  }
  switch (entry.format || 'single') {
    case 'doubleelim': return size * 2 - 2
    case 'roundrobin': return (size * (size - 1)) / 2
    default: return size - 1
  }
}

/** How many times a month this event runs. */
export function runsPerMonth(entry) {
  switch (entry.cadence || 'weekly') {
    case 'weekly': return 4
    case 'monthly': return 1
    case 'yearly': return 1 / 12
    default: return 4
  }
}

/** What one scheduled event costs, in matches per month. */
export const eventLoad = (entry) => Math.round(eventMatches(entry) * runsPerMonth(entry) * 10) / 10

/** What the whole calendar costs. */
export const scheduleLoad = (save) =>
  Math.round((save.arcade?.schedule || []).reduce((n, e) => n + eventLoad(e), 0) * 10) / 10

/**
 * The opening allowance: a weekly 8-player single-elim (7 × 4 = 28) plus a
 * monthly 16-player (15 × 1 = 15), with a couple of matches of headroom so
 * that exact pair of events doesn't sit at a nervous 100%.
 */
export const BASE_BANDWIDTH = 45

/**
 * Earned capacity, in the order it can be earned.
 *
 * Sized so the top of the ladder buys a real flagship calendar and not much
 * more: at 150 you can run a weekly 16-player double-elim (120) with a monthly
 * major beside it, or three mid-sized events, and nothing beyond that. A fully
 * earned lineage should feel like it runs a circuit, not a factory.
 */
export const BANDWIDTH_TIERS = [
  { unlock: 'bandwidth-1', amount: 25 },
  { unlock: 'bandwidth-2', amount: 25 },
  { unlock: 'bandwidth-3', amount: 55 },
]

export const bandwidthCap = (save) =>
  BASE_BANDWIDTH + BANDWIDTH_TIERS.reduce((n, t) => n + (isUnlocked(save, t.unlock) ? t.amount : 0), 0)

export const bandwidthLeft = (save) => Math.round((bandwidthCap(save) - scheduleLoad(save)) * 10) / 10

/** Would adding (or resizing to) this event fit? `ignoreId` skips the entry being edited. */
export function fitsBandwidth(save, entry, ignoreId = null) {
  const others = (save.arcade?.schedule || [])
    .filter((e) => e.id !== ignoreId)
    .reduce((n, e) => n + eventLoad(e), 0)
  return others + eventLoad(entry) <= bandwidthCap(save)
}

/**
 * What a night of bracket does to the room.
 *
 * Scaled by the size of the event, because thirty people through the door for
 * six hours is a different mess from eight people for one. This is the quiet
 * reason a packed calendar needs staff: the schedule you can technically
 * afford in bandwidth can still bury you in cleaning.
 */
export const tournamentMess = (entry) => Math.min(30, 3 + eventMatches(entry) * 0.35)
