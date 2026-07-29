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

// ---------- Audiences: who a room actually brings through the door ----------
//
// AN ATTRACTION IS A CROWD YOU DO NOT HAVE YET, or it is furniture.
//
// Every pack names an `audience`. The first pack that serves one opens a door
// nobody was walking through before — families, the after-work crowd, people
// who came for a birthday. A SECOND pack aimed at the same people is mostly
// just more rent: the old heads already came for the classics wall, and the
// pinball tables give them somewhere else to stand rather than bringing anyone
// new. That is the decision this system exists to make real, and it is why
// `attr-classics` and `attr-pinball` deliberately share an audience.
//
// The counterweight is `footprint` — lanes and courts are floor space, and the
// landlord charges for floor space whether or not it was a clever buy.

/** Packs with at least one item installed, and how much of each is in. */
export function installedPacks(save) {
  const installed = new Set(save?.arcade?.otherGames || [])
  const out = []
  for (const pack of ATTRACTION_PACKS) {
    const have = pack.items.filter((i) => installed.has(i)).length
    if (have) out.push({ pack, have, share: have / pack.items.length })
  }
  return out
}

/**
 * Total draw weight per audience, with duplicates heavily discounted.
 *
 * The strongest pack in an audience counts fully; anything else aimed at the
 * same people counts a quarter. Partly-installed packs scale by how much of
 * the room is actually built — two of four pin tables is not a pinball hall.
 */
export function audienceMix(save) {
  const byAudience = new Map()
  for (const { pack, share } of installedPacks(save)) {
    const weight = (pack.pull ?? 1) * share
    const list = byAudience.get(pack.audience) || []
    list.push(weight)
    byAudience.set(pack.audience, list)
  }
  const mix = new Map()
  for (const [audience, weights] of byAudience) {
    weights.sort((a, b) => b - a)
    mix.set(audience, weights[0] + weights.slice(1).reduce((n, w) => n + w * 0.25, 0))
  }
  return mix
}

/** Monthly rent for the SPACE every installed attraction occupies. */
export function attractionFootprint(save) {
  let rent = 0
  for (const { pack, share } of installedPacks(save)) rent += (pack.footprint ?? 20) * share
  // Ordinary side cabinets are not attractions and still pay the old per-unit
  // charge — they are a machine against a wall, not a room.
  const plain = (save?.arcade?.otherGames || []).filter((g) => !isAttraction(g)).length
  return Math.round(rent + plain * 15)
}

/**
 * How much bigger the crowd is because of what you have installed, 1.0–~1.5.
 *
 * This is the REASON to buy a room, and it is why the audience matters more
 * than the number of rooms: three packs aimed at three crowds beat five packs
 * aimed at one.
 */
export function attractionDrawFactor(save) {
  let sum = 0
  for (const weight of audienceMix(save).values()) sum += weight
  return 1 + Math.min(sum, 4.5) * 0.1
}

/**
 * Income scales the same way. A room serving people who were already here is
 * still a room — it just is not a NEW room's worth of takings.
 */
export function attractionIncome(save) {
  let weighted = 0
  for (const weight of audienceMix(save).values()) weighted += weight
  if (!weighted) return 0
  return Math.round(weighted * ATTRACTION_DRAW * 1.6 * arcadePopularity(save) * 100) / 100
}
