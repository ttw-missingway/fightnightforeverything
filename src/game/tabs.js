// WHICH TABS THE RUN HAS EARNED THE RIGHT TO SHOW.
//
// Distinct from achievements.js on purpose. That file is the LINEAGE ladder:
// things you prove once and keep in every run afterwards, banked on
// `save.prestige`. These gates are about THIS arcade. A brand-new room has no
// teams, no VODs and no world it has met yet, so the tab for each is a door
// onto an empty room — and a nav bar of empty rooms is what makes a first run
// feel like a spreadsheet instead of a place.
//
// So they open from state the save already holds, and they re-close for the
// next run, because the next run is a different arcade that hasn't done any of
// it yet. Nothing new is recorded to support this; every predicate below reads
// something the sim was already writing down.
//
// A locked tab still renders — greyed, unclickable, with `hint` in the tooltip.
// Seeing that there IS a Hall of Fame to earn is the point; an invisible tab
// teaches nobody anything.
//
// WHEN THESE ACTUALLY OPEN. Median run-day, 7 runs per difficulty, one year,
// `tools/balance` policy (scratchpad harness `gates.mjs`, 2026-07-28 — the
// teams row is AFTER the friendship-precursor widening below; gated on a team
// existing it was day 186 on normal and 0/7 in a year on difficult):
//
//   gate         normal              difficult
//   world        day 8  (8–8)        day 8  (8–8)
//   halloffame   day 8  (8–8)        day 8  (8–8)
//   vods         day 8  (8–8)        day 8  (8–8)
//   codex        day 31 (6–48)       day 27 (14–62)
//   teams        day 55 (31–62)      day 179 (154–331), 1/7 never
//
// The first three are pinned to EVO, which lands a fixed 8 days after opening,
// so they have no spread at all. Teams opens on the friendship PRECURSOR now —
// see the gate itself. If a gate reads as broken rather than as anticipation,
// widen it — do not "fix" it by making the underlying thing happen more
// easily, which would change the simulation to solve a UI problem.

/** Has the world's tournament happened yet in this run? */
const evoDone = (save) => (save?.hallOfFame || []).some((r) => r.type === 'evo')

export const TAB_GATES = {
  // EVO is where the run first looks up from its own floor. Until you have sat
  // through one, the world ladder is a list of strangers' names and the Hall of
  // Fame is an empty plinth.
  world: { open: evoDone, hint: 'watching your first EVO' },
  halloffame: { open: evoDone, hint: 'watching your first EVO' },

  // An archive earns its tab the moment there is something in it. `save.vods`
  // is written by pushVod and by nothing else, so it holds finished tournaments
  // and only those — which makes "is there a replay?" and "has a tournament
  // happened?" the same question. Reading the list itself rather than the hall
  // of fame also stops the one state that reads as a bug: the nav badge
  // counting unwatched VODs on a tab you aren't allowed to open.
  vods: { open: (save) => (save?.vods || []).length > 0, hint: 'watching your first tournament' },

  // Teams form on their own, out of friendships made on your floor. That is
  // the tab arriving because the room asked for it.
  //
  // The gate opens on the PRECURSOR — a friendship forming — not on the first
  // team existing. Gated on the team itself, difficult never opened this tab
  // inside a year (0/7): founding needs a mutual 28/18 pair AND a dice roll
  // AND five free agents, and a tab the player is shown and never once gets
  // to open reads as broken, not as anticipation. The screen's empty state
  // already says exactly what is happening ("friendships form → teams").
  //
  // The bar is set from the measured friendship curve (n=6, competent play):
  // the best mutual pair averages 12 by run-day ~110 on normal but only ~21
  // by day 336 on DIFFICULT — a 20/12 bar still left 6/7 difficult runs
  // locked all year. 10/6 is "two people who clearly like each other", and it
  // opens mid-year even on the slow tiers.
  teams: {
    open: (save) => {
      if (Object.keys(save?.teams || {}).length > 0) return true
      const ps = Object.values(save?.players || {})
        .filter((p) => p.isRegular && !p.retired && !p.banished)
      for (const a of ps) {
        if (a.npc) continue // founding is a cast institution — same rule as tryFoundTeam
        for (const b of ps) {
          if (b.id === a.id) continue
          if ((a.relationships[b.id] || 0) > 10 && (b.relationships[a.id] || 0) > 6) return true
        }
      }
      return false
    },
    hint: 'your players making friends',
  },

  // The Codex is a record of what the scene has worked out, and an empty
  // record is not a reference book. Either half opens it — whichever the room
  // manages first — because both are the same event: somebody here knows
  // something about this game that nobody wrote down before.
  codex: {
    open: (save) => (save?.innovations || []).length > 0 || (save?.guides || []).length > 0,
    hint: 'the scene discovering a technique or writing a guide',
  },
}

/**
 * Is this tab open yet? Anything without a gate is always open — a tab nobody
 * has decided to lock is not locked, same rule `isUnlocked` follows.
 */
export const tabOpen = (save, key) => (TAB_GATES[key] ? TAB_GATES[key].open(save) : true)

export const tabHint = (key) => TAB_GATES[key]?.hint || 'playing on'
