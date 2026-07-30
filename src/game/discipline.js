// The one nuclear option. Warnings and separations went to the deprecation
// lane with the revision (docs/DEPRECATED.md §4): all three levers touch room
// chemistry now, so punishment as a system is gone — but you can still ask
// someone to leave. Rare, painful, always available — and, since P3, PRICED:
// it costs reputation, it costs you with everyone who liked them, and they
// may resurface elsewhere and beat you (tournament.js draws banished ex-cast
// into pot-funded fields as returnee outsiders).

import { clamp, displayName } from './util.js'
import { chronicle } from './model.js'
import { getRel } from './social.js'
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

  if (events) events.push({ type: 'staff', text: `🚫 ${name} has been banned from ${save.arcade.name}. The room is quieter — for better or worse.` })
  chronicle(save, '🚫', `${name} was banned from ${save.arcade.name}`)
}
