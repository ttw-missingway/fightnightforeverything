// Attention cost — metric 6 of the revision (docs/REVISION.md §2.5).
//
// Attention is MUTATING interactions only: write, update, delete. Reads are
// free. Choosing to stream someone counts; opening their profile does not.
// The definition is enforced at the store boundary (state/store.jsx routes
// every UI mutation through here) and mirrored by the headless competent
// player (tools/balance/policy.mjs notes each decision as it makes it), so
// every future feature is measured without anyone remembering to tag it.
//
// Two rulings from §2.5:
//  - Acknowledgements do not count. Dismissing a toast, clearing a report,
//    advancing the day — writes, but not choices. Callers exclude them with
//    an explicit `ack` flag; the list of who passes it is reviewed whenever
//    it grows.
//  - Two numbers are reported: total, and steady-state excluding creation and
//    run setup. The doors opening (the first closed day in economy.history)
//    is the line between them — point-buy at creation is a legitimate one-off
//    spike that would otherwise swamp a per-week average.

import { absDayOf } from './constants.js'

export function newAttention() {
  return { total: 0, steady: 0, byWeek: {}, byKind: {} }
}

/** Record one mutating decision. `kind` is a short slug for review, not UI. */
export function noteDecision(save, kind = 'ui') {
  if (!save) return
  const bag = (save.attention ??= newAttention())
  bag.total += 1
  bag.byKind[kind] = (bag.byKind[kind] || 0) + 1
  const opened = (save.economy?.history || []).length > 0
  if (!opened) return // creation & run setup: counted in total only
  bag.steady += 1
  const week = Math.floor((absDayOf(save.day, save.year) - 1) / 7)
  bag.byWeek[week] = (bag.byWeek[week] || 0) + 1
}
