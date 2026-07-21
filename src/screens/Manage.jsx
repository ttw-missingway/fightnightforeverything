import { useState } from 'react'
import { useStore } from '../state/store.jsx'
import {
  BasicsEditor, TagsEditor, CharactersEditor, MatchupsEditor,
  StagesEditor, TechniquesEditor, ArcadeEditor, ScheduleEditor,
} from '../components/editors.jsx'

const TABS = [
  ['basics', 'Basics'],
  ['arcade', 'Arcade'],
  ['schedule', 'Schedule'],
  ['characters', 'Characters'],
  ['matchups', 'Matchups'],
  ['stages', 'Stages'],
  ['techniques', 'Techniques'],
  ['tags', 'Tags'],
]

// Mid-save editing of the game, arcade and schedule. Reuses the setup editors,
// but mutations apply to the live save.
export default function Manage() {
  const { save, mutate } = useStore()
  const [tab, setTab] = useState('basics')

  return (
    <div>
      <h2>Manage — {save.game.name} @ {save.arcade.name}</h2>
      <div className="tabs">
        {TABS.map(([k, label]) => (
          <button key={k} className={tab === k ? 'active' : ''} onClick={() => setTab(k)}>{label}</button>
        ))}
      </div>
      {tab === 'basics' && <BasicsEditor save={save} update={mutate} />}
      {tab === 'arcade' && <ArcadeEditor save={save} update={mutate} />}
      {tab === 'schedule' && <ScheduleEditor save={save} update={mutate} />}
      {tab === 'characters' && <CharactersEditor save={save} update={mutate} />}
      {tab === 'matchups' && <MatchupsEditor save={save} update={mutate} />}
      {tab === 'stages' && <StagesEditor save={save} update={mutate} />}
      {tab === 'techniques' && <TechniquesEditor save={save} update={mutate} />}
      {tab === 'tags' && <TagsEditor save={save} update={mutate} />}
    </div>
  )
}
