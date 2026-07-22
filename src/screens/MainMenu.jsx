import { useRef, useState } from 'react'
import { useStore, loadIndex, deleteSaveById, exportSaveById, importSaveFromText } from '../state/store.jsx'
import { formatDay } from '../game/constants.js'

export default function MainMenu() {
  const { nav, openSave } = useStore()
  const [saves, setSaves] = useState(loadIndex)
  const [notice, setNotice] = useState(null) // { kind: 'ok' | 'err', text }
  const fileRef = useRef(null)

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
                <tr key={s.id} className="clickable" onClick={() => openSave(s.id)}>
                  <td><strong>{s.saveName}</strong><br /><span className="dim small">{s.gameName} @ {s.arcadeName}</span></td>
                  <td className="dim small">{formatDay(s.day, s.year)}</td>
                  <td>
                    <div className="row" style={{ justifyContent: 'flex-end', flexWrap: 'nowrap' }}>
                      <button className="small" title="download this world as a file you can share" onClick={(e) => {
                        e.stopPropagation()
                        exportSaveById(s.id)
                      }}>📤 Export</button>
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
