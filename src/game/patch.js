// The patch system: the Game Studio edits a DRAFT of the game; releasing a
// patch commits it, generates patch notes from the real diff, and the
// community reacts — to balance, to content, to boredom, and to cadence.

import { uid, clamp } from './util.js'
import { getMatchup, chronicle } from './model.js'
import { DAYS_PER_YEAR } from './constants.js'
import { postPatchReaction } from './socialmedia.js'
import { computeMatchups } from './balance.js'

// A character's power level: average matchup win% against the rest of the cast.
export function charPower(game, charId) {
  const others = game.characters.filter((c) => c.id !== charId)
  if (!others.length) return 50
  return others.reduce((s, o) => s + getMatchup(game, charId, o.id), 0) / others.length
}

export function daysSincePatch(save) {
  return (save.year - save.lastPatch.year) * DAYS_PER_YEAR + (save.day - save.lastPatch.day)
}

export function bumpVersion(version) {
  const [major, minor] = String(version).split('.').map((n) => parseInt(n, 10) || 0)
  return `${major}.${minor + 1}`
}

/**
 * Human-readable diff between the live game and the draft, plus the raw
 * signals reception scoring needs.
 */
export function diffGame(oldGame, draft) {
  // Matchups are computed FROM the designs — refresh both sides so power
  // deltas reflect the actual frame-data changes.
  computeMatchups(oldGame)
  computeMatchups(draft)
  const notes = []
  const oldChars = new Map(oldGame.characters.map((c) => [c.id, c]))
  const newChars = new Map(draft.characters.map((c) => [c.id, c]))

  const added = draft.characters.filter((c) => !oldChars.has(c.id))
  const removed = oldGame.characters.filter((c) => !newChars.has(c.id))
  for (const c of added) notes.push(`NEW CHARACTER: ${c.name} (${c.archetype})`)
  for (const c of removed) notes.push(`Removed ${c.name} from the roster`)

  const buffed = []
  const nerfed = []
  let moveChanges = 0
  for (const c of draft.characters) {
    const old = oldChars.get(c.id)
    if (!old) continue
    const dPow = charPower(draft, c.id) - charPower(oldGame, c.id)
    if (dPow >= 1.5) { buffed.push({ char: c, delta: dPow }); notes.push(`Buffed ${c.name} (+${dPow.toFixed(1)} avg matchup)`) }
    else if (dPow <= -1.5) { nerfed.push({ char: c, delta: dPow }); notes.push(`Nerfed ${c.name} (${dPow.toFixed(1)} avg matchup)`) }
    if (c.difficulty !== old.difficulty) notes.push(`${c.name} reworked: difficulty ${old.difficulty} → ${c.difficulty}`)
    const oldMoves = new Set(old.moves.map((m) => m.name + m.type))
    const newMoves = new Set(c.moves.map((m) => m.name + m.type))
    const addedMoves = c.moves.filter((m) => !oldMoves.has(m.name + m.type))
    const removedMoves = old.moves.filter((m) => !newMoves.has(m.name + m.type))
    for (const m of addedMoves) { moveChanges++; notes.push(`${c.name} gains ${m.name} (${m.type})`) }
    for (const m of removedMoves) { moveChanges++; notes.push(`${c.name} loses ${m.name}`) }
  }

  const oldStages = new Set(oldGame.stages.map((s) => s.id))
  const stageAdds = draft.stages.filter((s) => !oldStages.has(s.id))
  for (const s of stageAdds) notes.push(`NEW STAGE: ${s.name}`)
  const oldTechs = new Set(oldGame.techniques.map((t) => t.id))
  const techAdds = draft.techniques.filter((t) => !oldTechs.has(t.id))
  for (const t of techAdds) notes.push(`New technique to discover: ${t.name}`)

  // Balance-health read on the DRAFT.
  const overpowered = draft.characters.filter((c) => charPower(draft, c.id) > 58)
  let flatPairs = 0
  let totalPairs = 0
  for (let i = 0; i < draft.characters.length; i++) {
    for (let j = i + 1; j < draft.characters.length; j++) {
      totalPairs++
      if (Math.abs(getMatchup(draft, draft.characters[i].id, draft.characters[j].id) - 50) <= 2) flatPairs++
    }
  }
  const boring = totalPairs >= 6 && flatPairs / totalPairs > 0.85

  return {
    notes, added, removed, buffed, nerfed, moveChanges,
    stageAdds: stageAdds.length, techAdds: techAdds.length,
    overpowered, boring,
    // OP characters the patch actually fixed.
    fixedOp: oldGame.characters.filter((c) => newChars.has(c.id) &&
      charPower(oldGame, c.id) > 58 && charPower(draft, c.id) <= 56),
  }
}

function receptionLabel(score) {
  if (score >= 15) return 'beloved'
  if (score >= 5) return 'well received'
  if (score > -5) return 'mixed'
  if (score > -15) return 'poorly received'
  return 'despised'
}

export function computeReception(diff, daysSince) {
  let score = 0
  const why = []
  const content = Math.min(30, diff.added.length * 12 + diff.stageAdds * 4 + diff.techAdds * 3 + diff.moveChanges * 2)
  if (content > 0) { score += content; why.push('fresh content') }
  if (diff.fixedOp.length) { score += diff.fixedOp.length * 8; why.push(`finally addressed ${diff.fixedOp.map((c) => c.name).join(', ')}`) }
  if (diff.overpowered.length) { score -= diff.overpowered.length * 12; why.push(`${diff.overpowered.map((c) => c.name).join(', ')} looks busted`) }
  if (diff.boring) { score -= 15; why.push('every matchup is a 50-50 — the meta is a bowl of plain rice') }
  if (diff.removed.length) { score -= diff.removed.length * 8; why.push(`${diff.removed.map((c) => c.name).join(', ')} mains are in mourning`) }
  if (!diff.notes.length) { score -= 5; why.push('the patch notes say... nothing?') }
  if (daysSince < 14) { score -= 12; why.push('patch fatigue — the meta never gets to breathe') }
  else if (daysSince > 120) { score += 10; why.push('long-awaited') }
  else if (daysSince > 60) { score += 5 }
  score = clamp(score, -40, 40)
  return { score, label: receptionLabel(score), why }
}

/**
 * Commit the draft as a new patch. Returns the patch record.
 * Consequential mode: the community reaction has teeth (morale, moods,
 * hype). Sandbox: the reaction is recorded but changes nothing.
 */
export function releasePatch(save) {
  if (!save.gameDraft) return null
  const diff = diffGame(save.game, save.gameDraft)
  const daysSince = daysSincePatch(save)
  const { score, label, why } = computeReception(diff, daysSince)
  const version = bumpVersion(save.game.version)
  save.gameDraft.version = version
  save.game = save.gameDraft
  computeMatchups(save.game) // the new designs are now the live truth
  save.gameDraft = null
  save.lastPatch = { day: save.day, year: save.year }

  const patch = {
    id: uid('patch'),
    version,
    day: save.day,
    year: save.year,
    notes: diff.notes.length ? diff.notes : ['Minor under-the-hood adjustments.'],
    score,
    reception: label,
    why,
  }
  save.patches.unshift(patch)

  const consequential = save.settings.mode !== 'sandbox'
  if (consequential) {
    save.patchMorale = clamp(score / 4, -10, 10)
    save.stream.hype = clamp(save.stream.hype + score / 10, 0, 100)
    for (const p of Object.values(save.players)) {
      if (!p.isRegular) continue
      p.mood = clamp(p.mood + clamp(score / 30, -1.5, 1.5), 0, 10)
      // Your main getting gutted is personal.
      if (diff.nerfed.some((n) => n.char.id === p.mainCharId)) p.mood = clamp(p.mood - 1, 0, 10)
      if (diff.buffed.some((b) => b.char.id === p.mainCharId)) p.mood = clamp(p.mood + 0.7, 0, 10)
      if (diff.removed.some((c) => c.id === p.mainCharId)) {
        p.mood = clamp(p.mood - 2, 0, 10)
        p.mainCharId = null
        p.settledMain = false // back to the lab to find a new main
      }
    }
  }

  chronicle(save, '🛠', `Patch v${version} released — ${label}${why.length ? ` (${why[0]})` : ''}`)
  postPatchReaction(save, patch)
  return patch
}
