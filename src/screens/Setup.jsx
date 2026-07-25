import { useState } from 'react'
import { useStore } from '../state/store.jsx'
import { newSave } from '../game/model.js'
import {
  BasicsEditor, TagsEditor, CharactersEditor, MatchupReport,
  StagesEditor, ArcadeEditor, ScheduleEditor,
} from '../components/editors.jsx'
import RosterEditor from '../components/RosterEditor.jsx'
import { BudgetBar } from '../components/editors.jsx'
import { difficultyOf } from '../game/constants.js'
import { arcadeBuildCost, startingBudget } from '../game/economy.js'

const STEPS = [
  ['basics', 'Basics'],
  ['tags', 'Tags'],
  ['characters', 'Characters'],
  ['matchups', 'Matchups'],
  ['stages', 'Stages'],
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
  const consequential = draft.settings.mode !== 'sandbox'
  const overBudget = consequential && arcadeBuildCost(draft) > startingBudget(draft)
  // The cast you create IS the cast you follow — everyone else is filler who
  // drifts through. So a run needs at least one person to actually care about.
  const createdCount = Object.values(draft.players).filter((p) => !p.npc).length
  const canStart = charCount >= 2 && createdCount >= 1 && !overBudget

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
      {step === 'arcade' && <ArcadeEditor save={draft} update={update} budget={consequential} />}
      {step === 'schedule' && <ScheduleEditor save={draft} update={update} />}
      {step === 'players' && <RosterEditor save={draft} update={update} />}

      {step === 'review' && (
        <div className="card" style={{ maxWidth: 620 }}>
          <h3>Ready?</h3>
          <p><strong>{draft.saveName}</strong> — <span className="cyan">{draft.game.name}</span> at <span className="pink">{draft.arcade.name}</span></p>
          {consequential && <BudgetBar save={draft} />}
          <ul className="dim">
            <li>{charCount} characters, {draft.game.stages.length} stages</li>
            <li>{createdCount} created player{createdCount === 1 ? '' : 's'} to follow
              <span className="dim"> — other faces come and go on their own</span></li>
            <li>{draft.settings.setups} setups, {draft.arcade.foods.length} foods, {draft.arcade.otherGames.length} side games</li>
            <li>{draft.arcade.schedule.length} scheduled tournaments + EVO every year</li>
            {consequential && (
              <li>
                <strong className="gold">{difficultyOf(draft).label}</strong> difficulty —
                opening with <strong className="green">${Math.max(0, startingBudget(draft) - arcadeBuildCost(draft))}</strong> after the build,
                {' '}{difficultyOf(draft).statPoints} stat points per created player
                {(draft.prestige?.points || 0) > 0 && <> (+{draft.prestige.points} prestige)</>}
              </li>
            )}
          </ul>
          {charCount < 2 && <p className="red">You need at least 2 characters in the game's roster to start.</p>}
          {createdCount < 1 && (
            <p className="red">
              Create at least one player. They're who this run is about — the rest of the room fills
              itself with people passing through.
            </p>
          )}
          {overBudget && <p className="red">You're over your build budget — trim setups, food, or side games before opening.</p>}
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
