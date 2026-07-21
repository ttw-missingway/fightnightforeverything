import { useState } from 'react'
import { useStore, loadIndex, deleteSaveById } from '../state/store.jsx'
import { formatDay } from '../game/constants.js'

export default function MainMenu() {
  const { nav, openSave } = useStore()
  const [saves, setSaves] = useState(loadIndex)

  return (
    <div>
      <div className="hero">
        <div className="sub">insert coin</div>
        <h1>FIGHT NIGHT</h1>
        <div className="sub">arcade community simulator</div>
      </div>

      <div className="row" style={{ justifyContent: 'center', marginBottom: 24 }}>
        <button className="primary" onClick={() => nav('setup')}>+ New Save</button>
      </div>

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
                    <button className="small danger" onClick={(e) => {
                      e.stopPropagation()
                      if (confirm(`Delete save "${s.saveName}"? This cannot be undone.`)) {
                        deleteSaveById(s.id)
                        setSaves(loadIndex())
                      }
                    }}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
