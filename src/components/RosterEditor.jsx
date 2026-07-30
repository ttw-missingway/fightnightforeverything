import { useState, useRef } from 'react'
import PlayerForm from './PlayerForm.jsx'
import { Field, NumField } from './ui.jsx'
import { newPlayer, resetPlayerForNewRun, legalizeBuild } from '../game/model.js'
import { uid } from '../game/util.js'
import { downloadJson, fileStem } from '../state/store.jsx'
import { generatePlayer, randomPreferences } from '../game/generate.js'
import { difficultyOf } from '../game/constants.js'
import { selectableChars } from '../game/forms.js'

export default function RosterEditor({ save, update }) {
  const [selId, setSelId] = useState(null)
  const importRef = useRef(null)
  const players = Object.values(save.players).filter((p) => !p.npc)
  const sel = save.players[selId] || null
  const consequential = save.settings.mode !== 'sandbox'
  const atCap = consequential && players.length >= 48 // consequential worlds max out at 48 players

  const patch = (fn) => update((s) => {
    const p = s.players[selId]
    if (p) fn(p)
  })

  // In consequential mode, fresh players must be legal out of the box:
  // per-stat cap and the difficulty's point budget (banked prestige no longer
  // adds power — docs/DEPRECATED.md). Every player also comes with a random
  // roll of food/arcade tastes — that roll is free; changing it later costs
  // stat points (tracked vs tasteRoll).
  const addPlayer = (make) => update((s) => {
    if (consequential && Object.keys(s.players).length >= 48) return
    const p = make(s)
    if (!p.foods?.length && !p.otherGames?.length) {
      const prefs = randomPreferences(s)
      p.foods = prefs.foods
      p.otherGames = prefs.otherGames
    }
    if (consequential) {
      legalizeBuild(p, difficultyOf(s).statPoints)
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
            {players.length > 0 && (
              <button className="small" title="download this cast as a file you can import into another world"
                onClick={() => downloadJson(
                  `${fileStem(save.saveName, 'cast')}.players.fightnight.json`,
                  { format: 'fightnight-players', formatVersion: 1, exportedAt: Date.now(), players })}>📤</button>
            )}
            <button className="small" title="import a player cast file (.players.fightnight.json)" onClick={() => importRef.current?.click()}>📥</button>
            <input ref={importRef} type="file" accept=".json,application/json" style={{ display: 'none' }} onChange={async (e) => {
              const file = e.target.files?.[0]
              e.target.value = ''
              if (!file) return
              try {
                const data = JSON.parse(await file.text())
                if (data.format !== 'fightnight-players' || !Array.isArray(data.players)) {
                  alert('That file is not a Fight Night player cast.')
                  return
                }
                // Identities and stats come along; progress starts fresh. Each
                // one runs through addPlayer so it lands tournament-legal under
                // THIS world's difficulty, with its tastes as the free roll.
                for (const raw of data.players) {
                  if (raw.npc) continue
                  addPlayer((s) => {
                    const p = resetPlayerForNewRun(raw)
                    if (s.players[p.id]) p.id = uid('player') // re-import: fresh identity
                    // A pinned main only survives if that character exists here
                    // (it does when the matching character roster was imported).
                    if (p.mainCharId && !selectableChars(s.game).some((c) => c.id === p.mainCharId)) {
                      p.mainCharId = null
                      p.lockedMain = false
                      p.settledMain = false
                      p.exploredChars = []
                    }
                    return p
                  })
                }
              } catch {
                alert('Could not read that file.')
              }
            }} />
          </div>
        </div>
        {atCap && <p className="dim small">Consequential worlds cap out at 48 players.</p>}

        <div style={{ borderTop: '1px solid var(--border)', marginTop: 10, paddingTop: 10 }}>
          {consequential ? (
            <p className="dim small">
              🧑‍🤝‍🧑 These are YOUR players — the cast this run is about. Everyone else is filler who
              drifts in and out of the arcade on their own; they never show up on the Players tab.
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
