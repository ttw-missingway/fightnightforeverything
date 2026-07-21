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

function moveOfType(char, types) {
  if (!char || !char.moves.length) return null
  const pool = char.moves.filter((m) => types.includes(m.type))
  return pool.length ? choice(pool) : choice(char.moves)
}

const OPENERS = [
  (a, b) => `${a.name} and ${b.name} step up. The cabinet hums.`,
  (a, b) => `Round one — ${a.name} vs ${b.name}. A small crowd leans in.`,
  (a, b) => `${a.name} cracks their knuckles as ${b.name} picks their character.`,
]

function midLine(pName, char, oppName) {
  const options = []
  const proj = moveOfType(char, ['projectile'])
  const heavy = moveOfType(char, ['heavy', 'super'])
  const setup = moveOfType(char, ['set up', 'trap', 'install'])
  const grab = moveOfType(char, ['command grab', 'melee'])
  if (proj) options.push(`${pName} controls space with ${proj.name}, chipping ${oppName} down.`)
  if (heavy) options.push(`${pName} lands a monstrous ${heavy.name} — the crowd winces.`)
  if (setup) options.push(`${pName} sets the stage with ${setup.name}; ${oppName} is stuck guessing.`)
  if (grab) options.push(`${pName} closes the gap and connects with ${grab.name}.`)
  options.push(`${pName} out-paces ${oppName} in the neutral, taking round after round.`)
  return choice(options)
}

function strugLine(pName, oppName) {
  return choice([
    `${pName} is getting cornered — ${oppName} smells blood.`,
    `${pName} drops a combo at the worst moment.`,
    `${pName} keeps mashing out of pressure and paying for it.`,
    `${oppName} downloads ${pName} completely; every gamble gets read.`,
  ])
}

/**
 * Generates flavor lines for a match. If one side is heavily favored the
 * narration reflects a stomp; close matches read as nail-biters.
 * aName/bName are display names; charA/charB are character objects (or null).
 */
export function narrateMatch({ aName, bName, charA, charB, probA, winnerIsA, long = false, winnerPhrase = '' }) {
  const A = { name: aName, char: charA }
  const B = { name: bName, char: charB }
  const winner = winnerIsA ? A : B
  const loser = winnerIsA ? B : A
  const winnerProb = winnerIsA ? probA : 1 - probA
  const lines = []
  lines.push(choice(OPENERS)(A, B))

  const beats = long ? 4 : 2
  for (let i = 0; i < beats; i++) {
    if (winnerProb > 0.78) {
      // A stomp: winner dominates almost every beat.
      lines.push(chance(0.85) ? midLine(winner.name, winner.char, loser.name) : strugLine(loser.name, winner.name))
    } else if (winnerProb < 0.35) {
      // Upset! The eventual winner struggles early.
      lines.push(i < beats - 1 ? midLine(loser.name, loser.char, winner.name) : `Wait — ${winner.name} adapts out of nowhere!`)
    } else {
      lines.push(chance(0.5) ? midLine(A.name, A.char, B.name) : midLine(B.name, B.char, A.name))
    }
  }

  if (winnerProb > 0.78) {
    lines.push(`${winner.name} closes it out clean. Total control from start to finish.`)
  } else if (winnerProb < 0.35) {
    lines.push(`${winner.name} steals it! ${loser.name} stares at the screen in disbelief. Massive upset.`)
  } else {
    lines.push(choice([
      `Last hit trades — ${winner.name} takes it by a pixel of health!`,
      `${winner.name} clutches out the final round. Great set.`,
      `Down to the wire, but ${winner.name} finds the finisher.`,
    ]))
  }
  if (winnerPhrase && chance(0.4)) {
    lines.push(`${winner.name} stands up: "${winnerPhrase}"`)
  }
  return lines
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
