import { useStore } from '../state/store.jsx'
import { runDangers } from '../game/danger.js'

/**
 * The "you are about to lose" banner.
 *
 * Rendered above the tab content in App, so it is on screen no matter which
 * page the owner is looking at. That placement is the entire point of the
 * feature: the counters behind these warnings had been ticking for days, but
 * the only notice anyone ever got was two recap lines that scrolled away, so
 * the first real signal was the game-over modal.
 *
 * Every row says what is wrong, how many days are left, and what to do about
 * it — a countdown with no lever attached is just anxiety — and clicking
 * through lands on the screen where the fix lives.
 *
 * Shows nothing when nothing is wrong. A banner that is always up is wallpaper.
 */
export default function DangerBanner() {
  const { save, nav } = useStore()
  const dangers = runDangers(save)
  if (!dangers.length) return null
  return (
    <div className="dangers">
      {dangers.map((d) => (
        <div key={d.key} className={`danger ${d.severity}`}>
          <span className="d-icon">{d.icon}</span>
          <div>
            <div className="d-title">{d.title}</div>
            <div className="d-detail">{d.detail}</div>
            <div className="d-fix">{d.fix}</div>
          </div>
          {d.to && (
            <button className="d-go" onClick={() => nav(d.to)}>Go →</button>
          )}
        </div>
      ))}
    </div>
  )
}
