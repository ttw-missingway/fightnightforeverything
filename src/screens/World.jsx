import { useState } from 'react'
import { useStore } from '../state/store.jsx'
import { worldRankings, bestRanked, theClimb } from '../game/world.js'
import { lookOf } from '../game/skins.js'
import { Portrait } from '../components/ui.jsx'
import { lookArt } from '../components/art.js'

/**
 * The world rankings — the one screen that is not about your arcade.
 *
 * Open from the first day of a lineage and never locked, because its whole job
 * is to be the thing you are aiming at. It is deliberately unflattering: a
 * freshly created player sits somewhere in the seventies behind sixty-four
 * people who have been doing this for years, and the only way the number moves
 * is elo, which only moves by actually beating people.
 */
export default function World() {
  const { save, nav } = useStore()
  const [scope, setScope] = useState('top')
  const rows = worldRankings(save)
  const mine = bestRanked(save)
  const climb = theClimb(save)
  const shown = scope === 'mine' ? rows.filter((r) => r.yours) : rows.slice(0, 64)

  const charName = (r) => {
    const c = save.game.characters.find((x) => x.id === r.charId)
    if (!c) return null
    return r.yours ? lookOf(r.id, c).name : c.name
  }

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>🌍 World Rankings</h2>
      <p className="dim small" style={{ marginTop: 0 }}>
        Every ranked competitor on earth, by elo. Your people are on this ladder from the day you
        make them — a long way down it.
      </p>

      <div className="grid2">
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Your best</h3>
          {mine ? (
            <>
              <div className="row spread">
                <span className="clickable cyan" style={{ cursor: 'pointer', fontSize: 18 }}
                  onClick={() => nav('players', { playerId: mine.id })}>
                  <strong>{mine.name}</strong>
                </span>
                <span className="gold" style={{ fontSize: 22, fontWeight: 700 }}>#{mine.rank}</span>
              </div>
              <p className="dim small" style={{ margin: '4px 0 0' }}>
                {mine.elo} elo{charName(mine) ? ` · ${charName(mine)}` : ''}
                {mine.rank <= 64
                  ? ' · ranked in the world top 64'
                  : ` · ${mine.rank - 64} place${mine.rank - 64 === 1 ? '' : 's'} off the top 64`}
              </p>
            </>
          ) : (
            <p className="dim">You haven't made anybody yet.</p>
          )}
        </div>

        <div className="card">
          <h3 style={{ marginTop: 0 }}>Next up the ladder</h3>
          {climb.length ? (
            <>
              {climb.map((r) => (
                <div className="row spread" key={r.id} style={{ padding: '2px 0' }}>
                  <span className="small"><span className="dim">#{r.rank}</span> {r.name}
                    {r.region !== 'home' && <span className="dim"> [{r.region}]</span>}</span>
                  <span className="dim small">{r.elo}</span>
                </div>
              ))}
              <p className="dim small" style={{ margin: '6px 0 0' }}>
                Four people between yours and the next rung. Beating one of these is a real night.
              </p>
            </>
          ) : (
            <p className="dim small">Nobody above you. That is not a sentence this game expects to print.</p>
          )}
        </div>
      </div>

      <div className="tabs">
        <button className={scope === 'top' ? 'active' : ''} onClick={() => setScope('top')}>🌍 World top 64</button>
        <button className={scope === 'mine' ? 'active' : ''} onClick={() => setScope('mine')}>🏠 My cast</button>
      </div>

      <div className="card">
        <div className="table-scroll"><table>
          <thead>
            <tr><th>#</th><th>Player</th><th>Region</th><th>Main</th><th>Elo</th><th>Skill</th><th>EVO</th></tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.id} className={r.yours ? 'clickable world-mine' : undefined}
                onClick={r.yours ? () => nav('players', { playerId: r.id }) : undefined}
                style={r.retired ? { opacity: 0.45 } : undefined}>
                <td className="dim">{r.rank}</td>
                <td>
                  <span className="row" style={{ gap: 6, flexWrap: 'nowrap', alignItems: 'center' }}>
                    {r.charId && (() => {
                      const c = save.game.characters.find((x) => x.id === r.charId)
                      return c ? <Portrait url={lookArt(c, r.id)} size={20} alt={c.name} /> : null
                    })()}
                    <strong className={r.yours ? 'cyan' : ''}>{r.name}</strong>
                    {r.retired && <span className="dim small"> 🏁</span>}
                  </span>
                </td>
                <td className="dim small">{r.region === 'home' ? save.arcade.name : r.region}</td>
                <td className="small">{charName(r) || <span className="dim">—</span>}</td>
                <td>{r.elo}</td>
                <td className="cyan">{r.skill || <span className="dim">—</span>}</td>
                <td className="gold">{r.titles ? '🏆'.repeat(Math.min(r.titles, 5)) : ''}</td>
              </tr>
            ))}
          </tbody>
        </table></div>
        {scope === 'mine' && shown.length === 0 && <p className="dim">No players yet.</p>}
      </div>
    </div>
  )
}
