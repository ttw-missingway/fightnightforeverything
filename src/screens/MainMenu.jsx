import { useRef, useState } from 'react'
import { useStore, loadIndex, deleteSaveById, exportSaveById, importSaveFromText, resetSaveById, saveRefusalReason, salvageCastById } from '../state/store.jsx'
import { formatDay } from '../game/constants.js'

export default function MainMenu() {
  const { nav, openSave } = useStore()
  const [saves, setSaves] = useState(loadIndex)
  const [notice, setNotice] = useState(null) // { kind: 'ok' | 'err', text }
  // Saves the schema gate refused this session — their rows swap Open for
  // Salvage. Pre-revision saves are refused, never migrated (DEPRECATED.md).
  const [refused, setRefused] = useState(() => new Set())
  const fileRef = useRef(null)

  const tryOpen = (id) => {
    if (openSave(id)) return
    const reason = saveRefusalReason(id)
    setRefused((prev) => new Set(prev).add(id))
    setNotice({
      kind: 'err',
      text: reason === 'pre-revision'
        ? 'That save is from before the revision and can\'t be opened. Its cast can still be salvaged — 🧬 Salvage cast downloads the players as a file you can import into a new world.'
        : 'That save could not be read.',
    })
  }

  const onImportFile = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = '' // allow re-importing the same file
    if (!file) return
    const result = importSaveFromText(await file.text())
    if (result.ok) {
      setSaves(loadIndex())
      setNotice({ kind: 'ok', text: `Imported "${result.save.saveName}" — ${result.save.game.name} @ ${result.save.arcade.name}. It's a copy; the original file is untouched.` })
    } else {
      setNotice({ kind: 'err', text: result.error })
    }
  }

  return (
    <div>
      <div className="hero">
        <div className="sub">insert coin</div>
        <h1>FIGHT NIGHT</h1>
        <div className="sub">arcade community simulator</div>
      </div>

      <div className="row" style={{ justifyContent: 'center', marginBottom: 24 }}>
        <button className="primary" onClick={() => nav('setup')}>+ New Save</button>
        <button title="load a world someone shared with you (.fightnight.json)" onClick={() => fileRef.current?.click()}>
          📥 Import save
        </button>
        <input ref={fileRef} type="file" accept=".json,application/json" style={{ display: 'none' }} onChange={onImportFile} />
      </div>

      {notice && (
        <div className="notice" style={{ maxWidth: 640, margin: '0 auto 16px', ...(notice.kind === 'err' ? { borderColor: 'var(--red)', color: 'var(--red)', background: 'rgba(255, 93, 93, 0.1)' } : {}) }}>
          {notice.text}
        </div>
      )}

      {saves.length > 0 && (
        <div className="card" style={{ maxWidth: 640, margin: '0 auto' }}>
          <h3>Continue</h3>
          <table>
            <tbody>
              {saves.map((s) => (
                <tr key={s.id} className="clickable" onClick={() => tryOpen(s.id)}>
                  <td><strong>{s.saveName}</strong>{refused.has(s.id) && <span className="small red"> · pre-revision</span>}<br /><span className="dim small">{s.gameName} @ {s.arcadeName}</span></td>
                  <td className="dim small">{formatDay(s.day, s.year)}</td>
                  <td>
                    <div className="row" style={{ justifyContent: 'flex-end', flexWrap: 'nowrap' }}>
                      {refused.has(s.id) && (
                        <button className="small" title="download this save's cast as a players file — import it into a new world" onClick={(e) => {
                          e.stopPropagation()
                          const res = salvageCastById(s.id)
                          setNotice(res.ok
                            ? { kind: 'ok', text: `Salvaged ${res.count} player${res.count === 1 ? '' : 's'} — import the file on the Players step of a new world.` }
                            : { kind: 'err', text: res.error })
                        }}>🧬 Salvage cast</button>
                      )}
                      <button className="small" title="download this world as a file you can share" onClick={(e) => {
                        e.stopPropagation()
                        exportSaveById(s.id)
                      }}>📤 Export</button>
                      <button className="small" title="start a new run: keep the game design and roster, wipe all progress, archive this run's history" onClick={(e) => {
                        e.stopPropagation()
                        if (!confirm(`Run it back at "${s.saveName}"? The game design and player roster stay (progress wiped); patches, teams, money, and the arcade's stock reset. This run's chronicle, hall of fame, and VODs move to the archives, and its fame becomes prestige points. This cannot be undone.`)) return
                        const res = resetSaveById(s.id)
                        setSaves(loadIndex())
                        setNotice(res.ok
                          ? { kind: 'ok', text: `Running it back at "${s.saveName}" — +${res.prestigeGain} prestige earned (${res.points} banked).` }
                          : { kind: 'err', text: res.error })
                      }}>♻ Run it back</button>
                      <button className="small danger" onClick={(e) => {
                        e.stopPropagation()
                        if (confirm(`Delete save "${s.saveName}"? This cannot be undone.`)) {
                          deleteSaveById(s.id)
                          setSaves(loadIndex())
                        }
                      }}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="dim small" style={{ marginBottom: 0 }}>
            📤 Export downloads a world as a file — send it to a friend and they can 📥 Import it as their own copy.
          </p>
        </div>
      )}
    </div>
  )
}
