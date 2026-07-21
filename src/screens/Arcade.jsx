import { useStore } from '../state/store.jsx'
import { formatDay, EVO_DAY, DAYS_PER_YEAR } from '../game/constants.js'
import { whatHappensToday } from '../game/sim.js'
import { moodLabel } from '../game/social.js'
import { Expandable, moodFace } from '../components/ui.jsx'
import { displayName } from '../game/util.js'

export default function Arcade() {
  const { save, screen, simulateDay, nav } = useStore()
  const report = save.lastDayReport
  const today = whatHappensToday(save)
  const daysToEvo = (EVO_DAY - save.day + DAYS_PER_YEAR) % DAYS_PER_YEAR

  return (
    <div>
      {screen.notice && <div className="notice">{screen.notice}</div>}

      <div className="card">
        <div className="row spread">
          <div>
            <h2 style={{ margin: 0 }}>{save.arcade.name}</h2>
            <span className="dim">{formatDay(save.day, save.year)} · running <span className="cyan">{save.game.name}</span></span>
          </div>
          <div className="col" style={{ alignItems: 'flex-end' }}>
            <button className="primary" onClick={simulateDay}>
              {today === 'evo' ? '▶ EVO is TODAY!' : today ? `▶ Run "${today.name}"` : '▶ Simulate Day'}
            </button>
            <span className="dim small">
              {daysToEvo === 0 ? 'EVO today!' : `${daysToEvo} days until EVO`}
            </span>
          </div>
        </div>
      </div>

      {!report && (
        <div className="card">
          <p>The shutters are up, the cabinets are humming. Hit <strong>Simulate Day</strong> to open for business.</p>
        </div>
      )}

      {report && (
        <div className="grid2" style={{ gridTemplateColumns: '2fr 1fr' }}>
          <div className="card">
            <h3>Day Report — {report.dateLabel}</h3>
            {report.events.length === 0 && <p className="dim">A quiet day. Nobody came in.</p>}
            {report.events.map((ev, i) => <EventView key={i} ev={ev} />)}
          </div>

          <div className="card">
            <h3>Who came in ({report.attendeeIds.length})</h3>
            {report.attendeeIds.map((id) => {
              const p = save.players[id]
              if (!p) return null
              return (
                <div className="row spread" key={id} style={{ borderBottom: '1px solid var(--border)', padding: '4px 0' }}>
                  <span className="clickable" style={{ cursor: 'pointer' }} onClick={() => nav('players', { playerId: id })}>
                    {displayName(p, save.teams)}
                  </span>
                  <span className="small dim" title={moodLabel(p.mood)}>
                    <span className="mood-face">{moodFace(p.mood)}</span> {Math.round(p.elo)}
                  </span>
                </div>
              )
            })}
            {report.attendeeIds.length === 0 && <p className="dim">Empty arcade today.</p>}
          </div>
        </div>
      )}
    </div>
  )
}

function EventView({ ev }) {
  if (ev.type === 'match') {
    return (
      <Expandable
        className="match"
        summary={
          <span>
            🕹 <strong>Setup {ev.setupIndex}:</strong> {ev.aName} ({ev.charAName}) vs {ev.bName} ({ev.charBName})
            {' — '}<span className="gold">{ev.winnerName} wins</span>
            {ev.watcherNames?.length > 0 && <span className="dim small"> · {ev.watcherNames.length} watching</span>}
          </span>
        }
      >
        <div className="narration">
          {ev.narration.map((l, i) => <p key={i}>{l}</p>)}
          <p className="dim small" style={{ fontStyle: 'normal' }}>
            win chance {Math.round(ev.probA * 100)}% — {Math.round((1 - ev.probA) * 100)}% · ±{ev.eloDelta} elo
            {ev.watcherNames?.length > 0 && <> · railbirds: {ev.watcherNames.join(', ')}</>}
          </p>
        </div>
      </Expandable>
    )
  }
  if (ev.type === 'interaction') {
    return (
      <Expandable
        className="interaction"
        summary={
          <span>💬 {ev.memberNames.join(', ')} {ev.memberNames.length > 2 ? 'hang out' : 'chat'} {ev.where}</span>
        }
      >
        <div className="narration">
          <p style={{ fontStyle: 'normal' }} className="dim">Talking about: <span className="cyan">{ev.topic}</span></p>
          {ev.feelings.map((f) => (
            <p key={f.id} style={{ fontStyle: 'normal' }}>
              {moodFace(f.mood)} {f.name} is {f.note} <span className="dim small">(mood: {moodLabel(f.mood)})</span>
            </p>
          ))}
          {ev.outcomes.map((o, i) => <p key={i} className="gold" style={{ fontStyle: 'normal' }}>★ {o}</p>)}
        </div>
      </Expandable>
    )
  }
  const icons = {
    arrival: '🚪', team: '🛡', innovation: '💡', technique: '📈', main: '🎯', mentorship: '🎓',
  }
  return <div className={`event ${ev.type}`}>{icons[ev.type] || '•'} {ev.text}</div>
}
