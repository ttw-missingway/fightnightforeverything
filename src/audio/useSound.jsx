// The sound layer's only connection to the game (REVISION §5-P7).
//
// It OBSERVES. The engine never calls out to the speaker — this watches the
// notification layer (notify.js), which already enumerates every landmark the
// revision built, and voices whatever it sees arrive. That direction of
// dependency is the whole design: sound cannot touch the save, cannot draw
// from the seeded rng, and cannot be the reason a simulation diverges, because
// the simulation has no idea it exists.
//
// It also means the enumeration §5-P7 asks for is not a second list that can
// drift out of sync with the first. A landmark that pushes a toast is a
// landmark that makes a sound, by construction.

import { useEffect, useRef } from 'react'
import { play, unlockAudio } from './sound.js'

/**
 * Which cue a toast gets. Keyed on the toast's `key` prefix first (the field
 * that names the CONDITION it announces, so it is the most reliable signal)
 * and its icon second.
 */
function cueForToast(t) {
  const key = t.key || ''
  if (key.startsWith('verge_')) return 'verge'
  if (key.startsWith('prospect_')) return 'prodigy'
  if (key.startsWith('ask_')) return 'toast'
  if (key.startsWith('succession_')) return 'danger'
  switch (t.icon) {
    case '🌏': return 'evo'
    case '🌍': return 'eliteWin'
    case '🌅': return 'era'
    case '🔭': return 'veteran'
    case '🏁': return 'retire'
    case '🎫': case '📣': return 'title'
    case '🤝': return 'handoff'
    case '⏳': return 'danger'
    case '💥': return 'crisis'
    default: return 'toast'
  }
}

/**
 * Voice new toasts. Only ever plays for toasts that appeared since the last
 * render pass — on first mount it primes the seen-set silently, so loading a
 * save does not replay a fortnight of notifications at you.
 */
export function useToastSound(save) {
  const seen = useRef(null)
  useEffect(() => {
    const toasts = save?.toasts || []
    if (seen.current === null) {
      seen.current = new Set(toasts.map((t) => t.id))
      return
    }
    // Newest first, so walk backwards to voice them in the order they happened.
    for (let i = toasts.length - 1; i >= 0; i--) {
      const t = toasts[i]
      if (seen.current.has(t.id)) continue
      seen.current.add(t.id)
      play(cueForToast(t))
    }
    // The set would otherwise grow forever across a fifteen-year run.
    if (seen.current.size > 200) seen.current = new Set(toasts.map((t) => t.id))
  }, [save?.toasts])
}

/**
 * The run is over. A separate hook because a game over is not a toast — it is
 * the one moment the game stops, and it deserves its own sound.
 */
export function useRunEndSound(save) {
  const played = useRef(false)
  useEffect(() => {
    const over = !!(save?.gameOver || save?.economy?.foreclosed)
    if (over && !played.current) {
      played.current = true
      play('gameOver')
    }
    if (!over) played.current = false
  }, [save?.gameOver, save?.economy?.foreclosed])
}

/**
 * Browsers refuse to start audio until the user has interacted with the page.
 * One listener on the document, removed the moment it succeeds.
 */
export function useAudioUnlock() {
  useEffect(() => {
    const go = () => unlockAudio()
    document.addEventListener('pointerdown', go)
    document.addEventListener('keydown', go)
    return () => {
      document.removeEventListener('pointerdown', go)
      document.removeEventListener('keydown', go)
    }
  }, [])
}
