import { useState } from 'react'
import { useStore } from '../state/store.jsx'
import { worldRankings, rankedWorld, cutoffElo, bestRanked, theClimb, dossier, TIER_LABEL, WORLD_RANK_SIZE } from '../game/world.js'
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
  const [openId, setOpenId] = useState(null)
  const rows = worldRankings(save)
  const mine = bestRanked(save)
  const climb = theClimb(save)
  const cutoff = cutoffElo(save)
  const shown = scope === 'mine' ? rows.filter((r) => r.yours) : rankedWorld(save)

  const charName = (r) => {
    const c = save.game.characters.find((x) => x.id === r.charId)
    if (!c) return null
    return r.yours ? lookOf(r.id, c).name : c.name
  }

  if (openId) {
    return <Dossier save={save} id={openId} back={() => setOpenId(null)} nav={nav} />
  }

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>🌍 World Rankings</h2>
      <p className="dim small" style={{ marginTop: 0 }}>
        The top {WORLD_RANK_SIZE} competitors on earth, by elo. It is a fixed number of PLACES — when one
        of yours climbs onto the list, somebody drops off it.
      </p>

      <div className="grid2">
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Your best</h3>
          {mine ? (
            <>
              <div className="row spread">
                <span className="clickable cyan" style={{ cursor: 'pointer', fontSize: 18 }}
                  onClick={() => nav('players', { playerId: mine.id })}>
                  <strong>{mine.flag} {mine.name}</strong>
                </span>
                {mine.rank != null
                  ? <span className="gold" style={{ fontSize: 22, fontWeight: 700 }}>#{mine.rank}</span>
                  : <span className="dim" style={{ fontSize: 16 }}>unranked</span>}
              </div>
              {/* No invented placing. Below the cut there is no number to give
                  them — only the gap they have to close. */}
              <p className="dim small" style={{ margin: '4px 0 0' }}>
                {mine.elo} elo{charName(mine) ? ` · ${charName(mine)}` : ''}
                {mine.rank != null
                  ? ` · on the world list`
                  : ` · ${Math.max(1, cutoff - mine.elo)} elo short of the cut (#${WORLD_RANK_SIZE} sits at ${cutoff})`}
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
                <div className="row spread clickable" key={r.id} style={{ padding: '2px 0', cursor: 'pointer' }}
                  onClick={() => (r.yours ? nav('players', { playerId: r.id }) : setOpenId(r.id))}>
                  <span className="small">
                    <span className="dim">#{r.rank}</span> {r.flag} {r.name}
                  </span>
                  <span className="dim small">{r.elo}</span>
                </div>
              ))}
              <p className="dim small" style={{ margin: '6px 0 0' }}>
                {mine && mine.rank == null
                  ? 'The bottom of the world list. Take elo off people like these and you are on it.'
                  : 'Four people between yours and the next rung. Beating one of these is a real night.'}
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
            <tr><th>#</th><th>Player</th><th>Scene</th><th>Main</th><th>Elo</th><th>Skill</th><th>EVO</th></tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.id} className={`clickable${r.yours ? ' world-mine' : ''}`}
                onClick={() => (r.yours ? nav('players', { playerId: r.id }) : setOpenId(r.id))}
                style={r.retired ? { opacity: 0.45 } : undefined}>
                <td className="dim">{r.rank ?? <span title="not in the world top 64">—</span>}</td>
                <td>
                  <span className="row" style={{ gap: 6, flexWrap: 'nowrap', alignItems: 'center' }}>
                    {r.charId && (() => {
                      const c = save.game.characters.find((x) => x.id === r.charId)
                      return c ? <Portrait url={lookArt(c, r.id)} size={20} alt={c.name} /> : null
                    })()}
                    <span title={r.region === 'home' ? save.arcade.name : r.region}>{r.flag}</span>
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

/**
 * A ranked competitor's file.
 *
 * Elites keep no history of their own — between tournaments they are a name
 * and an elo — so everything here is reconstructed from broadcasts you still
 * have. That is the honest answer to "what do you know about this person?":
 * you know what you watched, and nothing before you started watching.
 */
function Dossier({ save, id, back, nav }) {
  const d = dossier(save, id)
  if (!d) {
    return <div className="card"><p className="dim">No file on that competitor.</p>
      <button onClick={back}>← Back to the rankings</button></div>
  }
  const { row, bouts, record, vsYou, majors } = d
  const char = save.game.characters.find((c) => c.id === row.charId)
  const elite = (save.evoRoster || []).find((e) => e.id === id)

  return (
    <div>
      <button onClick={back}>← Back to the rankings</button>
      <div className="card" style={{ borderColor: row.yours ? 'var(--cyan)' : 'var(--border)' }}>
        <div className="row spread">
          <div>
            <h1 style={{ fontSize: 30, margin: '2px 0' }}>{row.flag} {row.name}</h1>
            {elite && <div className="dim">{elite.firstName} {elite.lastName} · {elite.region}</div>}
            <div className="small" style={{ marginTop: 4 }}>{TIER_LABEL[row.tier] || 'Ranked competitor'}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div className="gold" style={{ fontSize: 30, fontWeight: 700 }}>#{row.rank}</div>
            <div className="dim small">in the world</div>
          </div>
        </div>
      </div>

      <div className="grid3">
        <div className="card"><h4 className="dim" style={{ margin: 0 }}>Elo</h4>
          <div style={{ fontSize: 24, fontWeight: 700 }}>{row.elo}</div></div>
        <div className="card"><h4 className="dim" style={{ margin: 0 }}>Skill</h4>
          <div className="cyan" style={{ fontSize: 24, fontWeight: 700 }}>{row.skill || '—'}</div></div>
        <div className="card"><h4 className="dim" style={{ margin: 0 }}>EVO titles</h4>
          <div className="gold" style={{ fontSize: 24, fontWeight: 700 }}>{row.titles || 0}</div></div>
      </div>

      <div className="grid2">
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Main</h3>
          {char ? (
            <div className="row" style={{ gap: 8 }}>
              <Portrait url={lookArt(char, row.id)} size={34} alt={char.name} />
              <span><strong>{char.name}</strong><br /><span className="dim small">{char.archetype}</span></span>
            </div>
          ) : <p className="dim">Nobody has seen what they play.</p>}
        </div>
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Against your arcade</h3>
          {vsYou.w + vsYou.l === 0 ? (
            <p className="dim small">Never faced anyone of yours. That's the whole idea, isn't it.</p>
          ) : (
            <>
              <div style={{ fontSize: 22, fontWeight: 700 }}>
                <span className="red">{vsYou.w}</span><span className="dim"> – </span><span className="green">{vsYou.l}</span>
              </div>
              <p className="dim small" style={{ margin: '2px 0 6px' }}>their record against your people</p>
              {vsYou.bouts.slice(0, 4).map((b) => (
                <div className="row spread small" key={b.matchId} style={{ padding: '1px 0' }}>
                  <span className={b.won ? 'dim' : 'green'}>{b.won ? 'beat' : 'lost to'} {b.opponent}</span>
                  <span className="dim">{b.score}</span>
                </div>
              ))}
            </>
          )}
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>At the majors</h3>
        {majors.length === 0 ? (
          <p className="dim small" style={{ marginBottom: 0 }}>
            No EVO finish on record — either they haven't placed while you've been running this
            arcade, or they haven't placed at all.
          </p>
        ) : majors.map((mj, i) => (
          <div className="row spread" key={i} style={{ padding: '3px 0' }}>
            <span className="small">{mj.event}</span>
            <span className={mj.place === 1 ? 'gold' : mj.place <= 8 ? 'cyan' : 'dim'}>
              {mj.place === 1 ? '🏆 Champion' : `${ordinalish(mj.place)}`}
            </span>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="row spread">
          <h3 style={{ margin: 0 }}>What you've watched them do</h3>
          <span className="dim small">{record.w}–{record.l} on tape</span>
        </div>
        {bouts.length === 0 ? (
          <p className="dim small" style={{ marginBottom: 0 }}>
            Nothing on tape. You've never had a broadcast with them in it.
          </p>
        ) : bouts.slice(0, 12).map((b) => (
          <div className="row spread" key={b.matchId} style={{ borderBottom: '1px solid var(--border)', padding: '4px 0' }}>
            <span className="small">
              <span className={b.won ? 'gold' : 'dim'}>{b.won ? 'W' : 'L'}</span>
              {' '}vs <span className={b.versusYou ? 'cyan' : ''}>{b.opponent}</span>
              <span className="dim"> · {b.event} · {b.round}</span>
            </span>
            <span className="dim small">{b.score}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

const ordinalish = (n) => {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}
