import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import MatchHud from './MatchHud.jsx'
import StreamChat from './StreamChat.jsx'
import { SpeechLine } from './ui.jsx'
import { tickWeights } from '../game/fight.js'

/**
 * One match, played back. This is the only place in the app that reveals a
 * narration — the daily setups, the tournament broadcast and the VOD player
 * all mount this.
 *
 * Matches AUTOPLAY. There is no "what happens next?" button: you press play
 * (or it starts itself), and the fight runs at reading speed with pause,
 * speed control, skip, and rewatch once it's over.
 *
 * Within a line, the health bars TICK. The engine records how many hits a
 * line landed and what shape they took (`meta.hits` / `meta.curve`); this
 * walks the bars from the previous snapshot to the current one across those
 * hits, so a seven-hit combo visibly prorates down instead of teleporting.
 * Lines with no `hits` — including every match recorded before the engine
 * stored it — simply step once, which is exactly the old behaviour.
 */

const FRESH = { hpA: 100, hpB: 100, mA: 0, mB: 0, gA: 0, gB: 0 }
const SPEEDS = [0.5, 1, 2]
const TICK_MS = 95

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

// How long a line holds the screen. Long beats need reading time; short ones
// shouldn't outstay their welcome. A ticking line always gets long enough to
// finish ticking first.
function dwellFor(line, meta) {
  const base = Math.min(3200, Math.max(900, 700 + (line?.length ?? 40) * 22))
  const hits = meta?.hits ?? 1
  return Math.max(base, hits > 1 ? hits * TICK_MS + 480 : 0)
}

export default function MatchPlayback({
  m,
  autoStart = false,
  spoil = false,          // already-concluded views: render whole, offer a rewatch
  showHud = true,
  startLabel = 'Watch the match',
  beforeStart = null,     // e.g. the "put this on stream" button — pre-playback only
  footer = null,          // rendered once playback finishes
  onStart = null,         // fired once, when the first line goes up
  onComplete = null,      // fired once, the first time it reaches the end
}) {
  // Memoised because these feed effect deps. `m.narrationMeta || []` would
  // hand back a FRESH array every render for any match recorded before the
  // engine stored tick data — the advance effect would reset its timer on
  // every render and playback would never move. Old VODs are exactly the
  // case that breaks.
  const lines = useMemo(() => m.narration || [], [m])
  const meta = useMemo(() => m.narrationMeta || [], [m])
  const hud = m.narrationHud || null
  const total = lines.length
  const reduce = useMemo(prefersReducedMotion, [])

  const [revealed, setRevealed] = useState(spoil ? total : 0)
  const [playing, setPlaying] = useState(!spoil && autoStart)
  const [speed, setSpeed] = useState(1)
  const [tick, setTick] = useState(1) // 0..1 of the current line's damage applied
  const [tickIndex, setTickIndex] = useState(0) // which hit of the line just landed
  // Are we actually WATCHING, as opposed to looking at a finished transcript?
  // `spoil` only describes how this mounted — the moment someone hits rewatch
  // on a recap or an old VOD, it's live playback and deserves the VFX.
  const [live, setLive] = useState(!spoil)
  const reported = useRef(false)
  const announced = useRef(spoil)
  const tailRef = useRef(null)

  const started = revealed > 0
  const finished = revealed >= total

  // --- ticking: walk the bars down the line that was just revealed --------
  useEffect(() => {
    if (revealed === 0 || !hud) { setTick(1); setTickIndex(0); return }
    const mi = meta[revealed - 1] || {}
    const hits = reduce ? 1 : Math.max(1, mi.hits || 1)
    setTickIndex(0)
    if (hits <= 1) { setTick(1); return }
    const w = tickWeights(hits, mi.curve)
    setTick(w[0])
    const timers = []
    let cum = w[0]
    for (let k = 1; k < hits; k++) {
      cum += w[k]
      const at = cum
      timers.push(setTimeout(() => { setTick(at); setTickIndex(k) }, (TICK_MS * k) / speed))
    }
    return () => timers.forEach(clearTimeout)
  }, [revealed, speed, reduce, hud, meta])

  // --- advancing ----------------------------------------------------------
  useEffect(() => {
    if (!playing || finished) return
    const delay = revealed === 0
      ? 300 / speed
      : dwellFor(lines[revealed - 1], meta[revealed - 1]) / speed
    const t = setTimeout(() => setRevealed((r) => Math.min(total, r + 1)), delay)
    return () => clearTimeout(t)
  }, [playing, revealed, speed, finished, total, lines, meta])

  useEffect(() => {
    if (!started || announced.current) return
    announced.current = true
    onStart?.()
  }, [started, onStart])

  useEffect(() => {
    if (!finished) return
    setPlaying(false)
    if (reported.current) return
    reported.current = true
    onComplete?.()
  }, [finished, onComplete])

  // Keep the newest line in view — by scrolling the NARRATION BOX, never the
  // page. Newest sits at the top of the list, so that's scrollTop 0.
  useEffect(() => {
    const el = tailRef.current
    if (!el) return
    el.scrollTo?.({ top: 0, behavior: reduce ? 'auto' : 'smooth' })
  }, [revealed, reduce])

  // Space toggles pause, as long as you're not typing into something.
  useEffect(() => {
    if (!started || finished) return
    const onKey = (e) => {
      if (e.code !== 'Space') return
      if (e.target?.closest?.('input, textarea, select, button')) return
      e.preventDefault()
      setPlaying((p) => !p)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [started, finished])

  // The bars as they should look RIGHT NOW, mid-tick.
  const hudState = useMemo(() => {
    if (!hud || revealed === 0) return null
    const now = hud[Math.min(revealed, hud.length) - 1]
    if (!now || tick >= 1) return now || null
    const prev = revealed > 1 ? hud[revealed - 2] : FRESH
    return {
      ...now,
      hpA: Math.round(prev.hpA + (now.hpA - prev.hpA) * tick),
      hpB: Math.round(prev.hpB + (now.hpB - prev.hpB) * tick),
    }
  }, [hud, revealed, tick])

  // The VFX firing right now. One per TICK, so a multi-hit combo sparks per
  // hit; the projectile only flies on the first (it's one volley, not seven
  // separate crossings). Matches recorded before the engine emitted fx fall
  // back to a plain impact derived from which bar moved.
  const pulse = useMemo(() => {
    if (!started || !live || reduce) return null
    const mi = meta[revealed - 1]
    if (!mi || mi.kind === 'bell') return null
    let fx = mi.fx
    if (!fx && hud) {
      const now = hud[revealed - 1]
      const prev = revealed > 1 ? hud[revealed - 2] : FRESH
      if (!now) return null
      const dA = prev.hpA - now.hpA
      const dB = prev.hpB - now.hpB
      const drop = Math.max(dA, dB)
      if (drop <= 0) return null
      fx = { t: 'impact', side: dA > dB ? 'A' : 'B', mag: Math.min(1, drop / 42) }
    }
    if (!fx) return null
    return {
      ...fx,
      // A projectile volley crosses once, then just keeps connecting.
      t: fx.t === 'projectile' && tickIndex > 0 ? 'impact' : fx.t,
      // Only the last hit of a line can be the knockout.
      ko: fx.ko && tickIndex >= ((mi.hits || 1) - 1),
      key: `${revealed}-${tickIndex}`,
    }
  }, [started, live, reduce, meta, revealed, tickIndex, hud])

  const rewatch = () => { setLive(true); setTick(1); setTickIndex(0); setRevealed(0); setPlaying(true) }
  const skip = () => { setTick(1); setRevealed(total) }

  // Everything that has happened, oldest first, then flipped for display.
  // Newest-at-top means the line that just landed is always in the same place
  // — right under the fight screen — instead of marching down the page and
  // dragging your eye off the footage.
  const blocks = []
  for (const [i, sp] of (m.preMatch || []).entries()) {
    blocks.push({ key: `pre${i}`, node: <SpeechLine s={sp} /> })
  }
  for (let i = 0; i < revealed; i++) {
    blocks.push({ key: `l${i}`, node: <p>{lines[i]}</p> })
    for (const [j, c] of (m.chatter || []).filter((c) => c.at === i).entries()) {
      blocks.push({ key: `c${i}-${j}`, node: <SpeechLine s={c} /> })
    }
  }
  if (finished) {
    for (const [i, sp] of (m.postMatch || []).entries()) {
      blocks.push({ key: `post${i}`, node: <SpeechLine s={sp} /> })
    }
  }
  blocks.reverse()

  const controls = (
    <div className="playback-controls">
      {!started && !spoil && (
        <button className="small primary" onClick={() => { setLive(true); setPlaying(true) }}>▶ {startLabel}</button>
      )}
      {started && !finished && (
        <>
          <button className="small" onClick={() => setPlaying((p) => !p)}>
            {playing ? '⏸ Pause' : '▶ Resume'}
          </button>
          <button
            className="small"
            title="playback speed"
            onClick={() => setSpeed(SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length])}
          >
            {speed}×
          </button>
          <button className="small" onClick={skip}>⏭ Skip to result</button>
          <span className="dim small">{revealed}/{total}</span>
        </>
      )}
      {finished && total > 0 && (
        <button className="small" onClick={rewatch}>↻ Rewatch</button>
      )}
    </div>
  )

  const body = (
    <div>
      {controls}
      {/* Fixed height, own scrollbar: the page never grows, so the fight
          screen above stays exactly where it is for the whole match. */}
      <div className="narration narration-scroll" ref={tailRef}>
        {blocks.map((b) => <Fragment key={b.key}>{b.node}</Fragment>)}
      </div>
      {finished && footer}
    </div>
  )

  return (
    <>
      {showHud && m.narrationHud && (
        <MatchHud m={m} revealed={revealed} state={hudState} pulse={pulse} shakeKey={started ? revealed : null} />
      )}
      {!started && beforeStart}
      {m.stream ? (
        <div className="stream-split">
          {body}
          <StreamChat stream={m.stream} revealed={revealed} />
        </div>
      ) : body}
    </>
  )
}
