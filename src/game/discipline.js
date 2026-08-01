// The one nuclear option. Warnings and separations went to the deprecation
// lane with the revision (docs/DEPRECATED.md §4): all three levers touch room
// chemistry now, so punishment as a system is gone — but you can still ask
// someone to leave. Rare, painful, always available — and, since P3, PRICED:
// it costs reputation, it costs you with everyone who liked them, and they
// may resurface elsewhere and beat you (tournament.js draws banished ex-cast
// into pot-funded fields as returnee outsiders).

import { clamp, displayName } from './util.js'
import { chronicle } from './model.js'
import { getRel, shiftRel } from './social.js'
import { bumpPassion } from './career.js'
import { writeJournal } from './journal.js'

export function banish(save, player, events) {
  if (player.banished) return
  if (save.tally) save.tally.usedDiscipline = true
  player.banished = true
  player.banishedDay = save.day
  player.banishedYear = save.year
  const name = displayName(player, save)
  // Vacate their team seat, like a retirement.
  if (player.teamId && save.teams[player.teamId]) {
    const team = save.teams[player.teamId]
    team.memberIds = team.memberIds.filter((id) => id !== player.id)
    player.teamId = null
  }

  // THE PRICE (REVISION §0.6). Word gets out that this arcade bans people —
  // the wider conversation cools a little...
  save.relevance = clamp((save.relevance ?? 55) - 2.5, 0, 100)
  // ...and everyone who liked them takes it personally. A room does not
  // forget watching a friend get walked out, whatever they did.
  for (const other of Object.values(save.players)) {
    if (other.id === player.id || other.retired || other.banished || !other.isRegular) continue
    const rel = getRel(other, player)
    if (rel >= 30) {
      other.mood = clamp(other.mood - 1.5, 0, 10)
      bumpPassion(other, -5)
      writeJournal(save, other, 'friendBanished', { opp: player.alias || player.firstName })
    }
  }

  // CUTTING OUT THE SOURCE BREAKS WHAT THEY BUILT (metric 9).
  //
  // Banishment used to remove a person and leave every grudge they had spread
  // exactly where it was — so the room stayed split over an argument whose
  // author had left, and toxicity recovered at ~0% no matter when you acted.
  // Grudges carry provenance now (social.js spreadFeuds): a recruited grudge
  // remembers WHO talked them into it. Remove that person and most of it goes
  // with them, because nobody can quite remember what they were defending.
  //
  // This is the whole shape of the cliff. EARLY, nearly every grudge in the
  // room traces to one person, so cutting them out genuinely fixes it. LATE,
  // the recruits have started feuds of their own, those second-generation
  // grudges name the RECRUIT as their origin, and removing the original
  // author leaves a room still full of quarrels that are now nobody's to
  // withdraw. Fixable if caught early, hopeless past a point — earned.
  let healed = 0
  for (const other of Object.values(save.players)) {
    if (other.id === player.id || other.retired || other.banished) continue
    const origins = other.feudOrigin
    if (!origins) continue
    for (const [targetId, sourceId] of Object.entries(origins)) {
      if (sourceId !== player.id) continue
      const target = save.players[targetId]
      delete origins[targetId]
      if (!target || target.retired || target.banished) continue
      // Most of the way back, not all of it — you don't un-say things.
      shiftRel(other, target, 55)
      shiftRel(target, other, 35)
      healed += 1
    }
  }
  if (healed > 0) {
    chronicle(save, '🕊', `With ${name} gone, a few people who had stopped speaking started again. Whatever that was about, it left with them.`)
  }

  if (events) events.push({ type: 'staff', text: `🚫 ${name} has been banned from ${save.arcade.name}. The room is quieter — for better or worse.` })
  chronicle(save, '🚫', `${name} was banned from ${save.arcade.name}`)
}
