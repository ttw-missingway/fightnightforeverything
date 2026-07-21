import { useState } from 'react'
import { useStore } from '../state/store.jsx'
import { formatDay, EVO_DAY, DAYS_PER_YEAR, HOURS_PER_DAY, HOUR_LABELS, WEEKDAYS, weekdayOf } from '../game/constants.js'
import { whatHappensToday } from '../game/sim.js'
import { moodLabel } from '../game/social.js'
import { Expandable, moodFace } from '../components/ui.jsx'
import { displayName } from '../game/util.js'

export default function Arcade() {
  const { save, screen, advance, nav } = useStore()
  const dip = save.dayInProgress
  const report = save.lastDayReport
  const today = whatHappensToday(save)
  const daysToEvo = (EVO_DAY - save.day + DAYS_PER_YEAR) % DAYS_PER_YEAR

  let buttonLabel
  if (!dip) {
    buttonLabel = today === 'evo' ? '▶ EVO is TODAY!'
      : today ? `▶ Run "${today.name}"`
      : '▶ Open the arcade'
  } else if (save.hour < HOURS_PER_DAY) {
    buttonLabel = `▶ Next hour (${HOUR_LABELS[save.hour]})`
  } else {
    buttonLabel = '🌙 Close up shop'
  }

  return (
    <div>
      {screen.notice && <div className="notice">{screen.notice}</div>}

      <div className="card">
        <div className="row spread">
          <div>
            <h2 style={{ margin: 0 }}>{save.arcade.name}</h2>
            <span className="dim">{WEEKDAYS[weekdayOf(save.day)]}, {formatDay(save.day, save.year)} · running <span className="cyan">{save.game.name}</span></span>
            {dip && (
              <div className="row" style={{ marginTop: 8 }}>
                {HOUR_LABELS.map((h, i) => (
                  <span key={h} className={`pill ${i < save.hour ? (i === save.hour - 1 ? 'on' : '') : ''}`}
                    style={i === save.hour - 1 ? {} : i < save.hour ? { opacity: 0.6 } : { opacity: 0.3 }}>
                    {h}
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className="col" style={{ alignItems: 'flex-end' }}>
            <button className="primary" onClick={advance}>{buttonLabel}</button>
            <span className="dim small">{daysToEvo === 0 ? 'EVO today!' : `${daysToEvo} days until EVO`}</span>
          </div>
        </div>
      </div>

      {dip ? <LiveDay save={save} nav={nav} /> : <RecapView save={save} report={report} nav={nav} />}
    </div>
  )
}

// ---------- Live (hour-by-hour) view ----------

function LiveDay({ save, nav }) {
  const dip = save.dayInProgress
  const [viewHour, setViewHour] = useState(null) // null = latest
  const hourIdx = viewHour ?? dip.hours.length - 1
  const hour = dip.hours[hourIdx]
  const isCurrent = hourIdx === dip.hours.length - 1

  if (!hour) return <div className="card"><p className="dim">The doors just opened…</p></div>

  const matches = hour.events.filter((e) => e.type === 'match')
  const interactions = hour.events.filter((e) => e.type === 'interaction')
  const misc = hour.events.filter((e) => e.type !== 'match' && e.type !== 'interaction')
  const opening = hourIdx === 0 ? dip.openingEvents : []

  return (
    <div>
      <div className="row spread">
        <div className="tabs" style={{ margin: 0 }}>
          {dip.hours.map((h, i) => (
            <button key={h.label} className={`small ${i === hourIdx ? 'active' : ''}`}
              onClick={() => setViewHour(i === dip.hours.length - 1 ? null : i)}>
              {h.label}
            </button>
          ))}
        </div>
        <span className="dim small">{hour.presentIds.length} in the building</span>
      </div>

      <div className="grid2" style={{ gridTemplateColumns: '2fr 1fr', marginTop: 10 }}>
        <div>
          {opening.map((ev, i) => <PlainEvent key={`o${i}`} ev={ev} />)}

          <h3 className="pink">🕹 On the setups</h3>
          {matches.length === 0 && <p className="dim small">No one is playing {save.game.name} this hour.</p>}
          {matches.map((m) => (
            <LiveMatch key={`${hourIdx}-${m.setupIndex}`} m={m} spoil={!isCurrent} />
          ))}

          <h3 className="cyan">🍿 Around the arcade</h3>
          {interactions.length === 0 && <p className="dim small">The concession stand is quiet.</p>}
          {interactions.map((ev, i) => <InteractionEvent key={`i${i}`} ev={ev} />)}
          {misc.map((ev, i) => <PlainEvent key={`m${i}`} ev={ev} />)}
        </div>

        <div className="card">
          <h3>In the building</h3>
          {hour.presentIds.map((id) => {
            const p = save.players[id]
            if (!p) return null
            return (
              <div className="row spread" key={id} style={{ borderBottom: '1px solid var(--border)', padding: '4px 0' }}>
                <span style={{ cursor: 'pointer' }} onClick={() => nav('players', { playerId: id })}>
                  {displayName(p, save)}
                </span>
                <span className="small dim" title={moodLabel(p.mood)}>
                  <span className="mood-face">{moodFace(p.mood)}</span> {Math.round(p.elo)}
                </span>
              </div>
            )
          })}
          {hour.presentIds.length === 0 && <p className="dim">Nobody around this hour.</p>}
        </div>
      </div>
    </div>
  )
}

/**
 * A match on a setup. No spoilers: narration reveals line by line and the
 * winner is only announced by the final line. Past hours (and the recap)
 * show results freely.
 */
function LiveMatch({ m, spoil = false }) {
  const [open, setOpen] = useState(false)
  const [revealed, setRevealed] = useState(spoil ? m.narration.length : 0)
  const fullyRevealed = revealed >= m.narration.length

  return (
    <div className="event match clickable" onClick={() => setOpen(!open)}>
      <span>
        🕹 <strong>Setup {m.setupIndex}:</strong> {m.aName} ({m.charAName}) vs {m.bName} ({m.charBName})
        {' '}
        {fullyRevealed
          ? <span className="gold">— {m.winnerName} wins</span>
          : <span className="dim small">— in progress…</span>}
        {m.watcherNames?.length > 0 && <span className="dim small"> · {m.watcherNames.length} watching</span>}
      </span>
      {open && (
        <div className="narration" onClick={(e) => e.stopPropagation()}>
          {m.narration.slice(0, revealed).map((l, i) => <p key={i}>{l}</p>)}
          {!fullyRevealed && (
            <button className="small" onClick={() => setRevealed(revealed + 1)}>
              ▶ {revealed === 0 ? 'Watch the match' : 'What happens next?'}
            </button>
          )}
          {fullyRevealed && (
            <p className="dim small" style={{ fontStyle: 'normal' }}>
              win chance was {Math.round(m.probA * 100)}%–{Math.round((1 - m.probA) * 100)}% · ±{m.eloDelta} elo
              {m.watcherNames?.length > 0 && <> · railbirds: {m.watcherNames.join(', ')}</>}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

function InteractionEvent({ ev }) {
  return (
    <Expandable
      className="interaction"
      summary={<span>💬 {ev.memberNames.join(', ')} {ev.memberNames.length > 2 ? 'hang out' : 'chat'} {ev.where}</span>}
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

function PlainEvent({ ev }) {
  const icons = {
    arrival: '🚪', team: '🛡', innovation: '💡', technique: '📈', main: '🎯', mentorship: '🎓', idle: '🥤',
  }
  return <div className={`event ${ev.type}`}>{icons[ev.type] || '•'} {ev.text}</div>
}

// ---------- Daily recap (after close) ----------

function RecapView({ save, report, nav }) {
  if (!report) {
    return (
      <div className="card">
        <p>The shutters are up, the cabinets are humming. Hit <strong>Open the arcade</strong> to start the day.</p>
      </div>
    )
  }
  return (
    <div className="grid2" style={{ gridTemplateColumns: '2fr 1fr' }}>
      <div className="card">
        <h3>📋 Daily Recap — {report.dateLabel}</h3>
        {report.events.length === 0 && <p className="dim">A quiet day. Nobody came in.</p>}
        {report.events.map((ev, i) => <RecapEvent key={i} ev={ev} />)}
      </div>
      <div className="card">
        <h3>Who came in ({report.attendeeIds.length})</h3>
        {report.attendeeIds.map((id) => {
          const p = save.players[id]
          if (!p) return null
          return (
            <div className="row spread" key={id} style={{ borderBottom: '1px solid var(--border)', padding: '4px 0' }}>
              <span style={{ cursor: 'pointer' }} onClick={() => nav('players', { playerId: id })}>
                {displayName(p, save)}
              </span>
              <span className="small dim" title={moodLabel(p.mood)}>
                <span className="mood-face">{moodFace(p.mood)}</span> {Math.round(p.elo)}
              </span>
            </div>
          )
        })}
        {report.attendeeIds.length === 0 && <p className="dim">Empty arcade.</p>}
      </div>
    </div>
  )
}

// Recap shows everything, spoilers included.
function RecapEvent({ ev }) {
  if (ev.type === 'match') {
    return (
      <Expandable
        className="match"
        summary={
          <span>
            🕹 <strong>Setup {ev.setupIndex}:</strong> {ev.aName} ({ev.charAName}) vs {ev.bName} ({ev.charBName})
            {' — '}<span className="gold">{ev.winnerName} wins</span>
          </span>
        }
      >
        <div className="narration">
          {ev.narration.map((l, i) => <p key={i}>{l}</p>)}
          <p className="dim small" style={{ fontStyle: 'normal' }}>
            win chance {Math.round(ev.probA * 100)}%–{Math.round((1 - ev.probA) * 100)}% · ±{ev.eloDelta} elo
          </p>
        </div>
      </Expandable>
    )
  }
  if (ev.type === 'interaction') return <InteractionEvent ev={ev} />
  return <PlainEvent ev={ev} />
}
