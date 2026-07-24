import { useState } from 'react'
import { useStore } from '../state/store.jsx'
import { formatLocation } from '../game/constants.js'
import { SettingsEditor, ArcadeManagement, ScheduleEditor, StaffManagement } from '../components/editors.jsx'

const TABS = [
  ['arcade', 'Arcade'],
  ['staff', 'Staff'],
  ['schedule', 'Schedule'],
  ['settings', 'Settings'],
]

// Running the venue: money, floor space, the tournament calendar, and the
// handful of settings that aren't part of the game itself (that's the
// Game Studio's job now).
export default function Manage() {
  const { save, mutate } = useStore()
  const [tab, setTab] = useState('arcade')

  return (
    <div>
      <h2 style={{ marginBottom: 0 }}>Manage — {save.arcade.name}</h2>
      {formatLocation(save.arcade.location) && (
        <div className="small dim" style={{ marginBottom: 8 }}>📍 {formatLocation(save.arcade.location)}</div>
      )}
      <div className="tabs">
        {TABS.map(([k, label]) => (
          <button key={k} className={tab === k ? 'active' : ''} onClick={() => setTab(k)}>{label}</button>
        ))}
      </div>
      {tab === 'arcade' && <ArcadeManagement save={save} update={mutate} />}
      {tab === 'staff' && <StaffManagement save={save} update={mutate} />}
      {tab === 'schedule' && <ScheduleEditor save={save} update={mutate} />}
      {tab === 'settings' && <SettingsEditor save={save} update={mutate} />}
    </div>
  )
}
