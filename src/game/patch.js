// The patch system: the Game Studio edits a DRAFT of the game; releasing a
// patch commits it, generates patch notes from the real diff, and the
// community reacts — to balance, to content, to boredom, and to cadence.

import { uid, clamp } from './util.js'
import { getMatchup, chronicle } from './model.js'
import { DAYS_PER_YEAR, absDayOf, dateOfAbs, formatDay } from './constants.js'
import { postPatchReaction, postPatchAnnouncement } from './socialmedia.js'
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

// ---------- Exhaustive diff helpers ----------
// Patch notes list EVERYTHING — the community reads every line.

const MOVE_STATS = [
  ['damage', 'damage', (v) => `${v}`],
  ['chip', 'chip', (v) => `${v}`],
  ['startup', 'startup', (v) => `${v}f`],
  ['active', 'active', (v) => `${v}f`],
  ['recovery', 'recovery', (v) => `${v}f`],
  ['onBlock', 'on block', (v) => (v > 0 ? `+${v}` : `${v}`)],
  ['meterCost', 'meter cost', (v) => `${v}`],
  ['duration', 'duration', (v) => `${v}s`],
]

function moveDiffClauses(oldM, newM) {
  const clauses = []
  if (oldM.name !== newM.name) clauses.push(`renamed to ${newM.name}`)
  if (oldM.type !== newM.type) clauses.push(`type ${oldM.type} → ${newM.type}`)
  if ((oldM.slot || 'special') !== (newM.slot || 'special')) clauses.push(`${oldM.slot || 'special'} → ${newM.slot || 'special'}`)
  for (const [key, label, fmt] of MOVE_STATS) {
    const a = oldM[key]
    const b = newM[key]
    if (a !== b && (a != null || b != null)) {
      clauses.push(`${label} ${a != null ? fmt(a) : '—'} → ${b != null ? fmt(b) : '—'}`)
    }
  }
  return clauses
}

const moveKey = (m) => m.id ?? `${m.name}|${m.type}` // legacy moves may lack ids
const listDiff = (oldArr = [], newArr = []) => ({
  added: newArr.filter((x) => !oldArr.includes(x)),
  removed: oldArr.filter((x) => !newArr.includes(x)),
})

/**
 * Human-readable diff between the live game and the draft, plus the raw
 * signals reception scoring needs.
 */
/**
 * observer(game, a, b) -> matchup value. Defaults to the truth; the Studio
 * forecast passes observed (noisy) data instead, so a forecast made on a
 * fresh build can miss an overpowered character — or invent one.
 */
export function diffGame(oldGame, draft, observer = null) {
  // Matchups are computed FROM the designs — refresh both sides so power
  // deltas reflect the actual frame-data changes.
  computeMatchups(oldGame)
  computeMatchups(draft)
  const powerOf = (game, char) => {
    const others = game.characters.filter((c) => c.id !== char.id)
    if (!others.length) return 50
    if (!observer) return charPower(game, char.id)
    return others.reduce((s, o) => s + observer(game, char, o), 0) / others.length
  }
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

    // Character-sheet changes, however small.
    if (old.name !== c.name) notes.push(`${old.name} is now called ${c.name}`)
    if (old.archetype !== c.archetype) notes.push(`${c.name} reworked: archetype ${old.archetype} → ${c.archetype}`)
    if (c.difficulty !== old.difficulty) notes.push(`${c.name}: difficulty ${old.difficulty} → ${c.difficulty}`)
    if (c.popularity !== old.popularity) notes.push(`${c.name}: star power ${old.popularity} → ${c.popularity}`)
    if ((old.spriteKey || null) !== (c.spriteKey || null)) notes.push(`${c.name}: updated character art`)
    if ((old.description || '') !== (c.description || '')) notes.push(`${c.name}: bio updated`)
    const tagDiff = listDiff(old.tags, c.tags)
    if (tagDiff.added.length) notes.push(`${c.name} tagged: ${tagDiff.added.join(', ')}`)
    if (tagDiff.removed.length) notes.push(`${c.name} untagged: ${tagDiff.removed.join(', ')}`)

    // Moves: additions, removals, and every stat tweak in between.
    const oldMoves = new Map(old.moves.map((m) => [moveKey(m), m]))
    const newMoves = new Map(c.moves.map((m) => [moveKey(m), m]))
    for (const [key, m] of newMoves) {
      const om = oldMoves.get(key)
      if (!om) { moveChanges++; notes.push(`${c.name} gains ${m.name} (${m.type})`); continue }
      const clauses = moveDiffClauses(om, m)
      if (clauses.length) { moveChanges++; notes.push(`${c.name} — ${om.name}: ${clauses.join(', ')}`) }
    }
    for (const [key, m] of oldMoves) {
      if (!newMoves.has(key)) { moveChanges++; notes.push(`${c.name} loses ${m.name}`) }
    }

    // Combo routes count too — labs notice everything.
    const oldCombos = new Map((old.combos || []).map((x) => [x.id, x]))
    const newCombos = new Map((c.combos || []).map((x) => [x.id, x]))
    for (const [id, combo] of newCombos) {
      const oc = oldCombos.get(id)
      if (!oc) { notes.push(`${c.name}: new combo route — ${combo.name}`); continue }
      const renamed = oc.name !== combo.name
      const rerouted = (oc.moveIds || []).join() !== (combo.moveIds || []).join()
      if (renamed && rerouted) notes.push(`${c.name} — ${oc.name}: renamed to ${combo.name}, route adjusted`)
      else if (renamed) notes.push(`${c.name} — ${oc.name}: renamed to ${combo.name}`)
      else if (rerouted) notes.push(`${c.name} — ${combo.name}: route adjusted`)
    }
    for (const [id, combo] of oldCombos) {
      if (!newCombos.has(id)) notes.push(`${c.name}: combo removed — ${combo.name}`)
    }
  }

  // Stages: adds, removals, and every cosmetic touch.
  const oldStageMap = new Map(oldGame.stages.map((s) => [s.id, s]))
  const newStageMap = new Map(draft.stages.map((s) => [s.id, s]))
  const stageAdds = draft.stages.filter((s) => !oldStageMap.has(s.id))
  for (const s of stageAdds) notes.push(`NEW STAGE: ${s.name}`)
  for (const s of oldGame.stages) {
    if (!newStageMap.has(s.id)) notes.push(`Removed stage: ${s.name}`)
  }
  for (const s of draft.stages) {
    const old = oldStageMap.get(s.id)
    if (!old) continue
    if (old.name !== s.name) notes.push(`${old.name} stage is now ${s.name}`)
    if ((old.vibe || 'hype') !== (s.vibe || 'hype')) notes.push(`${s.name}: stage vibe ${old.vibe || 'hype'} → ${s.vibe}`)
    if ((old.bgKey || null) !== (s.bgKey || null)) notes.push(`${s.name}: new stage backdrop`)
    if ((old.description || '') !== (s.description || '')) notes.push(`${s.name}: stage description updated`)
  }

  // Techniques: adds, removals, retunes.
  const oldTechMap = new Map(oldGame.techniques.map((t) => [t.id, t]))
  const newTechMap = new Map(draft.techniques.map((t) => [t.id, t]))
  const techAdds = draft.techniques.filter((t) => !oldTechMap.has(t.id))
  for (const t of techAdds) notes.push(`New technique to discover: ${t.name}`)
  for (const t of oldGame.techniques) {
    if (!newTechMap.has(t.id)) notes.push(`Removed technique: ${t.name}`)
  }
  const techCharName = (game, id) => (id ? game.characters.find((c) => c.id === id)?.name || '???' : 'universal')
  for (const t of draft.techniques) {
    const old = oldTechMap.get(t.id)
    if (!old) continue
    const clauses = []
    if (old.name !== t.name) clauses.push(`renamed to ${t.name}`)
    if (old.difficulty !== t.difficulty) clauses.push(`difficulty ${old.difficulty} → ${t.difficulty}`)
    if (old.xp !== t.xp) clauses.push(`xp ${old.xp} → ${t.xp}`)
    if ((old.charId || null) !== (t.charId || null)) clauses.push(`now ${techCharName(draft, t.charId)}`)
    if ((old.description || '') !== (t.description || '')) clauses.push('description updated')
    if (clauses.length) notes.push(`Technique ${old.name}: ${clauses.join(', ')}`)
  }

  // Tag pools.
  const charTagDiff = listDiff(oldGame.tags, draft.tags)
  for (const t of charTagDiff.added) notes.push(`New character tag: "${t}"`)
  for (const t of charTagDiff.removed) notes.push(`Retired character tag: "${t}"`)
  const playerTagDiff = listDiff(oldGame.playerTags, draft.playerTags)
  for (const t of playerTagDiff.added) notes.push(`New player vibe tag: "${t}"`)
  for (const t of playerTagDiff.removed) notes.push(`Retired player vibe tag: "${t}"`)

  // Balance-health read on the DRAFT — through the observer's eyes, which
  // may be squinting at thin data.
  const overpowered = draft.characters.filter((c) => powerOf(draft, c) > 58)
  let flatPairs = 0
  let totalPairs = 0
  for (let i = 0; i < draft.characters.length; i++) {
    for (let j = i + 1; j < draft.characters.length; j++) {
      totalPairs++
      const mu = observer
        ? observer(draft, draft.characters[i], draft.characters[j])
        : getMatchup(draft, draft.characters[i].id, draft.characters[j].id)
      if (Math.abs(mu - 50) <= 2) flatPairs++
    }
  }
  const boring = totalPairs >= 6 && flatPairs / totalPairs > 0.85

  return {
    notes, added, removed, buffed, nerfed, moveChanges,
    stageAdds: stageAdds.length, techAdds: techAdds.length,
    overpowered, boring,
    // OP characters the patch actually fixed.
    fixedOp: oldGame.characters.filter((c) => newChars.has(c.id) &&
      powerOf(oldGame, c) > 58 && powerOf(draft, newChars.get(c.id)) <= 56),
  }
}

function receptionLabel(score) {
  if (score >= 15) return 'beloved'
  if (score >= 5) return 'well received'
  if (score > -5) return 'mixed'
  if (score > -15) return 'poorly received'
  return 'despised'
}

export function computeReception(diff, daysSince, anticipationDays = 0) {
  let score = 0
  const why = []
  // A dated announcement gives the community something to count down to.
  if (anticipationDays >= 3) {
    score += Math.min(8, 3 + anticipationDays * 0.4)
    why.push('the countdown had everyone refreshing the patch notes')
  }
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
  // Days the community spent counting down to an announced date.
  const anticipationDays = save.scheduledPatch
    ? clamp(absDayOf(save.day, save.year) - save.scheduledPatch.announcedAbs, 0, 28)
    : 0
  const { score, label, why } = computeReception(diff, daysSince, anticipationDays)
  const version = bumpVersion(save.game.version)
  save.gameDraft.version = version
  save.game = save.gameDraft
  computeMatchups(save.game) // the new designs are now the live truth
  save.gameDraft = null
  save.scheduledPatch = null // the date is met (or preempted by an early ship)
  save.lastPatch = { day: save.day, year: save.year }
  save.patchGames = 0 // fresh build, no data — the reports start blurry again

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
  // The community needs about a week of games before the tier list drops.
  save.pendingTierList = {
    version,
    dueAbs: (save.year - 1) * DAYS_PER_YEAR + save.day + 5 + Math.floor(Math.random() * 5),
  }
  return patch
}

/**
 * Announce a release date instead of shipping now. The community starts
 * counting down (feed posts fire as the day approaches) and startDay ships
 * whatever the draft looks like when the date arrives.
 */
export function schedulePatch(save, daysAhead) {
  if (!save.gameDraft) return null
  const todayAbs = absDayOf(save.day, save.year)
  const absDay = todayAbs + Math.max(1, Math.round(daysAhead))
  const version = bumpVersion(save.game.version)
  save.scheduledPatch = { absDay, version, announcedAbs: todayAbs }
  const when = dateOfAbs(absDay)
  chronicle(save, '📅', `${save.game.name} v${version} announced for ${formatDay(when.day, when.year)}`)
  postPatchAnnouncement(save, version, formatDay(when.day, when.year), absDay - todayAbs)
  return save.scheduledPatch
}

export function cancelScheduledPatch(save) {
  save.scheduledPatch = null
}

export function scheduledPatchDaysLeft(save) {
  if (!save.scheduledPatch) return null
  return save.scheduledPatch.absDay - absDayOf(save.day, save.year)
}
