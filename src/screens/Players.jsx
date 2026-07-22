import { useState } from 'react'
import { useStore } from '../state/store.jsx'
import { StatBar, moodFace } from '../components/ui.jsx'
import PlayerForm from '../components/PlayerForm.jsx'
import { PERSONAL_STATS, SOCIAL_STATS } from '../game/constants.js'
import { relLabel, moodLabel } from '../game/social.js'
import { displayName } from '../game/util.js'
import { skillCap } from '../game/match.js'
import { voiceSummary } from '../game/dialogue.js'

const SORTS = {
  name: (p) => (p.alias || p.firstName).toLowerCase(),
  elo: (p) => p.elo,
  wins: (p) => p.wins,
  glory: (p) => p.glory,
  respect: (p) => p.respect,
  mood: (p) => p.mood,
}

export default function Players() {
  const { save, screen, nav, mutate } = useStore()
  const [editing, setEditing] = useState(false)
  const [sortKey, setSortKey] = useState('elo')
  const [sortAsc, setSortAsc] = useState(false)
  const selId = screen.playerId || null
  const players = Object.values(save.players).sort((a, b) => {
    const ka = SORTS[sortKey](a)
    const kb = SORTS[sortKey](b)
    const cmp = typeof ka === 'string' ? ka.localeCompare(kb) : ka - kb
    return sortAsc ? cmp : -cmp
  })
  const sel = save.players[selId]

  const sortBy = (key) => {
    if (sortKey === key) setSortAsc(!sortAsc)
    else { setSortKey(key); setSortAsc(key === 'name') }
  }
  const Th = ({ k, children }) => (
    <th style={{ cursor: 'pointer', whiteSpace: 'nowrap' }} onClick={() => sortBy(k)}>
      {children}{sortKey === k ? (sortAsc ? ' ▲' : ' ▼') : ''}
    </th>
  )

  if (sel) {
    return (
      <PlayerDetail
        save={save} player={sel} mutate={mutate}
        editing={editing} setEditing={setEditing}
        back={() => { setEditing(false); nav('players') }}
        goTo={(id) => { setEditing(false); nav('players', { playerId: id }) }}
      />
    )
  }

  return (
    <div className="card">
      <h2 style={{ marginTop: 0 }}>Leaderboard <span className="dim small">(click a column to sort)</span></h2>
      <div className="table-scroll"><table>
        <thead>
          <tr>
            <th>#</th>
            <Th k="name">Player</Th>
            <th>Main</th>
            <Th k="elo">Elo</Th>
            <Th k="wins">W–L</Th>
            <Th k="glory">Glory</Th>
            <Th k="respect">Respect</Th>
            <Th k="mood">Mood</Th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {players.map((p, i) => {
            const main = save.game.characters.find((c) => c.id === p.mainCharId)
            return (
              <tr key={p.id} className="clickable" onClick={() => nav('players', { playerId: p.id })}>
                <td className="dim">{i + 1}</td>
                <td><strong>{displayName(p, save)}</strong><br />
                  <span className="dim small">{p.firstName} {p.lastName}</span></td>
                <td className="cyan">
                  {main ? main.name : '—'}
                  {main && !p.settledMain && <span className="dim small"> (trying out)</span>}
                </td>
                <td>{Math.round(p.elo)}</td>
                <td className="dim">{p.wins}–{p.losses}</td>
                <td className="gold">{Math.round(p.glory)}</td>
                <td className="dim">{Math.round(p.respect)}</td>
                <td title={moodLabel(p.mood)}>{moodFace(p.mood)}</td>
                <td className="dim small">{p.isRegular ? 'regular' : 'not yet visited'}</td>
              </tr>
            )
          })}
        </tbody>
      </table></div>
      {players.length === 0 && <p className="dim">No players exist yet.</p>}
    </div>
  )
}

function PlayerDetail({ save, player: p, mutate, editing, setEditing, back, goTo }) {
  const main = save.game.characters.find((c) => c.id === p.mainCharId)
  const team = p.teamId ? save.teams[p.teamId] : null
  const rels = Object.entries(p.relationships)
    .map(([id, v]) => ({ other: save.players[id], v }))
    .filter((r) => r.other)
    .sort((a, b) => b.v - a.v)
  const mentorship = save.mentorships.find((m) => m.mentorId === p.id || m.studentId === p.id)
  const knownInnovs = save.innovations.filter((i) => p.knownInnovations.includes(i.id))
  const createdInnovs = save.innovations.filter((i) => i.creatorId === p.id)

  const patch = (fn) => mutate((s) => {
    const live = s.players[p.id]
    if (live) fn(live)
  })

  return (
    <div>
      <div className="row spread">
        <button onClick={back}>← Leaderboard</button>
        <button onClick={() => setEditing(!editing)}>{editing ? 'Done editing' : '✎ Edit player'}</button>
      </div>

      <div className="card">
        <h2 style={{ margin: '4px 0' }}>{displayName(p, save)} {moodFace(p.mood)}</h2>
        <p className="dim">
          {p.firstName} "{p.alias || '—'}" {p.lastName} · {p.gender} · {p.createdBy === 'user' ? 'created player' : 'generated player'}
          {p.description && <> · {p.description}</>}
        </p>
        {p.catchphrase && <p className="cyan" style={{ margin: '2px 0' }}>“{p.catchphrase}”</p>}
        {p.voice && <p className="dim small" style={{ margin: '2px 0' }}>🗣 {voiceSummary(p.voice)}</p>}
        {(p.playerTags || []).length > 0 && (
          <div style={{ marginBottom: 4 }}>
            {p.playerTags.map((t) => <span key={t} className="pill">{t}</span>)}
          </div>
        )}
        <div className="row">
          <span className="pill">Elo {Math.round(p.elo)}</span>
          <span className="pill gold">Glory {Math.round(p.glory)}</span>
          <span className="pill">Respect {Math.round(p.respect)}</span>
          <span className="pill">{p.wins}–{p.losses}</span>
          <span className="pill">Mood: {moodLabel(p.mood)}</span>
          {main && p.settledMain && <span className="pill on">Mains {main.name}{p.lockedMain ? ' 🔒' : ''}</span>}
          {main && !p.settledMain && <span className="pill">🔍 Exploring — {main.name} today ({(p.exploredChars || []).length} tried)</span>}
          {team && <span className="pill gold">{team.name} [{team.acronym}]</span>}
          {p.tournamentWins > 0 && <span className="pill gold">🏆 ×{p.tournamentWins}</span>}
        </div>
      </div>

      {editing && (
        <div className="card">
          <PlayerForm save={save} player={p} patch={patch} />
        </div>
      )}

      <div className="grid2">
        <div className="card">
          <h3>Personal Stats</h3>
          {PERSONAL_STATS.map(([k, desc]) => <StatBar key={k} label={k} value={p.personal[k]} title={desc} />)}
          <h3>Social Stats</h3>
          {SOCIAL_STATS.map(([k, desc]) => <StatBar key={k} label={k} value={p.social[k]} title={desc} />)}
        </div>

        <div className="card">
          <h3>Character Skill</h3>
          {Object.entries(p.charSkill).sort((a, b) => b[1] - a[1]).map(([cid, v]) => {
            const c = save.game.characters.find((x) => x.id === cid)
            if (!c || v <= 0) return null
            const rec = p.charRecord?.[cid]
            return (
              <div key={cid}>
                <StatBar label={c.name} value={Math.round(v)} max={100} title={`cap ${skillCap(save, p, cid)} — learn ${c.name} innovations to raise it`} />
                {rec && <p className="dim small" style={{ margin: '0 0 4px 126px' }}>{rec.w}–{rec.l} lifetime</p>}
              </div>
            )
          })}
          {Object.values(p.charSkill).every((v) => !v) && <p className="dim">Hasn't put in the reps yet.</p>}

          <h3>Tech</h3>
          <div>
            {p.knownTechniques.map((tid) => {
              const t = save.game.techniques.find((x) => x.id === tid)
              return t ? <span key={tid} className="pill on">{t.name}</span> : null
            })}
            {knownInnovs.map((i) => <span key={i.id} className="pill green" style={{ borderColor: 'var(--green)' }}>{i.name}</span>)}
            {p.knownTechniques.length + knownInnovs.length === 0 && <span className="dim small">none yet</span>}
          </div>
          {createdInnovs.length > 0 && (
            <p className="small green">💡 Invented: {createdInnovs.map((i) => i.name).join(', ')}</p>
          )}
          {mentorship && (
            <p className="small gold">
              🎓 {mentorship.mentorId === p.id
                ? `Mentoring ${displayName(save.players[mentorship.studentId], save)}`
                : `Mentored by ${displayName(save.players[mentorship.mentorId], save)}`}
            </p>
          )}

          {(p.memories || []).length > 0 && (
            <>
              <h3>Defining Moments</h3>
              {[...p.memories].reverse().map((m, i) => (
                <p key={i} className="small" style={{ margin: '3px 0' }}>
                  <span className="gold">★</span> {m.text} <span className="dim">— Year {m.year}</span>
                </p>
              ))}
            </>
          )}

          <h3>Relationships</h3>
          {rels.length === 0 && <p className="dim">Hasn't met anyone yet.</p>}
          {rels.map(({ other, v }) => (
            <div className="row spread" key={other.id} style={{ borderBottom: '1px solid var(--border)', padding: '3px 0' }}>
              <span style={{ cursor: 'pointer' }} onClick={() => goTo(other.id)}>{displayName(other, save)}</span>
              <span className={`small ${v >= 20 ? 'green' : v <= -20 ? 'red' : 'dim'}`}>
                {relLabel(v)} ({Math.round(v)})
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
