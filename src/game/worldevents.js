// The world outside the arcade — the exogenous shocks that make every run its
// own story. Roughly once a month-and-a-half something happens TO you: a rival
// game launches and eats your oxygen, a clip goes viral, the landlord smells
// opportunity, a touring pro drops in. None of it is deserved and none of it is
// fair; the game is in how you play the hand. Bad luck leans harder on higher
// difficulties, good luck on easier ones.

import { clamp, chance, choice, rand, randInt } from './util.js'
import { absDayOf, difficultyOf } from './constants.js'
import { chronicle } from './model.js'
import { econLog } from './economy.js'
import { bumpPassion } from './career.js'
import { canStream, addHype, addFollowers } from './stream.js'
import { line as chronicleLine } from '../content/index.js'

// Weighted deck. `bad` decides which way the difficulty thumb presses the
// scale. Durations are absolute-day windows stored on save.worldEffects and
// read by whoever owns the number (relevance reads decayMult, rent reads
// rentMult) — the event system itself stays dumb.
const EVENTS = [
  {
    key: 'rival_launch', bad: true, weight: 3,
    run(save, abs) {
      save.worldEffects.push({ key: 'rival_launch', untilAbs: abs + 55, decayMult: 1.55 })
      chronicle(save, '🎮', chronicleLine('worldevent.newFighter', { game: save.game.name }))
    },
  },
  {
    key: 'rent_hike', bad: true, weight: 2,
    run(save, abs) {
      save.worldEffects.push({ key: 'rent_hike', untilAbs: abs + 84, rentMult: 1.3 })
      chronicle(save, '🏢', chronicleLine('worldevent.rentHike'))
    },
  },
  {
    key: 'cabinet_fault', bad: true, weight: 2,
    run(save) {
      const cost = randInt(80, 160)
      econLog(save, -cost, 'emergency cabinet repair')
      chronicle(save, '🔌', chronicleLine('worldevent.powerSurge', { cost }))
    },
  },
  {
    // Needs a camera. A clip cannot go viral off an arcade that isn't
    // broadcasting, so this one is dealt out of the deck entirely rather than
    // firing and quietly doing nothing — see `when` in maybeWorldEvent.
    // `when` is wrapped rather than passed as `canStream` directly: this array
    // is built at module-evaluation time and stream.js is upstream of a cycle
    // through economy/model, so the bare reference is still in its temporal
    // dead zone here. Vite's bundle happened to tolerate it; Node ESM did not.
    key: 'viral_clip', bad: false, weight: 3, when: (save) => canStream(save),
    run(save) {
      const gain = randInt(7, 13)
      save.relevance = clamp((save.relevance ?? 55) + gain, 0, 100)
      const newFollowers = Math.round((save.stream.followers || 0) * (0.06 + rand() * 0.08)) + randInt(10, 40)
      const got = addFollowers(save, newFollowers)
      addHype(save, 6)
      chronicle(save, '📈', chronicleLine('worldevent.viralClip', { got }))
    },
  },
  {
    key: 'pro_visit', bad: false, weight: 2,
    run(save) {
      const actives = Object.values(save.players).filter((p) => p.isRegular && !p.retired && !p.banished)
      for (const p of actives) {
        bumpPassion(p, 6)
        if (chance(0.4)) p.belief = clamp((p.belief ?? 0) + 2, 0, 100)
      }
      // The room buzzes either way; the CHANNEL only gains if there is one.
      addHype(save, 5)
      chronicle(save, '✈️', chronicleLine('worldevent.touringPro'))
    },
  },
  {
    key: 'press_feature', bad: false, weight: 2,
    run(save) {
      save.relevance = clamp((save.relevance ?? 55) + randInt(4, 8), 0, 100)
      addHype(save, 10)
      chronicle(save, '📰', chronicleLine('worldevent.pressFeature', { arcade: save.arcade.name }))
    },
  },
]

/**
 * Roll the world's dice for the day. Called once per day from advanceDay; keeps
 * a minimum gap so events feel like events, not weather. Difficulty tilts the
 * good/bad mix — the whole deck, not each card, is what's fair or unfair.
 */
export function maybeWorldEvent(save) {
  if (save.settings.mode === 'sandbox') return
  const abs = absDayOf(save.day, save.year)
  save.worldEffects ??= []
  // Sweep expired effects so the list never grows unbounded.
  save.worldEffects = save.worldEffects.filter((fx) => fx.untilAbs > abs)
  if (abs - (save.lastWorldEventAbs || 0) < 24) return
  if (abs < 40) return // the opening weeks are the player's own story
  if (!chance(0.033)) return // ~one event every ~30 eligible days

  // Difficulty presses on the scale: hard runs live in a hostile world.
  const diff = difficultyOf(save)
  const badTilt = { easy: 0.6, normal: 1, difficult: 1.3, master: 1.6 }[diff.key] ?? 1
  const deck = []
  for (const ev of EVENTS) {
    const w = ev.weight * (ev.bad ? badTilt : 1 / badTilt)
    for (let i = 0; i < Math.max(1, Math.round(w * 2)); i++) deck.push(ev)
  }
  const ev = choice(deck.filter((e) => !e.when || e.when(save)))
  if (!ev) return
  // Don't stack the same lingering effect on itself.
  if (save.worldEffects.some((fx) => fx.key === ev.key)) return
  ev.run(save, abs)
  save.lastWorldEventAbs = abs
}

// The rent reader — active hikes multiply the landlord's bill.
export function worldRentMult(save) {
  const abs = absDayOf(save.day, save.year)
  let mult = 1
  for (const fx of save.worldEffects || []) {
    if (fx.untilAbs > abs && fx.rentMult) mult *= fx.rentMult
  }
  return mult
}
