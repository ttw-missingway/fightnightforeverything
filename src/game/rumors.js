// The Rumor Mill — the concession stand's read on the scene, surfaced as
// ranked gossip. Every rumor is DERIVED from live state (a player's mood and
// passion, the balance data, who's feuding), so the mill is really a diagnostic
// UI: it makes the mid-game's hidden social systems legible. If a star is
// quietly burning out, or a character is warping the room, or two friends just
// blew up — the counter is already whispering about it. Reading the mill is how
// you learn to read your players before they walk.
//
// Pure engine: no React, node-runnable like the rest of src/game/. Deterministic
// for a given save state (seeded picks, no Math.random) so the list doesn't
// reshuffle on every render — it only moves when the world does.

import { hash01, clamp, displayName } from './util.js'
import { absDayOf, statusOf } from './constants.js'
import { getRel, arcadeOpinionOf, areRivals } from './social.js'
import { observedPower } from './balance.js'

// Deterministic pick from a pool, seeded by a stable string.
function seededPick(pool, seed) {
  if (!pool.length) return null
  return pool[Math.floor(hash01(seed) * pool.length)]
}

// How many people this player counts as real friends — a proxy for how many
// take sides when they're involved in something. Bigger web, bigger drama.
function friendCount(p) {
  return Object.values(p.relationships || {}).filter((v) => v >= 20).length
}

// The regular this player is closest to (rel ≥ 40), deterministically.
function closestFriend(save, p) {
  let best = null
  let bestRel = 39
  for (const id in p.relationships || {}) {
    const other = save.players[id]
    if (!other || !other.isRegular || other.retired || other.banished) continue
    const rel = p.relationships[id]
    if (rel > bestRel || (rel === bestRel && (!best || id < best.id))) { bestRel = rel; best = other }
  }
  return best
}

// How the room ranks each rumor — a coarse heat label for the UI.
export function rumorHeatLabel(heat) {
  if (heat >= 72) return { label: 'red-hot', color: 'var(--red)' }
  if (heat >= 52) return { label: 'buzzing', color: 'var(--gold)' }
  if (heat >= 32) return { label: 'making the rounds', color: 'var(--cyan)' }
  return { label: 'idle whisper', color: 'var(--dim)' }
}

const CLOUT = { legend: 14, star: 10, veteran: 5, regular: 3, casual: 1, newbie: 0 }

// Non-fighting-game gossip, so players read as people and not stat blocks.
// Conditioned on real details (their friends, tastes, other games) where we can.
function lifeRumors(save, p, seed) {
  const nm = (x) => displayName(x, save)
  const out = [
    { text: `Rumor has it ${nm(p)} started a new job — the regulars worry it'll eat into their grind time.`, subjectIds: [p.id] },
    { text: `Word is ${nm(p)} might be moving across town. Nobody's sure they'll keep making the trip.`, subjectIds: [p.id] },
    { text: `${nm(p)} has apparently been seeing someone from outside the scene. Priorities are shifting, allegedly.`, subjectIds: [p.id] },
    { text: `${nm(p)}'s been weirdly quiet lately, and nobody can get a straight answer out of them.`, subjectIds: [p.id] },
    { text: `Somebody swears they saw ${nm(p)} at a different arcade last weekend. Just visiting, they say.`, subjectIds: [p.id] },
  ]
  const friend = closestFriend(save, p)
  if (friend) {
    out.push({ text: `${nm(p)} and ${nm(friend)} have been carpooling to every session — thick as thieves lately.`, subjectIds: [p.id, friend.id] })
  }
  if (p.foods?.length) {
    const food = p.foods[Math.floor(hash01(`${seed}:food`) * p.foods.length)]
    out.push({ text: `${nm(p)} will not stop insisting the ${food} across the street is better than ours.`, subjectIds: [p.id] })
  }
  if (p.otherGames?.length) {
    const g = p.otherGames[Math.floor(hash01(`${seed}:og`) * p.otherGames.length)]
    out.push({ text: `Supposedly ${nm(p)} has been home grinding ${g} instead of showing up.`, subjectIds: [p.id] })
  }
  return out
}

/**
 * Every rumor the current state generates, hottest first — before dismissals,
 * caps, or the display slice. `allRumors` exposes this so "clear all" can wave
 * off even the ones hidden by the per-category cap (otherwise clearing the
 * visible three rivalries would just surface the next three). Each rumor:
 *   { id, category, icon, text, heat (0-100), subjectIds }
 * `id` is stable across renders so React keys and de-dupes cleanly.
 */
export function allRumors(save) {
  const rumors = []
  const byId = save.players
  const regs = Object.values(byId).filter((p) => p.isRegular && !p.retired && !p.banished)
  const nm = (p) => displayName(p, save)
  // Life gossip rotates on a slow clock so a given player's story lingers a
  // few days rather than flickering every hour.
  const bucket = Math.floor(absDayOf(save.day, save.year) / 5)

  // 1. The money match — nothing else comes close to this on the gossip meter.
  const mm = (save.moneyMatches || []).find((m) => m.status === 'scheduled')
  if (mm) {
    const a = byId[mm.aId]
    const b = byId[mm.bId]
    if (a && b) {
      rumors.push({
        id: `mm:${mm.id}`, category: 'moneymatch', icon: '💸', heat: 92, subjectIds: [a.id, b.id],
        text: seededPick([
          `All anyone can talk about: the ${nm(a)} vs ${nm(b)} money match. Sides are already being taken.`,
          `Word is ${nm(a)} and ${nm(b)} are settling it for real — money on the line, whole arcade watching.`,
        ], `mm:${mm.id}:t`),
      })
    }
  }

  // 2. Feuds & rivalries — walk each pair once, splitting on the relationship
  // band (feuds are mutual hatred; rivalries are competitive but short of it).
  for (let i = 0; i < regs.length; i++) {
    for (let j = i + 1; j < regs.length; j++) {
      const a = regs[i]
      const b = regs[j]
      const key = a.id < b.id ? `${a.id}|${b.id}` : `${b.id}|${a.id}`
      const mutual = Math.min(getRel(a, b), getRel(b, a))
      if (mutual <= -60) {
        const web = friendCount(a) + friendCount(b)
        rumors.push({
          id: `feud:${key}`, category: 'feud', icon: '💢',
          heat: clamp(56 + (-mutual - 60) * 0.5 + web * 1.6, 42, 88),
          subjectIds: [a.id, b.id],
          text: seededPick([
            `${nm(a)} and ${nm(b)} had a nasty falling out — their friends are picking sides.`,
            `The ${nm(a)}–${nm(b)} beef has gone nuclear. Nobody wants to be caught in the middle.`,
            `Word is ${nm(a)} won't be in the same room as ${nm(b)} anymore. It's ugly.`,
          ], `feud:${key}:t`),
        })
      } else if (areRivals(save, a, b)) {
        rumors.push({
          id: `rival:${key}`, category: 'rivalry', icon: '⚔️',
          heat: clamp(40 + Math.min(18, ((a.h2h?.[b.id]?.w || 0) + (a.h2h?.[b.id]?.l || 0)) * 0.9), 40, 60),
          subjectIds: [a.id, b.id],
          text: seededPick([
            `${nm(a)} and ${nm(b)} have a real rivalry now — every set between them is must-watch.`,
            `People keep bringing up ${nm(a)} vs ${nm(b)}. Neither will let the other have the last word.`,
          ], `rival:${key}:t`),
        })
      }
    }
  }

  // 3. Busted characters — the balance read the room has already made, and who's
  // catching heat for maining them. This is the bridge to your patch decisions.
  for (const c of save.game.characters) {
    const power = observedPower(save, save.game, c)
    if (power <= 57) continue
    const mains = regs.filter((p) => p.mainCharId === c.id).sort((x, y) => y.elo - x.elo)
    const face = mains[0]
    rumors.push({
      id: `busted:${c.id}`, category: 'balance', icon: '🧨',
      heat: clamp((power - 57) * 5 + mains.length * 4, 32, 84),
      subjectIds: mains.slice(0, 4).map((p) => p.id),
      text: face
        ? seededPick([
            `Everyone's calling ${c.name} busted — ${nm(face)} and the other ${c.name} mains are catching heat for it.`,
            `The consensus at the counter: ${c.name} is broken. ${nm(face)} keeps hearing about it.`,
          ], `busted:${c.id}:t`)
        : `The room's convinced ${c.name} is busted. Whoever picks them up is going to run the place.`,
    })
  }

  // 4. Unhappy regulars — the core "read your players" signal. A quiet star
  // souring on the arcade is the single most important thing you can catch
  // early, and the mill is where it first shows up.
  for (const p of regs) {
    const opinion = arcadeOpinionOf(save, p)
    const passion = p.passion ?? 80
    const mood = p.mood ?? 5
    let discontent = 0
    let reason = 'mood'
    if (opinion < 4.2) { discontent += (4.2 - opinion) * 1.7; reason = 'arcade' }
    if (passion < 35) { const d = (35 - passion) * 0.09; if (d > discontent) reason = 'passion'; discontent += d }
    if (mood < 4) { discontent += (4 - mood) * 0.6 }
    if (discontent < 1.3) continue
    const status = statusOf(p)
    const clout = status ? CLOUT[status.key] ?? 0 : 0
    const text = reason === 'passion'
      ? seededPick([
          `Rumor has it ${nm(p)} is losing the fire — people think they might hang it up soon.`,
          `${nm(p)} keeps talking like someone on their way out. Burnout, the counter reckons.`,
        ], `unhappy:${p.id}:t`)
      : reason === 'arcade'
        ? seededPick([
            `Rumor has it ${nm(p)} isn't happy here lately — might go looking for another scene.`,
            `Word is ${nm(p)} has been grumbling about this place. Something's souring them on it.`,
          ], `unhappy:${p.id}:t`)
        : seededPick([
            `${nm(p)} has been in a bad way lately. Nobody's sure what's eating them.`,
            `People say ${nm(p)} hasn't been themselves — short with everyone, no fun to be around.`,
          ], `unhappy:${p.id}:t`)
    rumors.push({
      id: `unhappy:${p.id}`, category: 'unhappy', icon: '🚪',
      heat: clamp(32 + discontent * 4 + clout * 2.6, 26, 86),
      subjectIds: [p.id], text,
    })
  }

  // 5. The one to watch — the room's read on who's on top right now. A little
  // civic pride, and a nudge toward the players actually contending for EVO.
  if (regs.length >= 4) {
    const top = [...regs].sort((a, b) => b.elo - a.elo)[0]
    if (top && top.elo > 1300) {
      rumors.push({
        id: `topdog:${top.id}`, category: 'hype', icon: '🔥',
        heat: clamp(44 + (top.glory || 0) * 0.4, 44, 66),
        subjectIds: [top.id],
        text: seededPick([
          `The consensus is ${nm(top)} is the best in the building right now. Contenders are lining up.`,
          `Everybody's watching ${nm(top)} — if anyone's taking this scene to EVO, the smart money's on them.`,
        ], `topdog:${top.id}:t`),
      })
    }
  }

  // 6. Team drama — a crew where somebody's soured on their teammates is one
  // bad night from a walkout, and the group chat is already whispering.
  for (const team of Object.values(save.teams)) {
    const members = team.memberIds.map((id) => byId[id]).filter((p) => p && !p.retired && !p.banished)
    if (members.length < 2) continue
    let worst = null
    let worstAvg = -12
    for (const m of members) {
      const others = members.filter((x) => x.id !== m.id)
      const avg = others.reduce((s, o) => s + getRel(m, o), 0) / others.length
      if (avg < worstAvg) { worstAvg = avg; worst = m }
    }
    if (worst) {
      rumors.push({
        id: `teamdrama:${team.id}`, category: 'team', icon: '🛡',
        heat: clamp(36 + (-worstAvg), 30, 60), subjectIds: [worst.id],
        text: seededPick([
          `Word in the group chat: ${nm(worst)} and the rest of ${team.name} aren't getting along.`,
          `${team.name} might be cracking — ${nm(worst)} looks one bad night from walking.`,
        ], `teamdrama:${team.id}:t`),
      })
    }
  }

  // 7. Life gossip — a slow-rotating handful of human-interest rumors so the
  // cast feels lived-in. Low heat: they sit under the hot stuff, surfacing when
  // the scene is calm.
  for (const p of regs) {
    const seed = `${p.id}:life:${bucket}`
    if (hash01(seed) > 0.14) continue // only ~1 in 7 regulars has a life rumor at a time
    const pool = lifeRumors(save, p, seed)
    const chosen = pool[Math.floor(hash01(`${seed}:which`) * pool.length)]
    if (!chosen) continue
    rumors.push({
      id: `life:${p.id}:${bucket}`, category: 'life', icon: '🗞',
      heat: clamp(14 + hash01(`${seed}:h`) * 18, 10, 34),
      subjectIds: chosen.subjectIds, text: chosen.text,
    })
  }

  // Per-category caps + a hard total, applied HERE so `allRumors` IS the whole
  // bounded set of "what's going around" — not an unbounded backlog behind it.
  // That's what keeps dismiss/clear honest: there's no infinite pool for a
  // waved-off rumor to be instantly replaced from, and clearing this set really
  // clears everything. A rivalry-heavy scene shows its top few, not all thirty.
  const CAPS = { unhappy: 3, feud: 2, busted: 2, rivalry: 2, team: 1, life: 2, hype: 1, moneymatch: 1 }
  const kept = {}
  const out = []
  for (const r of rumors.sort((a, b) => b.heat - a.heat || (a.id < b.id ? -1 : 1))) {
    const cap = CAPS[r.category]
    if (cap != null) {
      kept[r.category] = (kept[r.category] || 0) + 1
      if (kept[r.category] > cap) continue
    }
    out.push(r)
    if (out.length >= RUMOR_TOTAL_MAX) break
  }
  return out
}

// The whole mill never shows more than this — the counter only carries so much
// gossip at once. Keeps the pool small enough that dismiss/clear feel bounded.
export const RUMOR_TOTAL_MAX = 10
// How much hotter a dismissed rumor must get before it forces its way back.
export const RUMOR_REFLARE = 10

// Is this rumor currently waved off? Dismissed AND not yet re-flared past where
// it was dismissed. (Stale dismissals are pruned by the dismiss/clear actions,
// which keep only ids still present in `allRumors`.)
export function isRumorDismissed(save, rumor) {
  const d = (save.dismissedRumors || {})[rumor.id]
  return d != null && rumor.heat <= d + RUMOR_REFLARE
}

/**
 * The rumors to DISPLAY: the bounded `allRumors` set minus the ones you've
 * waved off. Nothing else — no separate caps or slice — so the panel, the card
 * teaser, and "clear all" all reason about the exact same list.
 */
export function gatherRumors(save) {
  return allRumors(save).filter((r) => !isRumorDismissed(save, r))
}
