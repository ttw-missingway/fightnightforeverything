import { useEffect, useState } from 'react'
import { useStore } from '../state/store.jsx'
import { formatLocation } from '../game/constants.js'

/**
 * Opening night, as a moment rather than a state change.
 *
 * The counterpart to EvoIntro, and deliberately not the same trick: EVO parts
 * two curtains sideways onto a neon sign, because EVO is a stage. This is a
 * roller shutter going UP — vertical, slatted, with the light spilling out onto
 * the pavement as it clears — because an arcade is a room on a street, and the
 * first thing that ever happens to one is somebody unlocking it. The game
 * already says "the shutters are up, the cabinets are humming" on the arcade
 * screen; this is that sentence, once, with the lights coming on.
 *
 * Plays once per world. `save.grandOpening` gates it and is cleared on the way
 * out, so it can't reappear on a reload, and old saves migrate to false rather
 * than being handed an opening night for an arcade that has been running for a
 * year.
 */
export default function GrandOpening({ onDone }) {
  const { save } = useStore()
  const [open, setOpen] = useState(false)
  // A held beat on the closed shutter first. Without it the animation is
  // already running when the screen paints and there is nothing to open FROM.
  useEffect(() => {
    const t = setTimeout(() => setOpen(true), 600)
    return () => clearTimeout(t)
  }, [])
  const where = formatLocation(save?.arcade?.location)
  return (
    <div className={`go-stage${open ? ' open' : ''}`} onClick={onDone}>
      <div className="go-spill" />
      <div className="go-sign">
        <div className="go-eyebrow">The Grand Opening of</div>
        <div className="go-name">{save?.arcade?.name || 'The Arcade'}</div>
        {where && <div className="go-where">{where}</div>}
      </div>
      <div className="go-shutter">
        <div className="go-slats" />
        <div className="go-rail" />
      </div>
      <div className="go-skip small dim">click to continue</div>
    </div>
  )
}
