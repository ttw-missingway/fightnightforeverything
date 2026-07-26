// SKINS: the same character wearing a different face.
//
// A skin is NOT a character. It's `{ id, name, spriteKey }` living on the
// character it belongs to, and that shape is the whole design: a skin cannot
// reach the matchup table, the tier list, `charPower`, the balance report or
// anyone's pocket picks, because every one of those walks `game.characters`
// and a skin was never in it. There is no filter to remember and none to
// forget. (Contrast forms, which ARE characters and therefore need
// `selectableChars` applied everywhere by hand — see forms.js.)
//
// THE SPLIT THAT MATTERS:
//
//   Wear the skin — when you are looking at a PERSON playing the character.
//                   Their main in the leaderboard, their fighter on the match
//                   screen: that's Jade's Ryu, and Jade plays the red one.
//
//   Use the base  — when you are looking at the CHARACTER, or when anyone
//                   TALKS about it. Tier lists, matchup charts, the codex,
//                   patch notes, takes, rumours, the feed. The discourse is
//                   about Ryu; it is never about somebody's particular Ryu.
//
// Getting that backwards is what makes a cosmetic system feel like a bug: a
// tier list with four entries for the same character, or a player complaining
// that "Crimson Ryu" is overtuned when no such character exists.

import { uid, hash01 } from './util.js'

export function newSkin(partial = {}) {
  return {
    id: uid('skin'),
    name: 'New Skin',
    spriteKey: null, // null = fall back to the base character's sprite
    ...partial,
  }
}

export function skinsOf(char) {
  return char?.skins || []
}

/**
 * Which skin this player wears on this character, or null for the base look.
 *
 * Derived, not stored. It's a stable per-player taste in exactly the way
 * `charAppeal`'s "vibes" term is, so it needs no save state, no migration, and
 * no assignment step when a character gains a skin months into a run.
 *
 * The base look competes as an option: with three skins a quarter of the room
 * still wears the original, which is what keeps a roster from looking like
 * everyone opted out of the default.
 *
 * RENDEZVOUS HASHING, not `hash % skins.length`. Modulo would reshuffle every
 * player's look the moment the list got longer — add a fourth skin and the
 * whole scene changes clothes. Scoring each option independently and taking
 * the winner means a new skin only pulls over the players whose score for it
 * happens to beat what they already wear.
 */
export function preferredSkin(playerId, char) {
  const skins = skinsOf(char)
  if (!skins.length || playerId == null || !char?.id) return null
  let best = null
  let bestScore = hash01(`${playerId}:${char.id}:skin:base`)
  for (const s of skins) {
    const score = hash01(`${playerId}:${char.id}:skin:${s.id}`)
    if (score > bestScore) { bestScore = score; best = s }
  }
  return best
}

/**
 * How `playerId` looks playing `char`: the name to print and the sprite key to
 * draw. Call this anywhere a PERSON is shown with their character. Pass a null
 * playerId (or a character with no skins) and you get the base look back, so
 * it's safe to use as a drop-in for `char.name` / `char.spriteKey`.
 */
export function lookOf(playerId, char) {
  const skin = preferredSkin(playerId, char)
  return {
    skin,
    name: skin?.name || char?.name || '???',
    spriteKey: skin?.spriteKey ?? char?.spriteKey ?? null,
    // The character underneath, for anything that needs the real identity —
    // archetype, matchups, or simply saying who this actually is.
    char: char || null,
  }
}

/** Fresh ids for a cloned character's skins, so a duplicate shares none. */
export function reskinFresh(char) {
  for (const s of char?.skins || []) s.id = uid('skin')
  return char
}
