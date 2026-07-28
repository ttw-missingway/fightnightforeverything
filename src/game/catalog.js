// What this arcade is allowed to stock and install, and what the attractions
// earn while they sit there.
//
// The catalogue is deliberately thin at the start of a lineage: five foods and
// the ordinary cabinets. Everything else is content a past run proved you
// deserved (see achievements.js), which is why this module reads `unlocks`
// rather than a price list — none of it can be bought.

import { STARTER_FOODS, FOOD_PACKS, STARTER_GAMES, ATTRACTION_PACKS } from './names.js'
import { isUnlocked } from './achievements.js'
import { clamp } from './util.js'

// ---------- Food ----------

export const foodPackOf = (name) => FOOD_PACKS.find((p) => p.foods.includes(name)) || null

/** Can this arcade stock it today? Starters always; pack foods once earned. */
export function foodAvailable(save, name) {
  const pack = foodPackOf(name)
  if (!pack) return true // a starter, or a legacy custom item
  return isUnlocked(save, pack.key)
}

export const availableFoods = (save) =>
  [...STARTER_FOODS, ...FOOD_PACKS.filter((p) => isUnlocked(save, p.key)).flatMap((p) => p.foods)]

export const lockedFoodPacks = (save) => FOOD_PACKS.filter((p) => !isUnlocked(save, p.key))

// ---------- The floor ----------

export const attractionPackOf = (name) => ATTRACTION_PACKS.find((p) => p.items.includes(name)) || null
export const isAttraction = (name) => !!attractionPackOf(name)

export function attractionAvailable(save, name) {
  const pack = attractionPackOf(name)
  if (!pack) return true // an ordinary cabinet
  return isUnlocked(save, pack.key)
}

export const availableAttractions = (save) =>
  [...STARTER_GAMES, ...ATTRACTION_PACKS.filter((p) => isUnlocked(save, p.key)).flatMap((p) => p.items)]

export const lockedAttractionPacks = (save) => ATTRACTION_PACKS.filter((p) => !isUnlocked(save, p.key))

/**
 * The run in which a pack is earned gets its first installation free.
 *
 * An attraction unlocked at the tail of a dying run is otherwise a trophy you
 * never get to touch — the money to install one is exactly what a run that far
 * gone doesn't have. One free room means you at least see what you won.
 */
export function claimFreeInstall(save, name) {
  const pack = attractionPackOf(name)
  if (!pack) return false
  if (!save.freeInstalls?.[pack.key]) return false
  delete save.freeInstalls[pack.key]
  return true
}

export const hasFreeInstall = (save, name) => {
  const pack = attractionPackOf(name)
  return !!(pack && save.freeInstalls?.[pack.key])
}

/**
 * How busy and how known this place is, 0.15–1.1.
 *
 * Attractions earn from the general public rather than from your roster, so
 * this is the one income in the game that doesn't ask which simulated player
 * walked over and put a token in. A quiet arcade still has to pay their upkeep,
 * which is what stops a legacy full of unlocked rooms from being free money.
 */
export function arcadePopularity(save) {
  const hist = (save.economy?.history || []).filter((h) => h.attendance != null).slice(-21)
  const att = hist.length ? hist.reduce((n, h) => n + h.attendance, 0) / hist.length : 0
  const followers = save.stream?.followers || 0
  const clean = (save.arcade?.cleanliness ?? 80) / 100
  return clamp((0.15 + att / 18 * 0.55 + Math.min(1, followers / 3000) * 0.3) * clamp(clean + 0.25, 0.5, 1), 0.15, 1.1)
}

/** What every installed attraction pulls in a day, before upkeep. */
export const ATTRACTION_DRAW = 6 // dollars per room per day at full popularity

export function attractionIncome(save) {
  const rooms = (save.arcade?.otherGames || []).filter(isAttraction).length
  if (!rooms) return 0
  return Math.round(rooms * ATTRACTION_DRAW * arcadePopularity(save) * 100) / 100
}
