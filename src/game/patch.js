// The patch system: the Game Studio edits a DRAFT of the game; releasing a
// patch commits it, generates patch notes from the real diff, and the
// community reacts — to balance, to content, to boredom, and to cadence.

import { uid, clamp, hash01, displayName } from './util.js'
import { getMatchup, chronicle } from './model.js'
import { bumpPassion } from './career.js'
import { applyPatchRelevance, franchiseFatigue, gameAgeYears } from './relevance.js'
import { DAYS_PER_YEAR, absDayOf, dateOfAbs, formatDay, difficultyOf } from './constants.js'
import { postPatchReaction, postPatchAnnouncement } from './socialmedia.js'
import { computeMatchups, observedPower } from './balance.js'

// A character's power level: average matchup win% against the rest of the cast.
export function charPower(game, charId) {
  const others = game.characters.filter((c) => c.id !== charId)
  if (!others.length) return 50
  return others.reduce((s, o) => s + getMatchup(game, charId, o.id), 0) / others.length
}

// ---------- Community demands ----------
// What the community is LOUDLY asking for — the thing you have to read the feed
// to gauge. Most demands are legit (an actually-overpowered character everyone
// wants nerfed, a struggling one they want buffed). But some are TRAPS: a
// perfectly fine character the mob has decided is broken (usually because a
// strong PLAYER mains them). Caving on a trap is a lose/lose — you please the
// crowd today and break the balance tomorrow.
export function communityDemands(save) {
  const out = []
  for (const c of save.game.characters) {
    const power = observedPower(save, save.game, c)
    if (power >= 58) out.push({ charId: c.id, name: c.name, kind: 'nerf', legit: true, heat: 40 + (power - 58) * 4 })
    else if (power <= 43) out.push({ charId: c.id, name: c.name, kind: 'buff', legit: true, heat: 30 + (43 - power) * 3 })
  }
  // A trap: a mid-tier character the mob has irrationally decided is busted —
  // usually because a dominant player carries them. Nerfing them would be a
  // mistake, but the pressure to "do something" is real.
  const mids = save.game.characters.filter((c) => { const p = observedPower(save, save.game, c); return p >= 47 && p < 56 })
  if (mids.length) {
    const c = mids[Math.floor(hash01(`${save.game.version}:trapdemand`) * mids.length)]
    const topMain = Object.values(save.players)
      .filter((p) => p.isRegular && !p.retired && !p.banished && p.mainCharId === c.id)
      .sort((a, b) => b.elo - a.elo)[0]
    if (topMain && topMain.elo > 1380) {
      out.push({ charId: c.id, name: c.name, kind: 'nerf', legit: false, heat: 55, blame: displayName(topMain, save) })
    }
  }
  return out.sort((a, b) => b.heat - a.heat)
}

// How the loudest demands shift a patch's reception: giving people the (legit)
// change they begged for lands well; ignoring a screaming legit demand stings;
// caving to a trap wins the day but plants a time bomb (the character will be
// broken and its mains will be back demanding a buff next cycle).
export function demandAdjustment(oldGame, draft, demands) {
  let delta = 0
  const why = []
  for (const d of demands) {
    const moved = charPower(draft, d.charId) - charPower(oldGame, d.charId)
    const addressed = d.kind === 'nerf' ? moved < -2 : moved > 2
    if (addressed && d.legit) { delta += 8; why.push(`gave the people the ${d.name} ${d.kind} they'd begged for`) }
    else if (addressed && !d.legit) { delta += 4; why.push(`caved on the ${d.name} ${d.kind} — the mob cheered (for now)`) }
    else if (d.legit && d.heat >= 50) { delta -= 6; why.push(`ignored the ${d.name} ${d.kind} everyone's been screaming for`) }
  }
  return { delta: clamp(delta, -18, 18), why }
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
    stageAdds: stageAdds.length,
    overpowered, boring,
    // OP characters the patch actually fixed.
    fixedOp: oldGame.characters.filter((c) => newChars.has(c.id) &&
      powerOf(oldGame, c) > 58 && powerOf(draft, newChars.get(c.id)) <= 56),
    // Characters who were ALREADY strong and got buffed anyway — the single
    // fastest way to set the boards on fire.
    buffedStrong: buffed.filter(({ char }) => {
      const old = oldChars.get(char.id)
      return old && powerOf(oldGame, old) > 54
    }),
  }
}

export function receptionLabel(score) {
  if (score >= 15) return 'beloved'
  if (score >= 5) return 'well received'
  if (score > -5) return 'mixed'
  if (score > -15) return 'poorly received'
  return 'despised'
}

/**
 * `bias` shifts the whole community's disposition (difficulty knob:
 * a forgiving crowd on easy, an unpleasable one on master).
 *
 * The score nets out, but positives and negatives are tracked separately —
 * a patch with loud reasons to love it AND loud reasons to riot doesn't
 * read as "mixed", it reads as CONTROVERSIAL.
 */
export function computeReception(diff, daysSince, anticipationDays = 0, bias = 0) {
  let score = 0
  let pos = 0
  let neg = 0
  const why = []
  const add = (delta, reason) => {
    score += delta
    if (delta > 0) pos += delta
    else neg -= delta
    if (reason) why.push(reason)
  }
  // A dated announcement gives the community something to count down to.
  if (anticipationDays >= 3) {
    add(Math.min(8, 3 + anticipationDays * 0.4), 'the countdown had everyone refreshing the patch notes')
  }
  const content = Math.min(30, diff.added.length * 12 + diff.stageAdds * 4 + diff.moveChanges * 2)
  if (content > 0) add(content, 'fresh content')
  if (diff.fixedOp.length) add(diff.fixedOp.length * 8, `finally addressed ${diff.fixedOp.map((c) => c.name).join(', ')}`)
  if (diff.buffedStrong?.length) {
    add(-diff.buffedStrong.length * 12,
      `${diff.buffedStrong.map((b) => b.char.name).join(', ')} was ALREADY strong — and the patch made them stronger?!`)
  }
  if (diff.overpowered.length) add(-diff.overpowered.length * 12, `${diff.overpowered.map((c) => c.name).join(', ')} looks busted`)
  if (diff.boring) add(-15, 'every matchup is a 50-50 — the meta is a bowl of plain rice')
  if (diff.removed.length) add(-diff.removed.length * 8, `${diff.removed.map((c) => c.name).join(', ')} mains are in mourning`)
  if (!diff.notes.length) add(-5, 'the patch notes say... nothing?')
  if (daysSince < 14) add(-12, 'patch fatigue — the meta never gets to breathe')
  else if (daysSince > 120) add(10, 'long-awaited')
  else if (daysSince > 60) add(5)
  score = clamp(score + bias, -40, 40)
  const divisive = pos >= 12 && neg >= 12
  return { score, label: divisive ? 'controversial' : receptionLabel(score), why, divisive }
}

/**
 * How much you can TRUST the Studio's forecast. Early on your read of the
 * community is sharp; years deep, a jaded fanbase is genuinely unpredictable and
 * the forecast can be flat wrong. Returns a seeded ± offset (stable per draft
 * state) plus the uncertainty band for the UI. Applied to the DISPLAYED forecast
 * only — the actual reception at release is the real thing.
 */
export function forecastNoise(save, seed) {
  const uncertainty = clamp(gameAgeYears(save) * 5.5, 0, 24)
  const offset = (hash01(`${save.game.version}:${seed}:forecast`) - 0.5) * 2 * uncertainty
  return { offset, uncertainty: Math.round(uncertainty) }
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
  const consequentialRun = save.settings.mode !== 'sandbox'
  // A jaded, years-old community is harder to please — franchise fatigue makes
  // late patches genuinely tougher to land, which is what makes them a gamble.
  const bias = consequentialRun ? difficultyOf(save).receptionBias - franchiseFatigue(save) : 0
  const base = computeReception(diff, daysSince, anticipationDays, bias)
  // Did the patch answer (or ignore, or fall for) what the community was
  // loudly demanding? This is why reading the feed matters.
  const dem = consequentialRun ? demandAdjustment(save.game, save.gameDraft, communityDemands(save)) : { delta: 0, why: [] }
  const score = clamp(base.score + dem.delta, -40, 40)
  const why = [...base.why, ...dem.why]
  const divisive = base.divisive
  const label = receptionLabel(score)
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
    divisive,
  }
  save.patches.unshift(patch)

  const consequential = consequentialRun
  if (consequential) {
    save.patchMorale = clamp(score / 4, -10, 10)
    save.stream.hype = clamp(save.stream.hype + score / 10, 0, 100)
    // Controversy is still engagement — everyone tunes in to argue.
    if (divisive) save.stream.hype = clamp(save.stream.hype + 3, 0, 100)
    // Fresh content is a shot of life for a scene grinding the same build for
    // months — it rekindles passion (and keeps veterans from burning out).
    const contentRefresh = clamp(diff.added.length * 5 + diff.stageAdds * 2 + diff.moveChanges * 0.6, 0, 12)
    for (const p of Object.values(save.players)) {
      if (!p.isRegular || p.retired || p.banished) continue
      p.mood = clamp(p.mood + clamp(score / 30, -1.5, 1.5), 0, 10)
      bumpPassion(p, contentRefresh)
      // Your main getting gutted is personal.
      if (diff.nerfed.some((n) => n.char.id === p.mainCharId)) { p.mood = clamp(p.mood - 1, 0, 10); bumpPassion(p, -4) }
      if (diff.buffed.some((b) => b.char.id === p.mainCharId)) { p.mood = clamp(p.mood + 0.7, 0, 10); bumpPassion(p, 6) }
      if (diff.removed.some((c) => c.id === p.mainCharId)) {
        p.mood = clamp(p.mood - 2, 0, 10)
        bumpPassion(p, -12) // your whole character, gone — some never come back
        p.mainCharId = null
        p.settledMain = false // back to the lab to find a new main
      }
    }
  }

  // The gamble: a patch is a huge relevance event. Its swing scales with how
  // fragile the game already is — a hit revives a fading scene, a miss buries
  // it. This is where late-game patching becomes genuinely dangerous.
  if (consequentialRun) {
    const relDelta = applyPatchRelevance(save, score, divisive)
    patch.relevanceDelta = relDelta
    if (relDelta <= -6) {
      chronicle(save, '📉', `Patch v${version} did real damage — interest in ${save.game.name} took a hit the scene may not recover from`)
    } else if (relDelta >= 6) {
      chronicle(save, '📈', `Patch v${version} landed — ${save.game.name} is back in the conversation`)
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
