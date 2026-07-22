// The beat engine: renders a match as moment-to-moment "footage" that is
// conditioned on the already-decided outcome. The outcome model
// (winProbability + elo) stays the source of truth for the ecosystem; this
// engine is the broadcast layer — every health tick, meter drain, and
// punish traces back to the characters' real kits and the players' real
// stats, but the bookings never contradict the meta-game.
//
// It is a PURE function of its inputs + seed: the same call always yields
// the same script, so stored seeds can regenerate footage later, and
// marquee matches can run several seeds and keep the most dramatic cut.
//
// Contract (same as the old narrateMatch, plus seed):
//   narrateSet(opts) → { lines, meta, hud, score, target, seed }
//   meta[i]: { kind: 'opener'|'series'|'crowd'|'bell'|'beat'|'game'|
//              'struggle'|'closer'|'phrase', actor, move }
//   hud[i]:  { hpA, hpB, mA, mB, gA, gB } (0-100 bars, games taken)

import { clamp } from './util.js'
import { ARCHETYPE_FLAVOR, MOVE_VERBS } from './names.js'
import { comboDamage } from './design.js'

export const HEALTH = 1000

// Deterministic RNG (mulberry32) — the engine must never touch Math.random.
function rngOf(seed) {
  let s = (seed >>> 0) || 1
  return () => {
    s |= 0; s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Missing player stats (EVO elites) read as seasoned pros.
const DEFAULT_STATS = { composure: 7, analysis: 6, xfactor: 6, mastery: 7, dominance: 6 }

// Everything the beat generator wants to know about one side's kit.
function kitOf(char, skill) {
  const mv = char?.moves || []
  const combos = (char?.combos || [])
    .map((c) => ({ name: c.name, dmg: comboDamage(char, c), len: (c.moveIds || []).length }))
    .filter((c) => c.dmg > 0)
  const normals = mv.filter((m) => m.slot === 'normal' || ['light', 'melee', 'heavy'].includes(m.type))
  const fastestMove = normals.reduce((best, m) => ((m.startup ?? 9) < (best?.startup ?? 9) ? m : best), null)
  return {
    char,
    skill: skill || 0,
    archetype: char?.archetype || 'All-Rounder',
    combos,
    specials: mv.filter((m) => m.slot === 'special' && (m.damage ?? 0) > 0),
    supers: mv.filter((m) => (m.slot === 'super' || m.type === 'super') && (m.damage ?? 0) > 0),
    projectiles: mv.filter((m) => m.type === 'projectile'),
    grabs: mv.filter((m) => m.type === 'command grab'),
    counters: mv.filter((m) => m.type === 'counter'),
    fastestMove,
    fastest: fastestMove?.startup ?? 8,
    // Moves an opponent can punish on block — real frame data, real notes.
    unsafe: mv.filter((m) => (m.onBlock ?? -5) <= -8 && (m.slot !== 'super')),
    plus: mv.filter((m) => (m.onBlock ?? -5) >= 2),
  }
}

/**
 * Narrate a full set. `spice` > 1 runs extra seeds and keeps the most
 * dramatic script — use it for money matches, finals, EVO.
 */
export function narrateSet(opts) {
  const spice = clamp(opts.spice || 1, 1, 4)
  const baseSeed = (opts.seed ?? 1) >>> 0
  let best = null
  for (let i = 0; i < spice; i++) {
    const script = simulateOnce(opts, (baseSeed + i * 9973) >>> 0)
    if (!best || script.drama > best.drama) best = script
  }
  return best
}

function simulateOnce({
  aName, bName, charA, charB, skillA = 0, skillB = 0, statsA = null, statsB = null,
  probA = 0.5, winnerIsA, long = false, winnerPhrase = '', seriesNote = null,
  grudge = false, watcherCount = 0, stageName = null, marquee = false,
}, seed) {
  const R = rngOf(seed)
  const pick = (arr) => arr[Math.floor(R() * arr.length)]
  const odds = (p) => R() < p
  const irnd = (lo, hi) => lo + Math.floor(R() * (hi - lo + 1))

  const A = { side: 'A', name: aName, kit: kitOf(charA, skillA), stats: statsA || DEFAULT_STATS, hp: HEALTH, meter: 0, games: 0 }
  const B = { side: 'B', name: bName, kit: kitOf(charB, skillB), stats: statsB || DEFAULT_STATS, hp: HEALTH, meter: 0, games: 0 }
  const winner = winnerIsA ? A : B
  const loser = winnerIsA ? B : A
  const winnerProb = winnerIsA ? probA : 1 - probA
  const closeness = 1 - Math.abs(probA - 0.5) * 2
  const severity = winnerProb < 0.22 ? 'severe' : winnerProb < 0.4 ? 'mild' : 'none'
  const target = long ? 3 : 2

  const lines = []
  const meta = []
  const hud = []
  const drama = { leadChanges: 0, drops: 0, supers: 0, comebacks: 0, clutch: 0 }
  const snap = () => ({
    hpA: Math.round(clamp(A.hp, 0, HEALTH) / 10), hpB: Math.round(clamp(B.hp, 0, HEALTH) / 10),
    mA: Math.round(clamp(A.meter, 0, 100)), mB: Math.round(clamp(B.meter, 0, 100)),
    gA: A.games, gB: B.games,
  })
  const push = (text, m = {}) => {
    lines.push(text)
    meta.push({ kind: m.kind || 'beat', actor: m.actor || null, move: m.move || null })
    hud.push(snap())
  }

  // ---------- pre-match ----------
  if (stageName && !grudge && odds(0.4)) {
    push(pick([
      `${aName} vs ${bName} — cursor lands on ${stageName}.`,
      `Stage select: ${stageName}. ${aName} and ${bName} nod. It's on.`,
      `They take it to ${stageName}, because some fights deserve a backdrop.`,
    ]), { kind: 'opener' })
  } else {
    push((grudge ? pick([
      (a, b) => `There's history here — ${a} and ${b} skip the fist bump entirely.`,
      (a, b) => `The room goes quiet. ${a} vs ${b} is personal and everyone knows it.`,
      (a, b) => `${a} sits down without a word. ${b} doesn't look at them. Here we go.`,
    ]) : pick([
      (a, b) => `${a} and ${b} step up. The cabinet hums.`,
      (a, b) => `${a} cracks their knuckles as ${b} picks their character.`,
      (a, b) => `Quarters up. ${a} versus ${b} — winner keeps the stick warm.`,
      (a, b) => `${a} and ${b} run the customary button check, then it's on.`,
    ]))(aName, bName), { kind: 'opener' })
  }
  if (seriesNote) push(seriesNote, { kind: 'series' })
  if (watcherCount >= 3 && odds(0.6)) {
    push(pick([
      'The railbirds crowd in — this one has juice.',
      'Chairs scrape closer. Everybody wants to see this.',
      `Somebody calls "next" and gets waved off. Nobody is interrupting this.`,
    ]), { kind: 'crowd' })
  }

  // ---------- book the set ----------
  let loserGames = 0
  for (let i = 0; i < target - 1; i++) if (odds(0.12 + closeness * 0.55)) loserGames++
  if (severity !== 'none' && loserGames === 0 && odds(0.6)) loserGames = 1
  const seq = [...Array(target - 1).fill('W'), ...Array(loserGames).fill('L')]
  for (let i = seq.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [seq[i], seq[j]] = [seq[j], seq[i]] }
  seq.push('W')

  // ---------- per-beat text builders ----------
  const fmtPlus = (v) => (v > 0 ? `+${v}` : `${v}`)
  // "the The Standard" reads like a typo — don't double the article.
  const art = (name) => (/^the\s/i.test(name) ? name : `the ${name}`)

  // One offensive beat from att against def. Returns applied damage; pushes
  // its own line. `finisher` beats must end the game.
  const offenseBeat = (att, def, { matchPoint, finisher }) => {
    const k = att.kit
    const dstats = att.stats
    const low = att.hp <= 250
    const comeback = low && dstats.xfactor >= 7 && odds(0.6)
    if (comeback) drama.comebacks++
    const pre = comeback ? pick([
      `${att.name} is one hit from death and playing like it's warmup — `,
      `Down to a sliver, ${att.name} goes UP a gear: `,
    ]) : ''

    // Super cash-out: needs the real meter, spends the real cost.
    const superMove = k.supers.length ? k.supers[Math.floor(R() * k.supers.length)] : null
    const superCost = superMove ? Math.min(100, superMove.meterCost ?? 100) : 100
    if (superMove && att.meter >= superCost && (finisher || def.hp <= (superMove.damage ?? 0) * 1.3 || odds(0.3))) {
      att.meter -= superCost
      drama.supers++
      const dmg = superMove.damage ?? 250
      def.hp -= dmg
      push(`${pre}${att.name} ${pick(MOVE_VERBS['super']).replaceAll('{m}', superMove.name).replaceAll('{o}', def.name)} ${dmg} damage.`,
        { kind: 'beat', actor: att.name, move: superMove.name })
      return
    }

    // Hit-confirm into a real combo: skill converts, composure holds it.
    if (k.combos.length && odds(finisher ? 0.6 : 0.45)) {
      const combo = k.combos[Math.floor(R() * k.combos.length)]
      const convert = 0.35 + k.skill * 0.006 + att.stats.mastery * 0.01
      if (!finisher && !odds(convert)) {
        // Got the hit, couldn't convert — pokes only.
        const dmg = irnd(40, 90)
        def.hp -= dmg
        att.meter += irnd(6, 10)
        push(pick([
          `${att.name} gets the hit but can't find the confirm — ${dmg} and the moment passes.`,
          `${att.name} lands the poke and hesitates on the follow-up. ${dmg}, when it could have been the round.`,
          `A clean touch for ${att.name}, but the hands don't answer — ${dmg} and back to neutral.`,
          `${att.name} clips ${def.name} for ${dmg}. The full route was there. The execution wasn't.`,
        ]), { kind: 'beat', actor: att.name, move: null })
        return
      }
      const dropP = clamp(0.05 + combo.len * 0.02 - dstats.composure * 0.014 - k.skill * 0.0008 + (matchPoint ? 0.07 : 0), 0.02, 0.4)
      if (!finisher && odds(dropP)) {
        const partial = Math.round(combo.dmg * (0.35 + R() * 0.2))
        def.hp -= partial
        att.meter += irnd(8, 14)
        drama.drops++
        if (matchPoint) drama.clutch++
        push(`${att.name} confirms into ${art(combo.name)}… and DROPS it${matchPoint ? ' under match point pressure' : ''} — only ${partial} of the ${combo.dmg}.`,
          { kind: 'struggle', actor: att.name, move: combo.name })
        return
      }
      def.hp -= combo.dmg
      att.meter += irnd(10, 16)
      def.meter += irnd(4, 8)
      push(`${pre}${att.name} ${pick([
        `confirms into ${art(combo.name)} — ${combo.dmg} damage, the crowd counting every hit`,
        `lands the full ${combo.name}. ${combo.dmg} off one touch`,
        `finds an opening and runs ${art(combo.name)} for ${combo.dmg}`,
      ])}.`, { kind: 'beat', actor: att.name, move: combo.name })
      return
    }

    // Whiff punish off the opponent's actual unsafe move.
    if (def.kit.unsafe.length && odds(0.35)) {
      const bad = def.kit.unsafe[Math.floor(R() * def.kit.unsafe.length)]
      const dmg = k.combos.length ? k.combos[0].dmg : irnd(90, 160)
      def.hp -= dmg
      att.meter += irnd(8, 14)
      push(`${def.name} throws out ${bad.name} — ${fmtPlus(bad.onBlock ?? -9)} on block — and ${att.name} makes it COST: ${dmg} damage.`,
        { kind: 'beat', actor: att.name, move: bad.name })
      return
    }

    // Command grab momentum.
    if (k.grabs.length && odds(0.35)) {
      const grab = k.grabs[Math.floor(R() * k.grabs.length)]
      const dmg = grab.damage ?? irnd(110, 170)
      def.hp -= dmg
      att.meter += irnd(8, 12)
      push(`${pre}${att.name} ${pick(MOVE_VERBS['command grab']).replaceAll('{m}', grab.name).replaceAll('{o}', def.name)} — ${dmg}.`,
        { kind: 'beat', actor: att.name, move: grab.name })
      return
    }

    // Zoning grind: real chip numbers add up.
    if (k.projectiles.length && odds(0.35)) {
      const proj = k.projectiles[Math.floor(R() * k.projectiles.length)]
      const throws = irnd(3, 6)
      const dmg = Math.max(20, (proj.chip ?? 5) * throws + irnd(10, 50))
      def.hp -= dmg
      att.meter += irnd(10, 16)
      def.meter += irnd(6, 10)
      push(`${att.name} ${pick(MOVE_VERBS['projectile']).replaceAll('{m}', proj.name).replaceAll('{o}', def.name)} — ${throws} of them, ${dmg} shaved off.`,
        { kind: 'beat', actor: att.name, move: proj.name })
      return
    }

    // Speed check: my fastest button beats yours, and here's the math.
    if (k.fastestMove && def.kit.fastestMove && k.fastest < def.kit.fastest && odds(0.3)) {
      const dmg = (k.fastestMove.damage ?? 45) + irnd(20, 60)
      def.hp -= dmg
      att.meter += irnd(6, 12)
      const mirror = k.fastestMove.name === def.kit.fastestMove.name
      push(mirror
        ? `The jab war goes to ${att.name} — their ${k.fastestMove.name} is ${k.fastest}f to ${def.name}'s ${def.kit.fastest}f, and a frame is a frame: ${dmg}.`
        : `Scramble — ${att.name}'s ${k.fastestMove.name} is ${k.fastest}f to ${def.kit.fastestMove.name}'s ${def.kit.fastest}f, and frame math doesn't lie: ${dmg}.`,
        { kind: 'beat', actor: att.name, move: k.fastestMove.name })
      return
    }

    // A special with its move verb.
    if (k.specials.length && odds(0.7)) {
      const m = k.specials[Math.floor(R() * k.specials.length)]
      const dmg = m.damage ?? irnd(60, 120)
      def.hp -= dmg
      att.meter += irnd(8, 14)
      def.meter += irnd(4, 8)
      const verbs = MOVE_VERBS[m.type] || MOVE_VERBS['melee']
      push(`${pre}${att.name} ${pick(verbs).replaceAll('{m}', m.name).replaceAll('{o}', def.name)} — ${dmg}.`,
        { kind: 'beat', actor: att.name, move: m.name })
      return
    }

    // Archetype fundamentals (also the no-kit fallback).
    const pool = ARCHETYPE_FLAVOR[k.archetype] || ARCHETYPE_FLAVOR['All-Rounder']
    const dmg = irnd(50, 110)
    def.hp -= dmg
    att.meter += irnd(6, 12)
    push(`${pre}${att.name} ${pick(pool).replaceAll('{o}', def.name)} — ${dmg} over the exchange.`,
      { kind: 'beat', actor: att.name })
  }

  // A defensive beat: no damage, tension and meter.
  const defenseBeat = (def, att, gi) => {
    def.meter += irnd(6, 12)
    att.meter += irnd(4, 8)
    if (gi > 0 && def.stats.analysis >= 7 && odds(0.5)) {
      push(pick([
        `${def.name} has the download now — the trick that won game ${gi} gets blocked on sight.`,
        `${def.name} stops guessing and starts KNOWING. Everything ${att.name} tries gets checked.`,
      ]), { kind: 'beat', actor: def.name })
      return
    }
    push(pick([
      `${def.name} blocks it all — the round slows to a staring contest at half screen.`,
      `${def.name} weathers the storm, life bar intact, meter ticking up.`,
      `Nothing lands for a beat. Two characters walking back and forth, both bars frozen. Somebody has to blink.`,
    ]), { kind: 'crowd', actor: def.name })
  }

  // ---------- play the games ----------
  let w = 0
  let l = 0
  seq.forEach((g, gi) => {
    const isFinal = gi === seq.length - 1
    const gWinner = g === 'W' ? winner : loser
    const gLoser = g === 'W' ? loser : winner
    const matchPoint = isFinal && seq.length > 1 && l === target - 1

    // The bell: fresh health, carried meter — its own line, so the bars
    // visibly reset on screen.
    A.hp = HEALTH; B.hp = HEALTH
    if (gi === 0) {
      push(pick([
        'Both bars fill. Game one — fight.',
        'Character select locks in. Round one.',
        'The bars flash full and the first game is live.',
      ]), { kind: 'bell' })
    } else if (matchPoint) {
      push(`Final game. Match point both ways. The whole arcade holds its breath.`, { kind: 'crowd' })
    } else {
      const meterNote = gWinner.meter >= 70 ? ` ${gWinner.name} walks in with a full bar banked.`
        : gLoser.meter >= 70 ? ` ${gLoser.name} has the meter — everyone knows what that means.` : ''
      const score = w === l ? `${w}–${l}` : `${Math.max(w, l)}–${Math.min(w, l)}`
      push(pick([
        `Game ${gi + 1}. Fresh bars, same tension — ${score} in the set.${meterNote}`,
        `They run it back. Game ${gi + 1}.${meterNote}`,
        `Bars reset. ${score}. Game ${gi + 1} is live.${meterNote}`,
      ]), { kind: 'bell' })
    }

    // How much of a fight the game's loser puts up (books the health arcs).
    const gWinProb = gWinner === winner ? winnerProb : 1 - winnerProb
    const dominant = odds(gWinProb)
    const loserBudget = dominant ? irnd(80, 500) : irnd(550, 920) // damage they get to deal
    let loserDealt = 0
    const maxBeats = (marquee ? 1 : 0) + (isFinal ? irnd(2, 3) : irnd(1, 2))
    let beats = 0
    let lastLeader = null

    while (gLoser.hp > 0 && beats < maxBeats) {
      const loserMay = loserDealt < loserBudget
      const attackerTurn = !loserMay || odds(0.6)
      if (attackerTurn) {
        // Don't let a non-final beat KO unless we've had at least one beat.
        offenseBeat(gWinner, gLoser, { matchPoint, finisher: false })
      } else {
        const before = gWinner.hp
        if (odds(0.75)) offenseBeat(gLoser, gWinner, { matchPoint: false, finisher: false })
        else defenseBeat(gLoser, gWinner, gi)
        loserDealt += before - gWinner.hp
        // The booked loser can NEVER close the game: their would-be killing
        // blow becomes the drop everyone remembers.
        if (gWinner.hp <= 0) {
          gWinner.hp = irnd(15, 60)
          drama.drops++
          drama.clutch++
          lines[lines.length - 1] = `${gLoser.name} has the kill on screen — and drops the route that ends it. ${gWinner.name} survives on ${Math.round(gWinner.hp / 10)}%.`
          meta[meta.length - 1] = { kind: 'struggle', actor: gLoser.name, move: null }
          hud[hud.length - 1] = snap()
        }
      }
      const leader = A.hp === B.hp ? lastLeader : (A.hp > B.hp ? 'A' : 'B')
      if (lastLeader && leader !== lastLeader) drama.leadChanges++
      lastLeader = leader
      beats++
    }

    // The kill: if the game isn't over yet, the winner closes it now.
    if (gLoser.hp > 0) {
      offenseBeat(gWinner, gLoser, { matchPoint, finisher: true })
      if (gLoser.hp > 0) {
        // Kit couldn't mathematically finish in one beat — the mop-up rides
        // along on the same line.
        const pct = Math.round(gLoser.hp / 10)
        gLoser.hp = 0
        lines[lines.length - 1] += ' ' + pick([
          `The knockdown pressure takes the rest.`,
          `${gWinner.name} stays glued to the wakeup and the last ${pct}% evaporates.`,
          `The corner does the rest of the work.`,
          `From there it's oki until the bar is gone.`,
        ])
      }
    }
    if (g === 'W') w++
    else l++
    gWinner.games++

    // Fold the game call into the KO line itself: one line ends the game,
    // and the HUD ticks the round pip on that exact line.
    const winnerPct = Math.round(clamp(gWinner.hp, 0, HEALTH) / 10)
    const clutchKO = winnerPct <= 8
    if (clutchKO) drama.clutch++
    if (!isFinal) {
      let clause
      if (gi === 0) clause = pick([', and takes the opener', ', to bank game one'])
      else if (w === l) clause = `, evening the set at ${Math.max(w, l)}–${Math.min(w, l)}`
      else {
        const score = gWinner === winner ? `${w}–${l}` : `${l}–${w}`
        clause = pick([`, to go up ${score}`, ` — ${score}, and ${gLoser.name} is one game from the exit`])
      }
      lines[lines.length - 1] = lines[lines.length - 1].replace(/[.!]\s*$/, '') + clause + '.'
      meta[meta.length - 1] = { ...meta[meta.length - 1], kind: 'game' }
    }
    hud[hud.length - 1] = snap() // the KO line shows the fresh pip and empty bar
  })

  // ---------- the closer ----------
  const score = `${target}–${loserGames}`
  const finalPct = Math.round(clamp(winner.hp, 0, HEALTH) / 10)
  let closer
  if (severity === 'severe') {
    closer = pick([
      `${winner.name} takes the set ${score}. The arcade ERUPTS — nobody had this on their card.`,
      `It's over — ${winner.name} wins ${score}. ${loser.name} stares at the screen, controller still in hand.`,
    ])
  } else if (severity === 'mild') {
    closer = pick([
      `${winner.name} closes it out ${score}. A quiet upset — the room saw it coming a game too late.`,
      `${winner.name} takes the set ${score}, and ${loser.name} is already asking for the runback.`,
    ])
  } else if (loserGames === target - 1) {
    closer = pick([
      `Last hit lands — ${winner.name} escapes the set ${score} with ${finalPct}% left!`,
      `${winner.name} clutches the decider ${score}. What a set.`,
    ])
  } else if (loserGames === 0 && winnerProb > 0.7) {
    closer = pick([
      `A clean ${score} sweep. ${winner.name} never looked worried.`,
      `${winner.name} sweeps it ${score}. Total control from the character select screen.`,
    ])
  } else {
    closer = pick([
      `${winner.name} takes the set ${score}.`,
      `That's the set — ${winner.name} wins ${score}.`,
    ])
  }
  push(closer, { kind: 'closer', actor: winner.name })

  if (winnerPhrase && odds(0.4)) {
    push(`${winner.name} stands up: "${winnerPhrase}"`, { kind: 'phrase', actor: winner.name })
  }

  const dramaScore = drama.leadChanges * 2 + drama.drops * 2 + drama.supers * 2
    + drama.comebacks * 3 + drama.clutch * 4 + (loserGames === target - 1 ? 4 : 0)
  return { lines, meta, hud, score, target, seed, drama: dramaScore }
}
