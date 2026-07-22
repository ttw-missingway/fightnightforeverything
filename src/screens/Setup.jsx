import { useState } from 'react'
import { useStore } from '../state/store.jsx'
import { newSave } from '../game/model.js'
import {
  BasicsEditor, TagsEditor, CharactersEditor, MatchupReport,
  StagesEditor, TechniquesEditor, ArcadeEditor, ScheduleEditor,
} from '../components/editors.jsx'
import RosterEditor from '../components/RosterEditor.jsx'

const STEPS = [
  ['basics', 'Basics'],
  ['tags', 'Tags'],
  ['characters', 'Characters'],
  ['matchups', 'Matchups'],
  ['stages', 'Stages'],
  ['techniques', 'Techniques'],
  ['arcade', 'Arcade'],
  ['schedule', 'Schedule'],
  ['players', 'Players'],
  ['review', 'Start!'],
]

export default function Setup() {
  const { startSave, nav } = useStore()
  const [draft, setDraft] = useState(() => newSave())
  const [step, setStep] = useState('basics')

  const update = (fn) => setDraft((d) => {
    const next = structuredClone(d)
    fn(next)
    return next
  })

  const stepIdx = STEPS.findIndex(([k]) => k === step)
  const charCount = draft.game.characters.length
  const canStart = charCount >= 2

  return (
    <div>
      <div className="row spread">
        <h1 style={{ fontSize: 28 }}>New Save Setup</h1>
        <button className="danger" onClick={() => nav('menu')}>Cancel</button>
      </div>

      <div className="tabs">
        {STEPS.map(([k, label]) => (
          <button key={k} className={step === k ? 'active' : ''} onClick={() => setStep(k)}>{label}</button>
        ))}
      </div>

      {step === 'basics' && <BasicsEditor save={draft} update={update} />}
      {step === 'tags' && <TagsEditor save={draft} update={update} />}
      {step === 'characters' && <CharactersEditor save={draft} update={update} />}
      {step === 'matchups' && <MatchupReport save={draft} />}
      {step === 'stages' && <StagesEditor save={draft} update={update} />}
      {step === 'techniques' && <TechniquesEditor save={draft} update={update} />}
      {step === 'arcade' && <ArcadeEditor save={draft} update={update} />}
      {step === 'schedule' && <ScheduleEditor save={draft} update={update} />}
      {step === 'players' && <RosterEditor save={draft} update={update} />}

      {step === 'review' && (
        <div className="card" style={{ maxWidth: 620 }}>
          <h3>Ready?</h3>
          <p><strong>{draft.saveName}</strong> — <span className="cyan">{draft.game.name}</span> at <span className="pink">{draft.arcade.name}</span></p>
          <ul className="dim">
            <li>{charCount} characters, {draft.game.stages.length} stages, {draft.game.techniques.length} techniques</li>
            <li>{Object.keys(draft.players).length} created players
              {draft.settings.allowGeneratedPlayers ? `, up to ${draft.settings.maxGeneratedPlayers} generated players may join` : ', no generated players'}</li>
            <li>{draft.settings.setups} setups, {draft.arcade.foods.length} foods, {draft.arcade.otherGames.length} side games</li>
            <li>{draft.arcade.schedule.length} scheduled tournaments + EVO every year</li>
          </ul>
          {!canStart && <p className="red">You need at least 2 characters in the game's roster to start.</p>}
          {Object.keys(draft.players).length === 0 && !draft.settings.allowGeneratedPlayers && (
            <p className="red">No players and no generated players allowed — the arcade would stay empty forever.</p>
          )}
          <button className="primary" disabled={!canStart} onClick={() => startSave(draft)}>
            Open the Arcade
          </button>
        </div>
      )}

      <div className="row" style={{ marginTop: 16 }}>
        {stepIdx > 0 && <button onClick={() => setStep(STEPS[stepIdx - 1][0])}>← {STEPS[stepIdx - 1][1]}</button>}
        {stepIdx < STEPS.length - 1 && <button onClick={() => setStep(STEPS[stepIdx + 1][0])}>{STEPS[stepIdx + 1][1]} →</button>}
      </div>
    </div>
  )
}
