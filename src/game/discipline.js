// The one nuclear option. Warnings and separations went to the deprecation
// lane with the revision (docs/DEPRECATED.md §4): all three levers touch room
// chemistry now, so punishment as a system is gone — but you can still ask
// someone to leave. Rare, painful, always available. P3 gives it its real
// consequences: it costs reputation, it costs you with everyone who liked
// them, and they may resurface elsewhere and beat you.

import { displayName } from './util.js'
import { chronicle } from './model.js'

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
  if (events) events.push({ type: 'staff', text: `🚫 ${name} has been banned from ${save.arcade.name}. The room is quieter — for better or worse.` })
  chronicle(save, '🚫', `${name} was banned from ${save.arcade.name}`)
}
