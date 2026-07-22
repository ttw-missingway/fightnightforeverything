import { clamp, rand, choice, chance, displayName } from './util.js'
import { getMatchup } from './model.js'

// ---------- Character skill & learning curve ----------

// Skill cap: reaching 100 requires knowing every character-specific innovation.
export function skillCap(save, player, charId) {
  const charInnovs = save.innovations.filter((i) => i.charId === charId)
  if (charInnovs.length === 0) return 100
  const known = charInnovs.filter((i) => player.knownInnovations.includes(i.id)).length
  return 90 + Math.round(10 * (known / charInnovs.length))
}

// Learning curve: aptitude lowers the difficulty floor (fast early gains),
// mastery lowers the difficulty ceiling (keeps gains alive at high skill).
// Character difficulty slows everything down.
export function skillGainMultiplier(save, player, charId) {
  const char = save.game.characters.find((c) => c.id === charId)
  const difficulty = char ? char.difficulty : 5
  const skill = player.charSkill[charId] || 0
  const aptitude = player.personal.aptitude
  const mastery = player.personal.mastery
  const diffFactor = 1.3 - difficulty * 0.06 // 1.24 (easy) .. 0.7 (hard)
  if (skill < 50) {
    // Early game: aptitude dominates.
    return diffFactor * (0.6 + aptitude * 0.12) * (1 - skill / 130)
  }
  // Mastery phase: much harder, mastery keeps the tap open.
  const wall = (skill - 50) / 50 // 0..1
  return diffFactor * (0.1 + mastery * 0.045) * (1 - wall * (0.96 - mastery * 0.04))
}

export function gainSkill(save, player, charId, baseAmount) {
  if (!charId) return 0
  const cur = player.charSkill[charId] || 0
  const cap = skillCap(save, player, charId)
  const gain = Math.max(0, baseAmount * skillGainMultiplier(save, player, charId))
  const next = clamp(cur + gain, 0, cap)
  player.charSkill[charId] = Math.round(next * 100) / 100
  if (save.charMilestones) {
    const char = save.game.characters.find((c) => c.id === charId)
    if (char && cur < 90 && next >= 90) {
      save.charMilestones.push({
        charId, day: save.day, year: save.year,
        text: `${displayName(player, save)} entered the mastery tier with ${char.name} (skill 90)`,
      })
    }
    if (char && cur < 100 && next >= 100) {
      save.charMilestones.push({
        charId, day: save.day, year: save.year,
        text: `${displayName(player, save)} achieved complete mastery of ${char.name} — every innovation, skill 100`,
      })
    }
  }
  return next - cur
}

// ---------- Performance & match resolution ----------

export function techniqueBonus(save, player, charId) {
  let bonus = 0
  for (const tId of player.knownTechniques) {
    const t = save.game.techniques.find((x) => x.id === tId)
    if (t && (t.charId === null || t.charId === charId)) bonus += 1.5
  }
  for (const iId of player.knownInnovations) {
    const innov = save.innovations.find((x) => x.id === iId)
    if (innov && (innov.charId === null || innov.charId === charId)) bonus += 1
  }
  return Math.min(bonus, 12)
}

export function performance(save, player, charId) {
  const skill = player.charSkill[charId] || 0
  let perf = skill * 0.75 + (player.elo - 1200) / 40
  // Easy characters carry beginners: strong bonus at low skill that fades
  // completely by skill 60. Hard characters only pay off once learned.
  const char = save.game.characters.find((c) => c.id === charId)
  if (char) {
    const lowSkillFactor = Math.max(0, 1 - skill / 60)
    perf += (10 - char.difficulty) * lowSkillFactor * 0.7
  }
  // Mojo: bonus in a good mood, mild penalty in a foul one.
  if (player.mood >= 7) perf += player.personal.mojo * 0.8
  else if (player.mood <= 2) perf -= (10 - player.personal.temperance) * 0.4
  // X-factor: random spike potential.
  perf += rand() * player.personal.xfactor * 1.2
  perf += techniqueBonus(save, player, charId)
  return perf
}

// Matchup knowledge is a high-level phenomenon: at low skill nobody is
// optimizing hard enough for a 60-40 to matter. The cubic curve means the
// chart barely registers below ~skill 60 and dominates near mastery.
export function matchupWeight(skillA, skillB) {
  const avg = clamp((skillA + skillB) / 2, 0, 100)
  return Math.pow(avg / 100, 3)
}

export function winProbability(save, a, aCharId, b, bCharId) {
  const perfA = performance(save, a, aCharId)
  const perfB = performance(save, b, bCharId)
  const matchup = getMatchup(save.game, aCharId, bCharId) // 50 = even
  const weight = matchupWeight(a.charSkill[aCharId] || 0, b.charSkill[bCharId] || 0)
  const matchupShift = (matchup - 50) * 0.35 * weight
  const diff = perfA - perfB + matchupShift
  return 1 / (1 + Math.pow(10, -diff / 22))
}

export function updateElo(winner, loser, k = 32) {
  const expected = 1 / (1 + Math.pow(10, (loser.elo - winner.elo) / 400))
  const delta = Math.round(k * (1 - expected))
  winner.elo += delta
  loser.elo -= delta
  return delta
}

// ---------- Narration ----------
//
// User-authored moves are SPECIAL moves — highlights, not the whole kit.
// Jabs, movement, and gameplan come from the character's archetype, so a
// created character fights like their archetype without the user having to
// define "jab".

import { ARCHETYPE_FLAVOR, MOVE_VERBS } from './names.js'

const OPENERS = [
  (a, b) => `${a.name} and ${b.name} step up. The cabinet hums.`,
  (a, b) => `${a.name} cracks their knuckles as ${b.name} picks their character.`,
  (a, b) => `Quarters up. ${a.name} versus ${b.name} — winner keeps the stick warm.`,
  (a, b) => `${a.name} and ${b.name} run the customary button check, then it's on.`,
]

const GRUDGE_OPENERS = [
  (a, b) => `There's history here — ${a.name} and ${b.name} skip the fist bump entirely.`,
  (a, b) => `The room goes quiet. ${a.name} vs ${b.name} is personal and everyone knows it.`,
  (a, b) => `${a.name} sits down without a word. ${b.name} doesn't look at them. Here we go.`,
]

// One beat of offense from pName: usually archetype fundamentals, sometimes
// a named special as the highlight. Returns {text, move} so chat can react
// to the specific move.
function beatFor(pName, char, oppName) {
  if (char && char.moves.length && chance(0.45)) {
    const move = choice(char.moves)
    const verbs = MOVE_VERBS[move.type] || MOVE_VERBS['melee']
    return {
      text: `${pName} ${choice(verbs).replaceAll('{m}', move.name).replaceAll('{o}', oppName)}`,
      move: move.name,
    }
  }
  const pool = (char && ARCHETYPE_FLAVOR[char.archetype]) || ARCHETYPE_FLAVOR['All-Rounder']
  return { text: `${pName} ${choice(pool).replaceAll('{o}', oppName)}`, move: null }
}

// "X leads the lifetime series 7–3" — computed from a's head-to-head record.
export function seriesNoteFor(a, b, aName, bName) {
  const h = a.h2h?.[b.id]
  if (!h || h.w + h.l < 5) return null
  if (h.w === h.l) return `The lifetime series is dead even at ${h.w}–${h.l}.`
  return h.w > h.l
    ? `${aName} leads the lifetime series ${h.w}–${h.l}.`
    : `${bName} leads the lifetime series ${h.l}–${h.w}.`
}

function strugLine(pName, oppName) {
  return choice([
    `${pName} is getting cornered — ${oppName} smells blood.`,
    `${pName} drops a combo at the worst possible moment.`,
    `${pName} keeps mashing out of pressure and paying for it.`,
    `${oppName} downloads ${pName} completely; every gamble gets read.`,
    `${pName} burns all their meter and gets nothing for it.`,
    `${pName} is stuck holding block while the chip damage piles up.`,
  ])
}

/**
 * Narrates the match as a SET — first to 2 (casual) or first to 3
 * (tournament) — with a running score, so the story has a real arc: games
 * are won and lost on the way to a result that matches the odds.
 *
 * Returns { lines, meta, score }. meta[i] describes line i for stream chat:
 * { kind: 'opener'|'series'|'crowd'|'game'|'struggle'|'closer'|'phrase',
 *   actor: displayName|null, move: moveName|null }
 * upsetSeverityOf(probA, winnerIsA) grades how shocking the result is.
 */
export function upsetSeverityOf(probA, winnerIsA) {
  const winnerProb = winnerIsA ? probA : 1 - probA
  if (winnerProb < 0.22) return 'severe'
  if (winnerProb < 0.4) return 'mild'
  return 'none'
}

export function narrateMatch({
  aName, bName, charA, charB, probA, winnerIsA, long = false,
  winnerPhrase = '', seriesNote = null, grudge = false, watcherCount = 0,
}) {
  const A = { name: aName, char: charA }
  const B = { name: bName, char: charB }
  const winner = winnerIsA ? A : B
  const loser = winnerIsA ? B : A
  const winnerProb = winnerIsA ? probA : 1 - probA
  const closeness = 1 - Math.abs(probA - 0.5) * 2
  const severity = upsetSeverityOf(probA, winnerIsA)
  const target = long ? 3 : 2

  // How many games the loser scrapes together, tied to how close this was.
  let loserGames = 0
  for (let i = 0; i < target - 1; i++) if (chance(0.12 + closeness * 0.55)) loserGames++
  if (severity !== 'none' && loserGames === 0 && chance(0.6)) loserGames = 1 // upsets are rarely sweeps

  // Game sequence from the set-winner's perspective; the clincher is last.
  const seq = [...Array(target - 1).fill('W'), ...Array(loserGames).fill('L')]
  const games = [...seqShuffled(seq), 'W']

  const lines = []
  const meta = []
  const push = (text, m = { kind: 'game', actor: null, move: null }) => {
    if (!lines.includes(text)) { lines.push(text); meta.push(m) }
  }

  push((grudge ? choice(GRUDGE_OPENERS) : choice(OPENERS))(A, B), { kind: 'opener', actor: null, move: null })
  if (seriesNote) push(seriesNote, { kind: 'series', actor: null, move: null })
  if (watcherCount >= 3 && chance(0.6)) {
    push(choice([
      'The railbirds crowd in — this one has juice.',
      'Chairs scrape closer. Everybody wants to see this.',
      `Somebody calls "next" and gets waved off. Nobody is interrupting this.`,
    ]), { kind: 'crowd', actor: null, move: null })
  }

  let w = 0
  let l = 0
  games.forEach((g, gi) => {
    const isFinal = gi === games.length - 1
    const gWinner = g === 'W' ? winner : loser
    const gLoser = g === 'W' ? loser : winner
    if (g === 'W') w++
    else l++

    if (isFinal) {
      // The clincher gets tension instead of a score clause; the closer
      // announces the result.
      if (games.length > 1 && l === target - 1) {
        push(`Final game. Match point both ways. The whole arcade holds its breath.`, { kind: 'crowd', actor: null, move: null })
      }
      // A stomped final game sometimes shows the loser breaking down instead.
      if (winnerProb > 0.78 && loserGames === 0 && chance(0.5)) {
        push(strugLine(gLoser.name, gWinner.name), { kind: 'struggle', actor: gLoser.name, move: null })
      } else {
        const beat = beatFor(gWinner.name, gWinner.char, gLoser.name)
        push(`${beat.text}.`, { kind: 'game', actor: gWinner.name, move: beat.move })
      }
      return
    }

    const beat = beatFor(gWinner.name, gWinner.char, gLoser.name)
    const score = g === 'W' ? `${w}–${l}` : `${l}–${w}`
    let clause
    if (gi === 0) clause = choice(['and takes the opener', 'to bank game one', '— first game to them'])
    else if (w === l) clause = `to even the set at ${score}`
    else clause = choice([`to go up ${score}`, `— ${score} now`])
    push(`${beat.text}, ${clause}.`, { kind: 'game', actor: gWinner.name, move: beat.move })
  })

  // The closer, graded by how the set actually went.
  const score = `${target}–${loserGames}`
  let closer
  if (severity === 'severe') {
    closer = choice([
      `${winner.name} takes the set ${score}. The arcade ERUPTS — nobody had this on their card.`,
      `It's over — ${winner.name} wins ${score}. ${loser.name} stares at the screen, controller still in hand.`,
    ])
  } else if (severity === 'mild') {
    closer = choice([
      `${winner.name} closes it out ${score}. A quiet upset — the room saw it coming a game too late.`,
      `${winner.name} takes the set ${score}, and ${loser.name} is already asking for the runback.`,
    ])
  } else if (loserGames === target - 1) {
    closer = choice([
      `Last hit trades — ${winner.name} escapes with the set, ${score}!`,
      `${winner.name} clutches the decider. ${score}. What a set.`,
    ])
  } else if (loserGames === 0 && winnerProb > 0.7) {
    closer = choice([
      `A clean ${score} sweep. ${winner.name} never looked worried.`,
      `${winner.name} sweeps it ${score}. Total control from the character select screen.`,
    ])
  } else {
    closer = choice([
      `${winner.name} takes the set ${score}.`,
      `That's the set — ${winner.name} wins ${score}.`,
    ])
  }
  push(closer, { kind: 'closer', actor: winner.name, move: null })

  if (winnerPhrase && chance(0.4)) {
    push(`${winner.name} stands up: "${winnerPhrase}"`, { kind: 'phrase', actor: winner.name, move: null })
  }
  return { lines, meta, score }
}

function seqShuffled(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// Lifetime head-to-head between two players — feeds "leads the series 7–3"
// narration.
export function recordH2H(winner, loser) {
  winner.h2h ??= {}
  loser.h2h ??= {}
  const wh = winner.h2h[loser.id] || (winner.h2h[loser.id] = { w: 0, l: 0 })
  const lh = loser.h2h[winner.id] || (loser.h2h[winner.id] = { w: 0, l: 0 })
  wh.w += 1
  lh.l += 1
}

// Lifetime record per character — players gravitate toward characters they
// win with.
export function recordCharResult(player, charId, won) {
  if (!charId) return
  if (!player.charRecord) player.charRecord = {}
  const rec = player.charRecord[charId] || (player.charRecord[charId] = { w: 0, l: 0 })
  if (won) rec.w += 1
  else rec.l += 1
}

/**
 * Resolve a match between two live players. Mutates elo, mood, W/L, respect.
 * Skill gains are handled by the caller (sim/tournament) so watching etc. can share logic.
 */
export function resolveMatch(save, a, b) {
  const aCharId = a.mainCharId
  const bCharId = b.mainCharId
  const probA = winProbability(save, a, aCharId, b, bCharId)
  const aWins = rand() < probA
  const winner = aWins ? a : b
  const loser = aWins ? b : a
  const eloDelta = updateElo(winner, loser)
  winner.wins += 1
  loser.losses += 1
  recordCharResult(winner, winner.mainCharId, true)
  recordCharResult(loser, loser.mainCharId, false)
  recordH2H(winner, loser)

  // Temperance dampens mood swings from game results.
  const swing = (10 - loser.personal.temperance) * 0.25
  loser.mood = clamp(loser.mood - swing, 0, 10)
  winner.mood = clamp(winner.mood + (10 - winner.personal.temperance) * 0.2, 0, 10)

  // Skill growth: dominance for the winner, determination for the loser.
  const wGain = gainSkill(save, winner, winner.mainCharId, 0.1 + winner.personal.dominance * 0.03)
  const lGain = gainSkill(save, loser, loser.mainCharId, 0.1 + loser.personal.determination * 0.035)

  winner.respect += probA > 0.5 === aWins ? 1 : 3 // upsets earn extra respect

  return { aWins, probA, eloDelta, winner, loser, wGain, lGain }
}
