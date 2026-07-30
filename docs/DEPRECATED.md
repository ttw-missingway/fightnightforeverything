# The deprecation lane

`src/game/deprecated/` holds systems the revision cut or benched
(docs/REVISION.md §4). The code is kept because it documents mechanics the
pre-revision baseline (`tools/balance/baseline.json`) was measured against —
but it is dead to the live game. `scripts/check-deprecated.mjs` runs inside
`npm run lint` and fails the build if live code imports from the lane.

The registry below is the truth about what moved, what was cut outright, and
what merely froze. Nothing leaves this list without a REVISION.md change.

| system | disposition | where it went | notes |
|---|---|---|---|
| Warnings & separations | **deprecated** | `deprecated/discipline.js` | `warnPlayer`, `separate`, `areSeparated`, `unseparate`, `pruneSeparations`, `separationOf`, `warnableBehaviors`, `chiefInstigator`, `receptiveness`, `pride`. Replaced in play by the three levers (P3) and eureka's own resolution of social failure. The DisciplinePanel is gone from Players. |
| Banishment | **kept & promoted** | `src/game/discipline.js` (slimmed) | The one nuclear option. Gains reputation, social and rival-resurfacing consequences in P3. |
| Exhibitions | **cut** | `deprecated/exhibition.js` | `canStageExhibition`, `runExhibition`, `EXHIBITION_*`. Streaming showcases; the P4 calendar generates low-stakes matches. Removed rather than fixed. (EVO Media Day's in-broadcast "exhibition" match is unrelated and stays.) |
| Prestige as power | **power path deprecated** | budget formulas | Creation budget is `difficulty.statPoints` alone — banked `prestige.points` no longer buy stats. Points stay earned and displayed as the cosmetic unlock currency (P6 palettes/sprites/rosters/stages). `EARLY_RUNGS` / `RUNG_ALLOWANCE` / `rungPointsThisRun` / `rungAllowanceLeft` moved to `deprecated/rungs.js`; the sim no longer awards bootstrap rungs. |
| Idle time-locks | **deprecated** | Arcade.jsx (gates removed) | Idle mode and every speed are free from the start. The four `idle-*` achievements remain as badges; their unlocks now gate nothing. |
| Amenity expansion | **frozen, not removed** | in place | Attractions stay usable — a new attraction is the kick-start counterplay to irrelevance (§2.6) — but the layer stops growing: no new packs, no construction system, until the core lands. |

## Old saves

**Pre-revision saves are refused, not migrated** (decided 2026-07-29).
`SAVE_SCHEMA_VERSION` in `model.js` marks revision-era saves; `migrateSave`
throws on anything older. Migrating through a change this size would mean
holding dead shapes in `model.js` indefinitely — the exact thing this lane
exists to prevent. Playtest identities can still be salvaged: the main menu
offers a cast export (identities and stats; progress is stripped on import
anyway) read from the raw stored save, no migration needed.
