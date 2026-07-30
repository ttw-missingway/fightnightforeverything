// HOW MANY RUNS TO AN EVO CHAMPION?
//
// HISTORY NOTE: this harness was built to measure the roguelike legacy loop —
// banked points buying a stronger cast each run. The revision REVERSED that
// (docs/REVISION.md §0.1, docs/DEPRECATED.md): a single run must be able to
// produce an EVO champion, and a returning run never starts stronger. What a
// lineage still is: the same identities, unlocks and cosmetic prestige,
// starting over. This now measures that — the "champion in N runs" question
// has become "does any run of a lineage get there", which is the P1 question.
//
// This plays a lineage: run, reset, carry what carries, run again. It mirrors
// resetSaveById in state/store.jsx exactly, because a harness that resets
// differently from the game measures a different game.
//
//   node tools/balance/lineage.mjs [lineages] [maxRuns] [years]

import { makeRun, playDay, isDead, DEFAULT_POLICY, mean } from './policy.mjs'
import { newSave, migrateSave, resetPlayerForNewRun } from '../../src/game/model.js'
import { prestigeEarned, seedFamilyCrew } from '../../src/game/economy.js'
import { difficultyOf, runAge } from '../../src/game/constants.js'
import { bestRanked } from '../../src/game/world.js'

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
    // Points no longer buy stats — the budget is the difficulty's alone.
    const budget = difficultyOf(save).statPoints

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
    console.log(`\n=== ${spendPoints ? 'REBUILT CAST (fresh roster each run, same budget)' : 'CARRIED CAST (identities cross, progress wiped)'} ===`)
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
