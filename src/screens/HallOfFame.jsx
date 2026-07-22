import { useState } from 'react'
import { useStore } from '../state/store.jsx'
import { ordinal } from './Tournament.jsx'
import { displayName } from '../game/util.js'
import { formatDay } from '../game/constants.js'

export default function HallOfFame() {
  const { save, nav } = useStore()
  const [tab, setTab] = useState('records')
  const records = [...save.hallOfFame].reverse()
  const players = Object.values(save.players)
  const mostGlorious = [...players].sort((a, b) => b.glory - a.glory).slice(0, 5).filter((p) => p.glory > 0)
  const evoLegends = [...save.evoRoster].sort((a, b) => (b.titles || 0) - (a.titles || 0)).filter((e) => e.titles > 0)

  if (tab === 'chronicle') {
    return (
      <div>
        <HofTabs tab={tab} setTab={setTab} count={(save.chronicle || []).length} />
        <h1 style={{ fontSize: 30 }}>📜 The Arcade Chronicle</h1>
        <p className="dim">The moments everyone remembers — told and retold until they're legend.</p>
        {(save.chronicle || []).length === 0 && (
          <div className="card"><p className="dim">Nothing legendary has happened yet. Give it time — or force the issue.</p></div>
        )}
        <div className="card">
          {(save.chronicle || []).map((c, i) => (
            <div className="row spread" key={i} style={{ borderBottom: '1px solid var(--border)', padding: '6px 0' }}>
              <span>{c.icon} {c.text}</span>
              <span className="dim small" style={{ whiteSpace: 'nowrap' }}>{formatDay(c.day, c.year)}</span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div>
      <HofTabs tab={tab} setTab={setTab} count={(save.chronicle || []).length} />
      <h1 style={{ fontSize: 30 }}>🏛 Hall of Fame</h1>

      <div className="grid2">
        <div className="card">
          <h3 className="gold">Most Glorious</h3>
          {mostGlorious.length === 0 && <p className="dim">Nobody has earned glory yet. Win tournaments. Go to EVO.</p>}
          {mostGlorious.map((p, i) => (
            <div className="row spread" key={p.id} style={{ padding: '3px 0' }}>
              <span className="clickable" style={{ cursor: 'pointer' }} onClick={() => nav('players', { playerId: p.id })}>
                {['🥇', '🥈', '🥉', '', ''][i]} {displayName(p, save)}
              </span>
              <span className="gold">{Math.round(p.glory)} glory</span>
            </div>
          ))}
        </div>
        <div className="card">
          <h3 className="cyan">World Champions (EVO legends)</h3>
          {evoLegends.length === 0 && <p className="dim">No EVO has been decided yet.</p>}
          {evoLegends.map((e) => (
            <div className="row spread" key={e.id} style={{ padding: '3px 0' }}>
              <span>{e.alias} <span className="dim small">[{e.region}]</span></span>
              <span className="gold">{'🏆'.repeat(Math.min(e.titles, 8))}</span>
            </div>
          ))}
        </div>
      </div>

      <h2>Tournament Results</h2>
      {records.length === 0 && <div className="card"><p className="dim">No tournaments have been held yet.</p></div>}
      {records.map((r) => (
        <div className="card" key={r.id} style={r.type === 'evo' ? { borderColor: 'var(--gold)' } : {}}>
          <div className="row spread">
            <h3 style={{ margin: 0 }}>
              {r.type === 'evo' ? '🌏' : r.type === 'teams' ? '🛡' : '🏆'} {r.name}
            </h3>
            <span className="dim small">{r.dateLabel} · {r.entrantCount} entrants</span>
          </div>
          <p className="gold" style={{ margin: '6px 0' }}>Champion: {r.champion}</p>
          <div className="row">
            {(r.placements || []).slice(0, 8).map((pl, i) => (
              <span key={i} className={`pill ${pl.arcade ? 'on' : ''}`}>
                {ordinal(pl.place)} — {pl.name}
              </span>
            ))}
          </div>
          {r.arcadeResults && r.arcadeResults.length > 0 && (
            <p className="small cyan" style={{ marginBottom: 0 }}>
              Arcade crew: {r.arcadeResults.map((a) => `${a.name} (${ordinal(a.place)})`).join(' · ')}
            </p>
          )}
        </div>
      ))}
    </div>
  )
}

function HofTabs({ tab, setTab, count }) {
  return (
    <div className="tabs">
      <button className={tab === 'records' ? 'active' : ''} onClick={() => setTab('records')}>🏛 Hall of Fame</button>
      <button className={tab === 'chronicle' ? 'active' : ''} onClick={() => setTab('chronicle')}>
        📜 Arcade Chronicle ({count})
      </button>
    </div>
  )
}
