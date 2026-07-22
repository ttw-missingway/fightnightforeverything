import { useStore } from '../state/store.jsx'
import { isVodWatched } from '../game/model.js'

const typeIcon = (type) => (type === 'evo' ? '🌏' : type === 'teams' ? '🛡' : '🏆')

export default function Vods() {
  const { save, nav } = useStore()
  const vods = save.vods || []
  const unwatched = vods.filter((v) => !isVodWatched(v)).length

  return (
    <div>
      <div className="card">
        <h2 style={{ margin: 0 }}>📼 VODs {unwatched > 0 && <span className="pill on">{unwatched} new</span>}</h2>
        <span className="dim">
          Tournaments and EVO that streamed on {save.stream.channelName} while you were idling.
          Watch them back spoiler-free — nothing here reveals a winner until you press play.
        </span>
      </div>

      {vods.length === 0 ? (
        <div className="card">
          <p className="dim">
            No VODs yet. Turn on idle mode and let it run through a tournament or EVO day —
            the broadcast lands here so you can catch up without spoilers.
          </p>
          <button onClick={() => nav('arcade')}>Back to the arcade</button>
        </div>
      ) : (
        <div style={{ marginTop: 12 }}>
          {vods.map((v) => {
            const watched = isVodWatched(v)
            return (
              <div key={v.id} className="event match clickable" onClick={() => nav('tournament', { vodId: v.id })}>
                <div className="row spread">
                  <div>
                    <strong>{typeIcon(v.type)} {v.name}</strong>
                    <div className="dim small">{v.dateLabel} · {v.entrantCount} entrants</div>
                  </div>
                  <div className="col" style={{ alignItems: 'flex-end' }}>
                    {watched
                      ? <span className="small gold">🏆 {v.champion}</span>
                      : <span className="pill on">▶ new — not watched</span>}
                    {v.peakViewers > 0 && <span className="dim small">👁 peak {v.peakViewers} viewers</span>}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
