import { useState } from 'react'
import { useStore } from '../state/store.jsx'
import { isVodWatched } from '../game/model.js'

const typeIcon = (type) =>
  type === 'evo' ? '🌏' : type === 'teams' ? '🛡' : type === 'moneymatch' ? '💸' : '🏆'

export default function Vods() {
  const { save, nav } = useStore()
  const vods = save.vods || []
  const archives = (save.archives || []).filter((a) => (a.vods || []).length)
  const [showRun, setShowRun] = useState(null) // archive run number, or null = current
  const archive = archives.find((a) => a.run === showRun)
  const list = archive ? archive.vods : vods
  const unwatched = vods.filter((v) => !isVodWatched(v)).length

  return (
    <div>
      <div className="card">
        <h2 style={{ margin: 0 }}>📼 VODs {unwatched > 0 && <span className="pill on">{unwatched} new</span>}</h2>
        <span className="dim">
          Tournaments, EVO, and money matches broadcast on {save.stream.channelName}.
          Watch them back spoiler-free — nothing here reveals a winner until you press play.
        </span>
        {archives.length > 0 && (
          <div className="tabs" style={{ marginTop: 8, marginBottom: 0 }}>
            <button className={`small ${showRun === null ? 'active' : ''}`} onClick={() => setShowRun(null)}>
              This run
            </button>
            {archives.map((a) => (
              <button key={a.run} className={`small ${showRun === a.run ? 'active' : ''}`}
                onClick={() => setShowRun(a.run)}>
                🗄 Run {a.run} <span className="dim">(ended {a.endedDateLabel})</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {list.length === 0 ? (
        <div className="card">
          <p className="dim">
            {archive
              ? 'No broadcasts survive from that run.'
              : 'No VODs yet. Tournaments, EVO, and money matches all land here as they happen — watch back spoiler-free anytime.'}
          </p>
          <button onClick={() => nav('arcade')}>Back to the arcade</button>
        </div>
      ) : (
        <div style={{ marginTop: 12 }}>
          {list.map((v) => {
            const watched = isVodWatched(v)
            return (
              <div key={v.id} className={`event match ${archive ? '' : 'clickable'}`}
                onClick={archive ? undefined : () => nav('tournament', { vodId: v.id })}>
                <div className="row spread">
                  <div>
                    <strong>{typeIcon(v.type)} {v.name}</strong>
                    <div className="dim small">
                      {v.dateLabel}
                      {v.type !== 'moneymatch' && <> · {v.entrantCount} entrants</>}
                    </div>
                  </div>
                  <div className="col" style={{ alignItems: 'flex-end' }}>
                    {watched || archive
                      ? <span className="small gold">🏆 {v.champion}</span>
                      : <span className="pill on">▶ new — not watched</span>}
                    {v.peakViewers > 0 && <span className="dim small">👁 peak {v.peakViewers} viewers</span>}
                  </div>
                </div>
              </div>
            )
          })}
          {archive && (
            <p className="dim small">
              Archived broadcasts are records of a past run — results shown, playback retired.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
