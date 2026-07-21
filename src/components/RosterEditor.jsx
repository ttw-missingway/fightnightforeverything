import { useState } from 'react'
import PlayerForm from './PlayerForm.jsx'
import { newPlayer } from '../game/model.js'
import { generatePlayer } from '../game/generate.js'

export default function RosterEditor({ save, update }) {
  const [selId, setSelId] = useState(null)
  const players = Object.values(save.players)
  const sel = save.players[selId] || null

  const patch = (fn) => update((s) => {
    const p = s.players[selId]
    if (p) fn(p)
  })

  return (
    <div>
      <div className="card">
        <div className="row spread">
          <h3>Players ({players.length})</h3>
          <div className="row">
            <button className="small" onClick={() => update((s) => {
              const p = newPlayer()
              s.players[p.id] = p
            })}>+ New player</button>
            <button className="small" onClick={() => update((s) => {
              const p = generatePlayer(s, { createdBy: 'user' })
              s.players[p.id] = p
            })}>🎲 Generate one</button>
          </div>
        </div>
        <table>
          <thead><tr><th>Name</th><th>Alias</th><th>Origin</th><th /></tr></thead>
          <tbody>
            {players.map((p) => (
              <tr key={p.id} className="clickable" onClick={() => setSelId(p.id)}>
                <td style={selId === p.id ? { color: 'var(--pink)' } : {}}>{p.firstName} {p.lastName}</td>
                <td className="cyan">{p.alias}</td>
                <td className="dim small">{p.createdBy === 'user' ? 'created' : 'generated'}</td>
                <td>
                  <button className="small danger" onClick={(e) => {
                    e.stopPropagation()
                    if (selId === p.id) setSelId(null)
                    update((s) => { delete s.players[p.id] })
                  }}>×</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {players.length === 0 && (
          <p className="dim">
            No players yet. Create some, or let generated players wander in once the save starts.
          </p>
        )}
      </div>
      {sel && (
        <div className="card">
          <h3>Edit: {sel.firstName} "{sel.alias || '—'}" {sel.lastName}</h3>
          <PlayerForm save={save} player={sel} patch={patch} />
        </div>
      )}
    </div>
  )
}
