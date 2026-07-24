import { useState } from 'react'
import PlayerForm, { capAndFit } from './PlayerForm.jsx'
import { Field, NumField } from './ui.jsx'
import { newPlayer } from '../game/model.js'
import { generatePlayer, randomPreferences } from '../game/generate.js'
import { difficultyOf } from '../game/constants.js'

export default function RosterEditor({ save, update }) {
  const [selId, setSelId] = useState(null)
  const players = Object.values(save.players)
  const sel = save.players[selId] || null
  const consequential = save.settings.mode !== 'sandbox'
  const atCap = consequential && players.length >= 48 // consequential worlds max out at 48 players

  const patch = (fn) => update((s) => {
    const p = s.players[selId]
    if (p) fn(p)
  })

  // In consequential mode, fresh players must be legal out of the box:
  // per-stat cap and total point budget (difficulty + banked prestige).
  // Every player also comes with a random roll of food/arcade tastes — that
  // roll is free; changing it later costs stat points (tracked vs tasteRoll).
  const addPlayer = (make) => update((s) => {
    if (consequential && Object.keys(s.players).length >= 48) return
    const p = make(s)
    if (!p.foods?.length && !p.otherGames?.length) {
      const prefs = randomPreferences(s)
      p.foods = prefs.foods
      p.otherGames = prefs.otherGames
    }
    p.tasteRoll = { foods: [...(p.foods || [])], otherGames: [...(p.otherGames || [])] }
    if (consequential) {
      const d = difficultyOf(s)
      const fitted = capAndFit(p.personal, p.social, d.statCap, d.statPoints + (s.prestige?.points || 0))
      p.personal = fitted.personal
      p.social = fitted.social
    }
    s.players[p.id] = p
  })

  return (
    <div>
      <div className="card">
        <div className="row spread">
          <h3>Players ({players.length}{consequential ? '/48' : ''})</h3>
          <div className="row">
            <button className="small" disabled={atCap} onClick={() => addPlayer(() => newPlayer())}>+ New player</button>
            <button className="small" disabled={atCap} onClick={() => addPlayer((s) => generatePlayer(s, { createdBy: 'user' }))}>🎲 Generate one</button>
          </div>
        </div>
        {atCap && <p className="dim small">Consequential worlds cap out at 48 players.</p>}

        <div style={{ borderTop: '1px solid var(--border)', marginTop: 10, paddingTop: 10 }}>
          {consequential ? (
            <p className="dim small">
              🧑‍🤝‍🧑 Generated players will fill out the remaining slots over time (up to 48). A bigger scene
              is always better for business, so there's nothing to tune here — just create the regulars you
              want to guarantee.
            </p>
          ) : (
            <>
              <Field label="Fill out the remaining slots with generated players?">
                <select value={save.settings.allowGeneratedPlayers ? 'yes' : 'no'}
                  onChange={(e) => update((s) => { s.settings.allowGeneratedPlayers = e.target.value === 'yes' })}>
                  <option value="yes">Yes — new faces wander in over time to fill empty slots</option>
                  <option value="no">No — only the players I create</option>
                </select>
              </Field>
              {save.settings.allowGeneratedPlayers && (
                <NumField label="Cap on generated players"
                  value={save.settings.maxGeneratedPlayers} min={0} max={60}
                  onChange={(v) => update((s) => { s.settings.maxGeneratedPlayers = v })} />
              )}
            </>
          )}
        </div>
        <div className="table-scroll"><table>
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
        </table></div>
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
