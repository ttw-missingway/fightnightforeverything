// The notification layer — REVISION §0.4's other half. The journal is where
// you read two hands ahead; a TOAST is the game telling you something is
// nearly too late (or too good to miss). Toasts fire on any screen, are all
// dismissible, and the important ones persist as a banner on the arcade
// screen until waved off. "See it" carries a navigation target and is omitted
// when there is nothing to show.
//
// Dismissing a toast is an acknowledgement, not a decision — the UI passes
// { ack: true } so metric 6 stays honest (REVISION §2.5).

import { uid } from './util.js'
import { absDayOf } from './constants.js'

const CAP = 24

/**
 * Push a toast. `see` is { screen, params? } or null. `sticky` keeps it on
 * the arcade banner until dismissed (the nearly-too-late class); non-sticky
 * toasts are ambient and age off on their own. `key` names the CONDITION the
 * toast announces — one live toast per key, and the code that resolves the
 * condition dismisses it by key, so a prompt can never outlive its question.
 */
export function pushToast(save, { icon = '📣', text, see = null, sticky = false, key = null }) {
  save.toasts ??= []
  // One live toast per condition (key), or per identical text without one —
  // a nightly condition must not stack.
  if (save.toasts.some((t) => !t.dismissed && (key ? t.key === key : t.text === text))) return null
  const toast = {
    id: uid('toast'),
    key,
    absDay: absDayOf(save.day, save.year),
    icon,
    text,
    see,
    sticky,
    dismissed: false,
  }
  save.toasts.unshift(toast)
  if (save.toasts.length > CAP) save.toasts.length = CAP
  return toast
}

export function dismissToast(save, id) {
  const t = (save.toasts || []).find((x) => x.id === id)
  if (t) t.dismissed = true
}

/** The condition resolved — take its question down with it. */
export function dismissToastByKey(save, key) {
  for (const t of save.toasts || []) {
    if (t.key === key && !t.dismissed) t.dismissed = true
  }
}

/** Non-sticky toasts age off after a few days; dismissed ones after one. */
export function pruneToasts(save) {
  if (!save.toasts?.length) return
  const today = absDayOf(save.day, save.year)
  save.toasts = save.toasts.filter((t) => {
    if (t.dismissed) return today - t.absDay < 1
    return t.sticky || today - t.absDay < 4
  })
}

/** What the arcade banner shows: live sticky toasts, newest first. */
export const bannerToasts = (save) => (save.toasts || []).filter((t) => t.sticky && !t.dismissed)

/** What the any-screen overlay shows: everything live, newest first. */
export const liveToasts = (save) => (save.toasts || []).filter((t) => !t.dismissed)
