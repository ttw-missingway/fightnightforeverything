// HOW MANY RUNS TO AN EVO CHAMPION?
//
// Every other harness here plays ONE run from a fresh lineage. That cannot
// answer the question the roguelike loop is built around — whether banking
// creation points across runs eventually produces a world champion — because
// the answer lives entirely in what happens BETWEEN runs.
//
// This plays a lineage: run, reset, carry the prestige, build a better cast,
// run again. It mirrors resetSaveById in state/store.jsx exactly, because a
// harness that resets differently from the game measures a different game.
//
//   node tools/balance/lineage.mjs [lineages] [maxRuns] [years]

import { makeRun, playDay, isDead, DEFAULT_POLICY, mean } from './policy.mjs'

const SRC = new URL('../../src/game', import.meta.url).pathname
const { newSave, migrateSave, resetPlayerForNewRun, rungPointsThisRun } = await import(`${SRC}/model.js`)
const { prestigeEarned, seedFamilyCrew } = await import(`${SRC}/economy.js`)
const { difficultyOf, runAge, formatDay } = await import(`${SRC}/constants.js`)
const { bestRanked } = await import(`${SRC}/world.js`)

/**
 * The headless twin of resetSaveById. Anything that diverges here makes every
 * number below a measurement of a game that does not exist.
 */
function resetLineage(save, { spendPoints }) {
  const prestigeGain = prestigeEarned(save)
  const runNumber = (save.prestige?.runs || 0) + 1
  const game = structuredClone(save.game)
  game.version = '1.0'
  const arcade = structuredClone(save.arcade)
  arcade.foods = []
  arcade.otherGames = []
  arcade.cleanliness = 80
  arcade.closedUntilAbs = null
  arcade.streamRig = false

  const prestige = {
    points: (save.prestige?.points || 0) + prestigeGain,
    runs: runNumber,
    rungPoints: (save.prestige?.rungPoints || 0) + rungPointsThisRun(save),
    achievements: structuredClone(save.prestige?.achievements || {}),
    unlocks: structuredClone(save.prestige?.unlocks || {}),
    milestonesEver: structuredClone(save.prestige?.milestonesEver || {}),
  }

  const world = newSave({
    settings: structuredClone(save.settings),
    game, arcade,
    evoRoster: structuredClone(save.evoRoster || []),
    prestige,
    archives: [],
  })
  if (save.settings.mode !== 'sandbox') world.economy.money = difficultyOf(world).startingMoney
  // AS THE GAME SHIPS: the cast crosses over with the stats it already had, so
  // banked points buy nothing. AS INTENDED: the roster is rebuilt at the new,
  // larger allowance — which is what "points to spend on player creation" means.
  if (!spendPoints) {
    for (const p of Object.values(save.players)) {
      if (p.npc) continue
      world.players[p.id] = resetPlayerForNewRun(p)
    }
  }
  seedFamilyCrew(world)
  return migrateSave(world)
}

/** One lineage: runs until a champion or `maxRuns`. */
export function runLineage({ difficulty = 'normal', maxRuns = 10, years = 4, spendPoints = true } = {}) {
  let prestige = null
  const log = []
  for (let run = 1; run <= maxRuns; run++) {
    let save
    if (spendPoints || run === 1) {
      // Rebuild from scratch at the current allowance.
      save = makeRun({ difficulty, prestige })
      if (prestige) save.prestige = structuredClone(prestige)
    } else {
      save = prestige.__carried
    }
    const budget = difficultyOf(save).statPoints + (save.prestige?.points || 0)

    let champ = false
    for (let d = 0; d < 336 * years; d++) {
      playDay(save)
      if (Object.values(save.players).some((p) => !p.npc && (p.evoTitles || 0) > 0)) { champ = true; break }
      if (isDead(save)) break
    }
    const best = bestRanked(save)
    log.push({
      run, budget,
      points: save.prestige?.points || 0,
      lasted: runAge(save),
      bestRank: best?.rank ?? null,
      bestElo: best?.elo ?? 0,
      champ,
      died: isDead(save),
    })
    if (champ) return { log, championAt: run }

    const next = resetLineage(save, { spendPoints })
    prestige = structuredClone(next.prestige)
    prestige.__carried = next
  }
  return { log, championAt: null }
}

// ---------- CLI ----------
if (import.meta.url === `file://${process.argv[1]}`) {
  const LIN = Number(process.argv[2] || 4)
  const MAXRUNS = Number(process.argv[3] || 8)
  const YEARS = Number(process.argv[4] || 4)
  for (const spendPoints of [false, true]) {
    console.log(`\n=== ${spendPoints ? 'AS INTENDED (banked points rebuild the cast)' : 'AS IT SHIPS (points unspendable)'} ===`)
    console.log('difficulty  champion in   median runs   pts by last run   best rank reached')
    for (const difficulty of ['easy', 'normal', 'difficult', 'master']) {
      const results = []
      for (let i = 0; i < LIN; i++) results.push(runLineage({ difficulty, maxRuns: MAXRUNS, years: YEARS, spendPoints }))
      const wins = results.filter((r) => r.championAt != null)
      const ranks = results.flatMap((r) => r.log.map((l) => l.bestRank).filter((x) => x != null))
      const pts = results.map((r) => r.log.at(-1).points)
      console.log(
        difficulty.padEnd(11),
        `${wins.length}/${LIN}`.padStart(11),
        String(wins.length ? mean(wins.map((w) => w.championAt)).toFixed(1) : '—').padStart(13),
        String(Math.round(mean(pts))).padStart(17),
        String(ranks.length ? Math.min(...ranks) : '—').padStart(18))
    }
  }
}
