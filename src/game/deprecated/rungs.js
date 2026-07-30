// DEPRECATED (docs/DEPRECATED.md) — the bootstrap-rung allowance, part of the
// prestige-as-power path the revision reversed. Banked points no longer buy
// creation stats, so the rungs' whole reason to exist — funding a stronger
// cast on Difficult and Master — is gone, and with it the anti-farm cap that
// kept them honest. Kept for the record: the measurements that shaped these
// numbers (uncapped rungs beat playing properly by ~2x on Normal) are the
// kind of finding worth not re-learning.
//
// prestige.points itself SURVIVES as the cosmetic unlock currency (P6:
// palettes, sprite packs, rosters, stages). Only the spend-into-stats died.

export const EARLY_RUNGS = { 'six-weeks': 1, 'season-1': 2, 'first-trophy': 2, 'half-year': 3 }
export const RUNG_ALLOWANCE = 24

/** Rung points banked by THIS run so far. */
export function rungPointsThisRun(save) {
  return Object.keys(save.milestones || {})
    .reduce((sum, k) => sum + (EARLY_RUNGS[k] || 0), 0)
}

/** Whether the lineage has any bootstrap allowance left to spend. */
export function rungAllowanceLeft(save) {
  const spent = (save.prestige?.rungPoints || 0) + rungPointsThisRun(save)
  return Math.max(0, RUNG_ALLOWANCE - spent)
}
