import { useState } from 'react'
import { useStore } from '../state/store.jsx'
import { displayName } from '../game/util.js'
import { getRel, relLabel } from '../game/social.js'
import { formatDay } from '../game/constants.js'

export default function Teams() {
  const { save, nav } = useStore()
  const teams = Object.values(save.teams)

  return (
    <div>
      <h2>Teams</h2>
      {teams.length === 0 && (
        <div className="card">
          <p className="dim">
            No teams yet. Community-minded players will found teams with their friends as friendships form —
            and once one team exists, rivals will want their own banner. Teams with 4+ members can enter team battles.
          </p>
        </div>
      )}
      <div className="grid2">
        {teams.map((t) => <TeamCard key={t.id} team={t} save={save} nav={nav} />)}
      </div>
    </div>
  )
}

function TeamCard({ team: t, save, nav }) {
  const [tab, setTab] = useState('members') // 'members' | 'history'
  const members = t.memberIds.map((id) => save.players[id]).filter(Boolean)
    .sort((a, b) => b.elo - a.elo)
  const avgElo = members.length ? Math.round(members.reduce((s, p) => s + p.elo, 0) / members.length) : 0
  const history = [...(t.history || [])].reverse()
  const milestones = history.filter((h) => h.text.startsWith('🏆') || h.text.includes('EVO'))

  return (
    <div className="card">
      <div className="row spread">
        <h3 style={{ margin: 0 }}>{t.name} <span className="pink">[{t.acronym}]</span></h3>
        <span className={`pill ${members.length >= 4 ? 'on' : ''}`}>
          {members.length >= 4 ? 'tournament ready' : `${members.length}/4 for team battles`}
        </span>
      </div>
      <p className="dim small">avg elo {avgElo}</p>

      {milestones.length > 0 && (
        <div style={{ marginBottom: 6 }}>
          {milestones.map((m, i) => (
            <span key={i} className="pill gold" style={{ borderColor: 'var(--gold)' }}>{m.text}</span>
          ))}
        </div>
      )}

      <div className="tabs" style={{ marginBottom: 8 }}>
        <button className={`small ${tab === 'members' ? 'active' : ''}`} onClick={() => setTab('members')}>Members</button>
        <button className={`small ${tab === 'history' ? 'active' : ''}`} onClick={() => setTab('history')}>
          History ({history.length})
        </button>
      </div>

      {tab === 'members' && (
        <table>
          <tbody>
            {members.map((p, i) => {
              const founder = p.id === t.founderId
              const others = members.filter((m) => m.id !== p.id)
              const avgRel = others.length
                ? others.reduce((s, m) => s + getRel(p, m), 0) / others.length : 0
              return (
                <tr key={p.id} className="clickable" onClick={() => nav('players', { playerId: p.id })}>
                  <td>{displayName(p, save)} {founder && <span className="gold small">★ founder</span>}
                    {i < 4 && <span className="cyan small"> (starter)</span>}</td>
                  <td className="dim">{Math.round(p.elo)}</td>
                  <td className={`small ${avgRel >= 10 ? 'green' : avgRel <= -10 ? 'red' : 'dim'}`}>
                    {relLabel(avgRel)} w/ team
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}

      {tab === 'history' && (
        <div>
          {history.length === 0 && <p className="dim small">Nothing has happened yet.</p>}
          {history.map((h, i) => (
            <div key={i} className="row spread" style={{ borderBottom: '1px solid var(--border)', padding: '3px 0' }}>
              <span className="small">{h.text}</span>
              <span className="dim small">{formatDay(h.day, h.year)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
