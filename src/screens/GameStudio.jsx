import { useState } from 'react'
import { useStore } from '../state/store.jsx'
import {
  CharactersEditor, MatchupReport, StagesEditor, TechniquesEditor, TagsEditor,
} from '../components/editors.jsx'
import {
  diffGame, computeReception, daysSincePatch, releasePatch,
  schedulePatch, cancelScheduledPatch, scheduledPatchDaysLeft,
} from '../game/patch.js'
import { balanceConfidence, observedMatchup, observedPower } from '../game/balance.js'
import { formatDay, dateOfAbs } from '../game/constants.js'

const TABS = [
  ['characters', 'Characters'],
  ['matchups', 'Matchups'],
  ['stages', 'Stages'],
  ['techniques', 'Techniques'],
  ['tags', 'Tags'],
  ['balance', 'Balance Report'],
  ['history', 'Patch History'],
]

/**
 * The Game Studio: edit the game freely — everything lands in a DRAFT.
 * Nothing reaches the players until you hit the patch button, and every
 * patch gets a community verdict.
 */
export default function GameStudio() {
  const { save, mutate } = useStore()
  const [tab, setTab] = useState('characters')
  const [shipDays, setShipDays] = useState(7)
  const draft = save.gameDraft
  const displaySave = draft ? { ...save, game: draft } : save
  const scheduled = save.scheduledPatch
  const daysLeft = scheduledPatchDaysLeft(save)

  // All studio edits write to the draft (created lazily from the live game).
  const update = (fn) => mutate((s) => {
    if (!s.gameDraft) s.gameDraft = structuredClone(s.game)
    fn({ ...s, game: s.gameDraft })
  })

  // The forecast sees what the DATA sees — thin data, blurry forecast.
  const observe = (game, a, b) => observedMatchup(save, game, a, b)
  const diff = draft ? diffGame(save.game, draft, observe) : null
  const days = daysSincePatch(save)
  // Forecast reception as of the (scheduled or immediate) release day.
  const anticipation = scheduled ? Math.min(28, scheduled.absDay - scheduled.announcedAbs) : 0
  const preview = diff ? computeReception(diff, days, anticipation) : null
  const sandbox = save.settings.mode === 'sandbox'
  const confidence = balanceConfidence(save)

  return (
    <div>
      <div className="card" style={{ borderColor: draft ? 'var(--gold)' : 'var(--border)' }}>
        <div className="row spread">
          <div>
            <h2 style={{ margin: 0 }}>🛠 {save.game.name} <span className="dim">v{save.game.version}</span></h2>
            <span className="dim small">
              {days} day{days === 1 ? '' : 's'} since the last patch
              {days < 14 && save.patches.length > 0 && <span className="red"> · patching again this soon will frustrate players</span>}
              {days > 120 && <span className="gold"> · the community is hungry for an update</span>}
            </span>
          </div>
          {draft ? (
            <div className="col" style={{ alignItems: 'flex-end' }}>
              {scheduled ? (
                <div className="col" style={{ alignItems: 'flex-end', gap: 4 }}>
                  <span className="gold">
                    📅 v{scheduled.version} ships {formatDay(dateOfAbs(scheduled.absDay).day, dateOfAbs(scheduled.absDay).year)}
                    {' '}<strong>({daysLeft} day{daysLeft === 1 ? '' : 's'} away)</strong>
                  </span>
                  <div className="row">
                    <button className="small" onClick={() => mutate((s) => cancelScheduledPatch(s))}>Cancel date</button>
                    <button className="primary small" onClick={() => mutate((s) => releasePatch(s))}>
                      🚀 Ship early
                    </button>
                  </div>
                  <span className="dim small">the community is counting down — edits until then still make the patch</span>
                </div>
              ) : (
                <>
                  <div className="row">
                    <button className="danger" onClick={() => mutate((s) => { s.gameDraft = null; cancelScheduledPatch(s) })}>Discard draft</button>
                    <button className="primary" onClick={() => mutate((s) => releasePatch(s))}>
                      🚀 Release Patch v{bumpPreview(save.game.version)}
                    </button>
                  </div>
                  <div className="row" style={{ marginTop: 4 }}>
                    <span className="dim small">or announce a date:</span>
                    <input type="number" min={1} max={56} value={shipDays} style={{ width: 58 }}
                      onChange={(e) => setShipDays(Number(e.target.value))} />
                    <span className="dim small">days out</span>
                    <button className="small" title="announce the release date — hype builds until it ships automatically"
                      onClick={() => mutate((s) => schedulePatch(s, shipDays))}>
                      📅 Schedule
                    </button>
                  </div>
                  <span className="dim small">{diff.notes.length} change{diff.notes.length === 1 ? '' : 's'} pending</span>
                </>
              )}
            </div>
          ) : (
            <span className="dim small">no unreleased changes — edit anything to start a draft</span>
          )}
        </div>

        {draft && (
          <div className="card sub" style={{ marginTop: 10, marginBottom: 0 }}>
            <h4 style={{ marginTop: 0 }}>Pending patch notes</h4>
            {diff.notes.length === 0 && <p className="dim small">Changes so far don't add up to anything noticeable.</p>}
            {diff.notes.slice(0, 10).map((n, i) => <p key={i} className="small" style={{ margin: '2px 0' }}>• {n}</p>)}
            {diff.notes.length > 10 && <p className="dim small">…and {diff.notes.length - 10} more</p>}
            {preview && (
              <p className="small" style={{ marginBottom: 0 }}>
                Studio forecast: <span className={preview.score >= 5 ? 'green' : preview.score <= -5 ? 'red' : 'gold'}>
                  {preview.label}
                </span>
                {preview.why.length > 0 && <span className="dim"> — {preview.why.join('; ')}</span>}
                {sandbox && <span className="dim"> (sandbox: reaction is cosmetic)</span>}
                {confidence < 0.6 && (
                  <span className="red"> · forecast built on {Math.round(confidence * 100)}% data — it can be wrong</span>
                )}
              </p>
            )}
          </div>
        )}
      </div>

      <div className="tabs">
        {TABS.map(([k, label]) => (
          <button key={k} className={tab === k ? 'active' : ''} onClick={() => setTab(k)}>{label}</button>
        ))}
      </div>

      {tab === 'characters' && <CharactersEditor save={displaySave} update={update} />}
      {tab === 'matchups' && <MatchupReport save={displaySave} observe={observe} confidence={confidence} games={save.patchGames || 0} />}
      {tab === 'stages' && <StagesEditor save={displaySave} update={update} />}
      {tab === 'techniques' && <TechniquesEditor save={displaySave} update={update} />}
      {tab === 'tags' && <TagsEditor save={displaySave} update={update} />}
      {tab === 'balance' && <BalanceReport save={save} game={displaySave.game} confidence={confidence} />}
      {tab === 'history' && <PatchHistory save={save} />}
    </div>
  )
}

function bumpPreview(version) {
  const [maj, min] = String(version).split('.').map((n) => parseInt(n, 10) || 0)
  return `${maj}.${min + 1}`
}

// The confidence meter: how much the current build's data can be trusted.
export function ConfidenceMeter({ confidence, games }) {
  const pct = Math.round(confidence * 100)
  return (
    <div className="card sub" style={{ marginBottom: 10 }}>
      <div className="row spread">
        <span className="small">
          📈 Balance data: <strong className={pct >= 70 ? 'green' : pct >= 35 ? 'gold' : 'red'}>{pct}% confident</strong>
          <span className="dim"> · {games} sets played on this build</span>
        </span>
      </div>
      <div className="track" style={{ height: 6, background: 'var(--bg2)', borderRadius: 3, overflow: 'hidden', marginTop: 4 }}>
        <div style={{ width: `${pct}%`, height: '100%', background: pct >= 70 ? 'var(--green)' : pct >= 35 ? 'var(--gold)' : 'var(--red)' }} />
      </div>
      <p className="dim small" style={{ margin: '6px 0 0' }}>
        {pct >= 70
          ? 'The numbers have settled. Balance from these with confidence.'
          : pct >= 35
            ? 'The picture is forming, but individual reads can still be a few points off.'
            : 'Fresh build, thin data — these reads can be flat wrong. Patch now to appease the impatient, or wait for the meta to reveal itself.'}
      </p>
    </div>
  )
}

// Designer feedback: where every character sits on the power curve —
// as the DATA sees it, which early in a patch is an educated guess.
function BalanceReport({ save, game, confidence }) {
  const margin = Math.round((1 - confidence) * 4.5)
  const rows = game.characters
    .map((c) => ({ c, power: observedPower(save, game, c) }))
    .sort((x, y) => y.power - x.power)
  return (
    <div className="card">
      <h3>Power Curve <span className="dim small">(observed)</span></h3>
      <ConfidenceMeter confidence={confidence} games={save.patchGames || 0} />
      <p className="dim small">
        Average matchup win% across the cast, per current data. Above 58 reads as broken — players
        will riot. A chart that's ALL 50s reads as flavorless — players will yawn.
      </p>
      {rows.length === 0 && <p className="dim">No characters yet.</p>}
      {rows.map(({ c, power }) => (
        <div className="statbar" key={c.id} title={`${c.name}: ${power.toFixed(1)} avg matchup${margin ? ` (±${margin})` : ''}`}>
          <span className="label">{c.name}</span>
          <div className="track">
            <div className="fill" style={{
              width: `${Math.min(100, Math.max(4, (power - 35) / 30 * 100))}%`,
              background: power > 58 ? 'var(--red)' : power < 44 ? 'var(--dim)' : 'linear-gradient(90deg, var(--cyan), var(--green))',
            }} />
          </div>
          <span className="val" style={{ width: 'auto', minWidth: 34, ...(power > 58 ? { color: 'var(--red)' } : {}) }}>
            {power.toFixed(1)}{margin > 0 && <span className="dim small"> ±{margin}</span>}
          </span>
        </div>
      ))}
    </div>
  )
}

function PatchHistory({ save }) {
  if (!save.patches.length) {
    return <div className="card"><p className="dim">v{save.game.version} is still the launch build. No patches yet.</p></div>
  }
  return (
    <div>
      {save.patches.map((p) => (
        <div className="card" key={p.id}>
          <div className="row spread">
            <h3 style={{ margin: 0 }}>Patch v{p.version}</h3>
            <span className={`pill ${p.score >= 5 ? 'green' : p.score <= -5 ? 'red' : ''}`}
              style={p.score >= 5 ? { borderColor: 'var(--green)' } : p.score <= -5 ? { borderColor: 'var(--red)' } : {}}>
              {p.reception}
            </span>
          </div>
          <p className="dim small">{formatDay(p.day, p.year)}</p>
          {p.notes.map((n, i) => <p key={i} className="small" style={{ margin: '2px 0' }}>• {n}</p>)}
          {p.why?.length > 0 && <p className="dim small" style={{ marginBottom: 0 }}>Community: {p.why.join('; ')}</p>}
        </div>
      ))}
    </div>
  )
}
