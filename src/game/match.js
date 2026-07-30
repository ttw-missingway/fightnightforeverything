import { clamp, rand, displayName } from './util.js'
import { getMatchup, awardMilestone } from './model.js'
import { areRivals, rivalOf } from './social.js'
import { competitiveIntensity, statLevel, absDayOf } from './constants.js'
import { matchWound, matchEdge, EUREKA } from './eureka.js'

// ---------- Character skill & learning curve ----------

// Does this player have an active rival RIGHT NOW? Read from the day's cached
// scene read (O(1)) in the hot sim path; falls back to a live scan for the UI
// and fresh saves where the scene hasn't been computed yet.
function hasActiveRival(save, player) {
  const ids = save.scene?.rivalIds
  if (ids) return ids.includes(player.id)
  return !!rivalOf(save, player)
}

/**
 * The skill CEILING — how good this player can ever realistically get on a
 * character. This is the heart of the mid-game: raw talent (aptitude) and
 * hunger (competitive intensity) set where an UNCULTIVATED player plateaus, and
 * only cultivation pushes past it — an active rivalry ("iron sharpens iron") and
 * the earned stage belief that comes from being featured. Reaching the very top
 * is meant to be nearly impossible: it takes elite talent AND years of the right
 * environment. Most of the roster stalls in the 40s–50s no matter what.
 */
export function skillCeiling(save, player, charId) {
  const s = player.personal || {}
  const apt = s.aptitude ?? 5
  const mastery = s.mastery ?? 5
  const intensity = competitiveIntensity(player) // 1..10
  // Where a player stalls with NO cultivation — the comfort plateau.
  // Nerve is part of potential: the innate half (composure) sits alongside the
  // earned half (belief) — the Stoic's slow-but-inevitable engine.
  // Volume is potential, not just pace. `stamina` used to appear ONLY in the
  // learning rate, which is multiplied by (ceiling - skill)/ceiling — so it
  // bought arrival time and never destination, and over a long run the
  // thousand-hour grinder ended up indistinguishable from the dabbler. It was
  // also the reason the Stoic row measured as free to delete: of its four
  // stats only `composure` reached this line, while all four Killer stats
  // reach it through competitiveIntensity.
  // EVERY point has to buy something, all the way to a maxed build.
  //
  // This used to read only five things — aptitude, intensity, mastery,
  // composure, stamina — which is eight stats, or forty creation points. A
  // build hit ceiling 96 at forty points and then every further point was
  // literally dead: measured, 40 / 60 / 80 / 114 points all produced 96. A
  // lineage banking 130 points was buying nothing after its third run.
  //
  // So the ceiling reads the WHOLE person now, and the weights are set so that
  // forty focused points reach ~72 — good, not world-class — and a fully
  // maxed personal build reaches ~92, deliberately short of the 100 cap so
  // that cultivation (an active rival, earned belief, the character's tech)
  // still has somewhere to go. Points and cultivation both have to matter. The rest of the roster is unaffected:
  // an empty build still lands around 30, because every term is zero.
  //
  // The secondary stats are there because they are all, genuinely, part of how
  // far someone goes: reading the game, stealing other people's tech, sticking
  // with a character, keeping their head, turning up.
  const secondary = (s.analysis ?? 0) + (s.innovation ?? 0) + (s.learning ?? 0)
    + (s.loyalty ?? 0) + (s.adaptation ?? 0) + (s.presence ?? 0)
    + (s.spark ?? 0) + (s.temperance ?? 0)
  let ceiling = 28 + apt * 1.0 + intensity * 1.5 + mastery * 0.7
    + (s.composure ?? 5) * 0.6 + (s.stamina ?? 0) * 0.6
    + secondary * 0.25
  // Iron sharpens iron: an active rival is the main way past the plateau.
  //
  // This was +10 and it was not paying. Removing the archetype that GENERATES
  // rivalries (Dramatic) made measured skill go UP 19% — the feud cost the
  // scene more in mood and attendance than the rivalry returned in growth. A
  // rival has to be worth having.
  //
  // Cultivation is a share of the REMAINING HEADROOM, not a flat bonus.
  //
  // These three used to add a flat +38 between them, against a hard cap of 100
  // — so a forty-point build and a fully maxed one both landed on exactly 100
  // the moment they had a rival and some belief. That is the "points go dead"
  // problem again at the other end of the curve, and it is worse there,
  // because it erases the whole reward for a lineage that banked a hundred
  // points. As a fraction of headroom it can never do that: it closes some of
  // the gap to perfect, and how far that gets you still depends on where your
  // creation points put you. Half the gap is the most anybody gets.
  let cult = 0
  // Iron sharpens iron: an active rival is the main way past the plateau.
  //
  // This was +10 flat and it was not paying. Removing the archetype that
  // GENERATES rivalries (Dramatic) made measured skill go UP 19% — the feud
  // cost the scene more in mood and attendance than the rivalry returned in
  // growth. A rival has to be worth having.
  if (hasActiveRival(save, player)) cult += 0.30
  // Earned stage belief: battle-tested players realize more of their potential.
  // This is the single biggest thing separating a cultivated player from a
  // talented one who was left alone. Calibrated to what belief can actually
  // REACH: since it became a wager rather than an accrual, a genuinely
  // battle-tested player lands in the 60s, not the 90s.
  cult += Math.min(0.28, (player.belief ?? 0) * 0.0045)
  // Knowing the character's discovered tech lifts the very top a little.
  cult += Math.min(0.10, techniqueBonus(save, player, charId) * 0.012)
  ceiling += (100 - ceiling) * clamp(cult, 0, 0.5)
  // THE SPIRIT WALL (REVISION §1.6). The formula above is the ceiling DERIVED
  // from the sheet — and since breakthroughs raise the sheet, eureka raises
  // this ceiling all career: practice fills toward it, eureka moves it. The
  // spirit roll is the wall behind all of it: hidden, permanent, and the
  // thing a topped-out player discovers in fiction, never as a number. It
  // only bites the heavily cultivated — everyone here is capable; what you
  // discover is the shape.
  const spiritCap = player.spiritCeil?.skill
  if (spiritCap != null) ceiling = Math.min(ceiling, spiritCap)
  // Filler stays filler: a passer-through can be genuinely good — a real rival,
  // a real weekly threat — but the story of this arcade belongs to the players
  // the user MADE. The tether used to be castTop − 4, which quietly welded the
  // whole room to the cast's best and manufactured the very convergence the
  // revision exists to cure (measured: local separation 2.78 → 1.6 over six
  // years WITH the eureka spine running). Under §1.8 filler stalls naturally —
  // nobody streams them, belief never comes, adversity converts to burnout —
  // so the clamp is a backstop now, set loose enough for a genuine local
  // threat and tight enough that no stranger headlines the story.
  if (player.npc) {
    const castTop = save.scene?.castTopSkill ?? 0
    ceiling = Math.min(ceiling, Math.max(42, castTop - 12))
  }
  return clamp(ceiling, 20, 100)
}

// Learning curve: gains asymptote toward the player's ceiling, so the last
// stretch is a real grind and the very top is nearly unreachable. Aptitude
// drives the early climb; mastery keeps the tap open near the top; character
// difficulty slows everything.
export function skillGainMultiplier(save, player, charId) {
  const char = save.game.characters.find((c) => c.id === charId)
  const difficulty = char ? char.difficulty : 5
  const diffFactor = 1.3 - difficulty * 0.06 // 1.24 (easy) .. 0.7 (hard)
  const ceiling = skillCeiling(save, player, charId)
  const skill = player.charSkill[charId] || 0
  if (skill >= ceiling) return 0
  // THROUGH statLevel, not raw. Under the sparse point-buy an unspent stat is
  // 0, not undefined, so the old `?? 5` fallback never fired once and every
  // uninvested player learned at 0.5 instead of the 1.29 the formula was
  // written for — two and a half times slower than designed, forever. Absence
  // is not supposed to be a penalty; it is supposed to be average.
  const apt = statLevel(player.personal.aptitude)
  const mastery = statLevel(player.personal.mastery)
  // Volume is its own teacher: the thousand-hour grinder (stamina) keeps
  // improving on reps alone — the Stoic's slow-but-inevitable engine.
  const rate = 0.5 + apt * 0.09 + mastery * 0.045 + statLevel(player.personal.stamina) * 0.022
  // Asymptote: shrinks to nothing as skill nears the ceiling.
  //
  // The exponent is what makes the last stretch a GRIND, and at 1.15 it wasn't
  // one. Measured: a cast reached ~93% of its ceiling inside year one and then
  // flatlined — years two and three added a single point of skill. That made
  // the whole lineage a step function on banked creation points, because skill
  // simply equalled ceiling and ceiling is arithmetic. It showed up at the top
  // as a cliff: forty points never produced an EVO champion in thirty
  // attempts, sixty points produced one in nine lineages out of ten, and a
  // hundred and fourteen was no better than sixty.
  //
  // At 2.4 the first half of the climb is barely slower and the last quarter
  // costs years — which is where cultivation, a rival, and above all playing
  // people better than you (see lessonFactor, and invasions) stop being flavour
  // and become the only way to finish the climb inside a career.
  const prox = (ceiling - skill) / Math.max(30, ceiling)
  return diffFactor * rate * Math.pow(prox, 2.4)
}

/**
 * How much there is to learn from this opponent, 0.35–2.2.
 *
 * Skill gain used to be completely blind to who you played: being three-oh'd
 * by the best player alive taught your regular exactly as much as beating the
 * worst filler in the room. That is why a cultivated player stalls around
 * skill 50–60 forever — a big fish in a small pond has nothing left to learn
 * from the pond, and the game had no way to express that.
 *
 * An even set is the baseline. Below you it tails off toward nothing; above
 * you it climbs, which is what makes an invasion week (see invasion.js) worth
 * more to a player than a month of local nights.
 */
export function lessonFactor(selfSkill, oppSkill) {
  return clamp(1 + (oppSkill - selfSkill) * 0.035, 0.35, 2.2)
}

export function gainSkill(save, player, charId, baseAmount) {
  if (!charId) return 0
  const cur = player.charSkill[charId] || 0
  const cap = skillCeiling(save, player, charId)
  const gain = Math.max(0, baseAmount * skillGainMultiplier(save, player, charId))
  // Losing your nerve stalls growth; it never unlearns what you already know.
  // (Belief moves the ceiling now, so `cap` can legitimately sit below `cur`.)
  const next = Math.max(cur, clamp(cur + gain, 0, cap))
  player.charSkill[charId] = Math.round(next * 100) / 100
  if (!player.npc && save.settings?.mode !== 'sandbox') {
    if (cur < 50 && next >= 50) awardMilestone(save, 'skill-50', 2, `${displayName(player, save)} broke skill 50 — a genuinely strong player now`)
    if (cur < 70 && next >= 70) awardMilestone(save, 'skill-70', 4, `${displayName(player, save)} broke skill 70 — among the best this scene has produced`)
    // Above 70 is where the world lives, and where a local scene can no longer
    // teach you anything — these two only happen to a cultivated player who
    // has been getting reps against people better than them.
    if (cur < 85 && next >= 85) awardMilestone(save, 'skill-85', 6, `${displayName(player, save)} broke skill 85 — genuinely world class`)
    if (cur < 95 && next >= 95) awardMilestone(save, 'skill-95', 10, `${displayName(player, save)} broke skill 95 — there are maybe three people alive at this level`)
  }
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
        text: `${displayName(player, save)} reached the summit — skill 100 on ${char.name}, a once-in-a-generation feat`,
      })
      if (save.chronicle) {
        save.chronicle.unshift({
          day: save.day, year: save.year, icon: '🌕',
          text: `${displayName(player, save)} hit a PERFECT 100 on ${char.name} — almost nobody ever does`,
        })
      }
    }
  }
  return next - cur
}

// ---------- Performance & match resolution ----------

// Designed techniques are retired — discovered innovations are the tech.
export function techniqueBonus(save, player, charId) {
  let bonus = 0
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
  if (player.mood >= 7) perf += statLevel(player.personal.mojo) * 0.8
  else if (player.mood <= 2) perf -= (10 - statLevel(player.personal.temperance)) * 0.4
  // X-factor: random spike potential. This is the ONLY randomness in a match,
  // so reading it raw meant two players with no x-factor points resolved
  // DETERMINISTICALLY — the higher performance won 100% of the time, and the
  // only upsets in the game came from whoever happened to have the stat.
  perf += rand() * statLevel(player.personal.xfactor) * 1.2
  perf += techniqueBonus(save, player, charId)
  // The purple patch: for a couple of weeks after a breakthrough, everything
  // works. The permanent gain is the stat point; this is the glow.
  if ((player.eureka?.purpleUntilAbs || 0) > absDayOf(save.day, save.year)) perf += EUREKA.PURPLE_PERF
  // CHAMPION-AS-TARGET (REVISION §0, P5): "success generates its own
  // difficulty. A champion becomes a target: people lab them, matchup edges
  // erode, counterpicks sharpen. The second title is harder than the first
  // for a reason you can read in the journal."
  perf -= targetBurden(player)
  return perf
}

/**
 * What being the person everyone is studying costs, in raw performance.
 *
 * Scales with what you have actually won — a local hero is not filmed, a world
 * champion is frame-by-frame homework for the entire planet — and decays as
 * the title recedes, because the scene eventually moves on to labbing somebody
 * else. Capped, because this must make the second title HARDER, never
 * impossible: §0 wants a decade at world number one to be reachable by
 * somebody who keeps earning it.
 */
export function targetBurden(player) {
  const titles = (player.evoTitles || 0) + (player.majorTitles || 0) * 0.4
  if (titles <= 0) return 0
  // Freshest right after a title and easing off over roughly two years.
  return Math.min(4.5, titles * 1.6)
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
  // The chart only pays the player who STUDIED it: exploiting a favorable
  // matchup takes analysis. A 6-4 in the hands of a lab monster is a real
  // weapon; in the hands of a masher it's a stat on a wiki.
  const edge = matchup - 50
  const knowledge = 0.35 + ((edge > 0 ? a : b).personal?.analysis ?? 5) * 0.065
  const matchupShift = edge * 0.35 * weight * knowledge
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


// "X leads the lifetime series 7–3" — computed from a's head-to-head record.
export function seriesNoteFor(a, b, aName, bName) {
  const h = a.h2h?.[b.id]
  if (!h || h.w + h.l < 5) return null
  if (h.w === h.l) return `The lifetime series is dead even at ${h.w}–${h.l}.`
  return h.w > h.l
    ? `${aName} leads the lifetime series ${h.w}–${h.l}.`
    : `${bName} leads the lifetime series ${h.l}–${h.w}.`
}

// How shocking a result is, graded from the pre-match odds — feeds the
// closer tone, stream chat, and social media reactions.
export function upsetSeverityOf(probA, winnerIsA) {
  const winnerProb = winnerIsA ? probA : 1 - probA
  if (winnerProb < 0.22) return 'severe'
  if (winnerProb < 0.4) return 'mild'
  return 'none'
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
 * Which character a player brings to THIS match. Usually their main — but if
 * the main is at a real matchup disadvantage and they have a pocket pick they
 * genuinely know that fares better, they counterpick. Both players read the
 * opponent's MAIN (blind to the counterpick), which keeps selection stable.
 */
export function pickMatchChar(save, player, oppCharId) {
  const main = player.mainCharId
  if (!main || !oppCharId || !(player.pocketPicks || []).length) return main
  // Adaptation is the whole counterpicking temperament: how readily they reach
  // for the pocket, how few reps they need before trusting it, and how small
  // an edge justifies the switch. A one-trick (adaptation 0) rides the main
  // into every 3-7 on the chart; a true flex player switches early and often.
  const adapt = player.personal?.adaptation ?? 5
  const mainMU = getMatchup(save.game, main, oppCharId)
  if (mainMU >= 40 + adapt * 0.8) return main // the main is fine for THIS player
  let best = main
  let bestScore = mainMU + (player.charSkill[main] || 0) * 0.35
  for (const pid of player.pocketPicks) {
    if (pid === main) continue
    const skill = player.charSkill[pid] || 0
    if (skill < 32 - adapt * 1.4) continue // reps needed before they'll pull it out
    const score = getMatchup(save.game, pid, oppCharId) + skill * 0.35
    if (score > bestScore + (9 - adapt * 0.6)) { bestScore = score; best = pid }
  }
  return best
}

/**
 * Resolve a match between two live players. Mutates elo, mood, W/L, respect.
 * Char ids default to each player's main but may be overridden (counterpicks,
 * pocket-pick labbing). Skill gains are handled by the caller so watching etc.
 * can share logic. `context` carries the eureka stage — {stage, streamed,
 * viewers} — so the wound and edge land AT the point of the result.
 */
export function resolveMatch(save, a, b, aCharId = a.mainCharId, bCharId = b.mainCharId, context = {}) {
  const probA = winProbability(save, a, aCharId, b, bCharId)
  const aWins = rand() < probA
  const winner = aWins ? a : b
  const loser = aWins ? b : a
  const winnerChar = aWins ? aCharId : bCharId
  const loserChar = aWins ? bCharId : aCharId
  const eloDelta = updateElo(winner, loser)
  // Taking a set off a visiting world-class player. A ladder rather than one
  // award per elite: there are sixty-four of them, and paying for each would
  // make an invasion worth more than everything else in the game combined.
  if (!winner.npc && loser.visitor) {
    save.tally ??= {}
    save.tally.visitorsBeaten = (save.tally.visitorsBeaten || 0) + 1
    const n = save.tally.visitorsBeaten
    const who = displayName(winner, save)
    if (n === 1) awardMilestone(save, 'visitor-beaten', 3, `${who} beat a visiting world-ranked player`)
    if (n === 5) awardMilestone(save, 'visitor-beaten-5', 4, `Five sets taken off visiting elites — this room travels well`)
    if (n === 20) awardMilestone(save, 'visitor-beaten-20', 6, `Twenty sets off visiting elites. Crews come here knowing it's a hard week.`)
  }
  winner.wins += 1
  loser.losses += 1
  recordCharResult(winner, winnerChar, true)
  recordCharResult(loser, loserChar, false)
  recordH2H(winner, loser)
  save.patchGames = (save.patchGames || 0) + 1 // every set is balance data

  // Temperance dampens mood swings from game results.
  const swing = (10 - statLevel(loser.personal.temperance)) * 0.25
  loser.mood = clamp(loser.mood - swing, 0, 10)
  winner.mood = clamp(winner.mood + (10 - statLevel(winner.personal.temperance)) * 0.2, 0, 10)

  // Skill growth: dominance for the winner, determination for the loser — on the
  // character they actually played this set, scaled by who they played it
  // against. See lessonFactor: farming the worst player in the room teaches you
  // almost nothing, and getting taken apart by somebody far better teaches you
  // a great deal.
  const wSkill = winner.charSkill[winnerChar] || 0
  const lSkill = loser.charSkill[loserChar] || 0
  const wLesson = lessonFactor(wSkill, lSkill)
  const lLesson = lessonFactor(lSkill, wSkill)
  let wGain = gainSkill(save, winner, winnerChar, (0.1 + statLevel(winner.personal.dominance) * 0.03) * wLesson)
  let lGain = gainSkill(save, loser, loserChar, (0.1 + statLevel(loser.personal.determination) * 0.035) * lLesson)
  // Iron sharpens iron: a real rivalry pushes both to another level. Losing to
  // your rival especially lights a fire under you.
  if (areRivals(save, winner, loser)) {
    wGain += gainSkill(save, winner, winnerChar, 0.14)
    lGain += gainSkill(save, loser, loserChar, 0.2)
  }

  winner.respect += probA > 0.5 === aWins ? 1 : 3 // upsets earn extra respect

  // THE EUREKA SPINE'S INTAKE (REVISION §1.2): the wound and the edge are
  // attributed here, at the moment of the result, with the odds still in
  // hand. Elites and visitors pass through this function without an eureka
  // bag and are skipped inside.
  const stage = context.stage || 'casual'
  const streamed = !!context.streamed
  matchWound(save, loser, winner, { probSelf: aWins ? 1 - probA : probA, stage, streamed })
  matchEdge(save, winner, loser, {
    probSelf: aWins ? probA : 1 - probA, stage, streamed,
    viewers: context.viewers || 0, rivals: areRivals(save, winner, loser),
  })

  return { aWins, probA, eloDelta, winner, loser, wGain, lGain, winnerChar, loserChar, aCharId, bCharId }
}
