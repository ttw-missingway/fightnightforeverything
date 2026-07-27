import { useEffect, useState } from 'react'
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
  const { save, mutate, screen } = useStore()
  // The venue strip and the teaching tips deep-link to the lever they are
  // talking about, so land on that tab rather than always on 'arcade'. A tip
  // that says "hire someone" and then drops you one tab away from hiring is
  // most of the way back to the problem this UI pass exists to fix.
  const [tab, setTab] = useState(
    TABS.some(([k]) => k === screen.tab) ? screen.tab : 'arcade')
  // The banner sits above the tab content on every screen, so a tip can be
  // clicked while Manage is ALREADY open — in which case this component never
  // remounts and the initialiser above never runs again.
  //
  // Depend on the screen OBJECT, not on screen.tab. nav() builds a fresh object
  // every time, but the tab string is often identical: open a tip for staff,
  // wander over to Settings, click the same tip again, and a [screen.tab] dep
  // sees no change and leaves you on Settings staring at nothing to do.
  useEffect(() => {
    if (screen.tab && TABS.some(([k]) => k === screen.tab)) setTab(screen.tab)
  }, [screen])

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
