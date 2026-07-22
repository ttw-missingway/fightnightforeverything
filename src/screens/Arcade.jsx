import { Fragment, useEffect, useState } from 'react'
import { useStore } from '../state/store.jsx'
import { formatDay, formatLocation, EVO_DAY, DAYS_PER_YEAR, HOURS_PER_DAY, HOUR_LABELS, WEEKDAYS, weekdayOf,
  IDLE_SPEEDS, AUTO_STREAM_SELECTORS, AUTO_STREAM_CADENCES, idleSpeedOf } from '../game/constants.js'
import { whatHappensToday, scheduledMoneyMatch } from '../game/sim.js'
import { moodLabel } from '../game/social.js'
import { Expandable, moodFace, SpeechLine } from '../components/ui.jsx'
import StreamChat from '../components/StreamChat.jsx'
import MatchHud from '../components/MatchHud.jsx'
import { displayName } from '../game/util.js'
import { buildStreamForPlayers, hypeLabel } from '../game/stream.js'

export default function Arcade() {
  const { save, screen, advance, skipDay, nav, enableIdle } = useStore()
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
            {formatLocation(save.arcade.location) && (
              <div className="small dim">📍 {formatLocation(save.arcade.location)}</div>
            )}
            <span className="dim">{WEEKDAYS[weekdayOf(save.day)]}, {formatDay(save.day, save.year)} · running <span className="cyan">{save.game.name}</span></span>
            <div className="small" style={{ marginTop: 2 }}>
              <span className="pink">📡 {save.stream.channelName}</span>
              <span className="dim"> · {save.stream.followers} followers · {hypeLabel(save.stream.hype)}</span>
              {save.stream.peakViewers > 0 && <span className="dim"> · peak {save.stream.peakViewers} viewers</span>}
              {save.economy && (
                <span className={save.economy.money < 0 ? 'red' : 'green'}>
                  {' '}· 💰 ${Math.round(save.economy.money)}
                </span>
              )}
            </div>
            <MoneyMatchBanner save={save} />
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
            {save.idle.enabled ? (
              <IdleBar save={save} />
            ) : (
              <div className="row">
                <button className="small" title="auto-advance the arcade over real time" onClick={() => enableIdle(true)}>
                  🎮 Idle mode
                </button>
                <button className="small" title="simulate the rest of the day and jump to the recap" onClick={skipDay}>
                  ⏩ Skip to recap
                </button>
                <button className="primary" onClick={advance}>{buttonLabel}</button>
              </div>
            )}
            <span className="dim small">{daysToEvo === 0 ? 'EVO today!' : `${daysToEvo} days until EVO`}</span>
          </div>
        </div>
      </div>

      {dip ? <LiveDay save={save} nav={nav} /> : <RecapView save={save} report={report} nav={nav} />}
    </div>
  )
}

// ---------- Idle-mode controls ----------

function formatCountdown(ms) {
  const s = Math.ceil(ms / 1000)
  if (s >= 3600) return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`
  if (s >= 60) return `${Math.floor(s / 60)}m ${s % 60}s`
  return `${s}s`
}

function IdleBar({ save }) {
  const { setIdleRunning, setIdleSpeed, setAutoStream, enableIdle } = useStore()
  const idle = save.idle
  const speed = idleSpeedOf(idle.speed)
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const h = setInterval(() => setNow(Date.now()), 500)
    return () => clearInterval(h)
  }, [])
  const nextInMs = idle.running && idle.lastTickAt != null
    ? Math.max(0, idle.lastTickAt + speed.ms - now)
    : null

  return (
    <div className="idlebar">
      <div className="row" style={{ justifyContent: 'flex-end' }}>
        <button className="primary small" onClick={() => setIdleRunning(!idle.running)}>
          {idle.running ? '⏸ Pause' : '▶ Play'}
        </button>
        <select value={idle.speed} onChange={(e) => setIdleSpeed(e.target.value)}>
          {IDLE_SPEEDS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
        </select>
        <button className="small" title="return to manual play" onClick={() => enableIdle(false)}>
          ✕ Exit
        </button>
      </div>
      <div className="small dim" style={{ textAlign: 'right' }}>{speed.blurb}</div>
      <div className="small" style={{ textAlign: 'right' }}>
        {idle.running
          ? <span className="cyan">▶ auto-advancing · next hour in {formatCountdown(nextInMs)}</span>
          : <span className="dim">paused</span>}
      </div>
      <AutoStreamControls autoStream={idle.autoStream} setAutoStream={setAutoStream} />
    </div>
  )
}

function AutoStreamControls({ autoStream, setAutoStream }) {
  return (
    <div className="col" style={{ alignItems: 'flex-end', gap: 3, marginTop: 4 }}>
      <label className="small row" style={{ gap: 4 }}>
        <input type="checkbox" checked={autoStream.enabled}
          onChange={(e) => setAutoStream({ enabled: e.target.checked })} />
        📡 auto-stream
      </label>
      {autoStream.enabled && (
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <select className="small" value={autoStream.selector}
            onChange={(e) => setAutoStream({ selector: e.target.value })}>
            {AUTO_STREAM_SELECTORS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
          <select className="small" value={autoStream.cadence}
            onChange={(e) => setAutoStream({ cadence: e.target.value })}>
            {AUTO_STREAM_CADENCES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
          </select>
        </div>
      )}
    </div>
  )
}

function MoneyMatchBanner({ save }) {
  const mm = scheduledMoneyMatch(save)
  if (!mm) return null
  const a = save.players[mm.aId]
  const b = save.players[mm.bId]
  if (!a || !b) return null
  const daysAway = (mm.year - save.year) * DAYS_PER_YEAR + mm.dayOfYear - save.day
  return (
    <div className="small" style={{ marginTop: 4, color: 'var(--gold)' }}>
      💸 MONEY MATCH: {displayName(a, save)} vs {displayName(b, save)} — {
        daysAway <= 0 ? 'TONIGHT at 7 PM' : daysAway === 1 ? 'tomorrow' : `in ${daysAway} days`
      }
    </div>
  )
}

// ---------- Live (hour-by-hour) view ----------

// Route each event to the zone of the arcade where it's happening.
function splitZones(hour) {
  const setups = []
  const concession = []
  const floor = []
  for (const ev of hour.events) {
    if (ev.type === 'match' || ev.type === 'technique') setups.push(ev)
    else if (ev.type === 'interaction') {
      if (ev.where && ev.where.startsWith('playing')) floor.push(ev)
      else concession.push(ev)
    } else if (ev.type === 'idle') concession.push(ev)
    else floor.push(ev)
  }
  return { setups, concession, floor }
}

function LiveDay({ save, nav }) {
  const { mutate } = useStore()
  const dip = save.dayInProgress
  const [viewHour, setViewHour] = useState(null) // null = latest
  const [zone, setZone] = useState(null) // null = overview map
  const hourIdx = viewHour ?? dip.hours.length - 1
  const hour = dip.hours[hourIdx]
  const isCurrent = hourIdx === dip.hours.length - 1

  // Put one match per hour on the arcade's stream channel.
  const streamMatch = (setupIndex) => mutate((s) => {
    const d = s.dayInProgress
    if (!d) return
    const h = d.hours[hourIdx]
    if (!h || h.streamedSetup != null) return
    const ev = h.events.find((e) => e.type === 'match' && e.setupIndex === setupIndex)
    if (!ev || ev.stream) return
    const a = s.players[ev.aId]
    const b = s.players[ev.bId]
    if (!a || !b) return
    h.streamedSetup = setupIndex
    ev.stream = buildStreamForPlayers(s, a, b, ev, 'daily')
  })

  if (!hour) return <div className="card"><p className="dim">The doors just opened…</p></div>

  const zones = splitZones(hour)
  if (hourIdx === 0) zones.floor = [...dip.openingEvents, ...zones.floor]
  const matchCount = zones.setups.filter((e) => e.type === 'match').length
  const railbirds = zones.setups.reduce((n, e) => n + (e.watcherIds?.length || 0), 0)
  const concessionPeople = new Set(zones.concession.flatMap((e) => e.memberIds || [])).size
  const floorGroups = zones.floor.filter((e) => e.type === 'interaction').length

  const zoneMeta = {
    setups: { icon: '🕹', title: 'The Setups', accent: 'var(--pink)', events: zones.setups },
    concession: { icon: '🌭', title: 'Concession Stand', accent: 'var(--gold)', events: zones.concession },
    floor: { icon: '👾', title: 'Arcade Floor', accent: 'var(--cyan)', events: zones.floor },
  }

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

      {zone === null ? (
        <div style={{ marginTop: 10 }}>
          <div className="grid3">
            <ZoneCard meta={zoneMeta.setups} onClick={() => setZone('setups')}
              teaser={matchCount === 0 ? `no games of ${save.game.name} running`
                : `${matchCount} match${matchCount === 1 ? '' : 'es'} under way${railbirds ? ` · ${railbirds} watching` : ''}`} />
            <ZoneCard meta={zoneMeta.concession} onClick={() => setZone('concession')}
              teaser={concessionPeople === 0 ? 'quiet right now'
                : `${concessionPeople} ${concessionPeople === 1 ? 'person' : 'people'} hanging out`} />
            <ZoneCard meta={zoneMeta.floor} onClick={() => setZone('floor')}
              teaser={floorGroups === 0 ? 'the side cabinets sit idle'
                : `${floorGroups} group${floorGroups === 1 ? '' : 's'} on the side cabinets`} />
          </div>

          <div className="card" style={{ marginTop: 12 }}>
            <h3>In the building</h3>
            <div className="row">
              {hour.presentIds.map((id) => {
                const p = save.players[id]
                if (!p) return null
                return (
                  <span key={id} className="pill clickable" title={moodLabel(p.mood)}
                    onClick={() => nav('players', { playerId: id })}>
                    {moodFace(p.mood)} {displayName(p, save)}
                  </span>
                )
              })}
              {hour.presentIds.length === 0 && <p className="dim">Nobody around this hour.</p>}
            </div>
          </div>
        </div>
      ) : (
        <ZoneView
          meta={zoneMeta[zone]}
          zone={zone}
          hourIdx={hourIdx}
          isCurrent={isCurrent}
          gameName={save.game.name}
          channelName={save.stream.channelName}
          streamedSetup={hour.streamedSetup}
          onStream={isCurrent ? streamMatch : null}
          back={() => setZone(null)}
        />
      )}
    </div>
  )
}

function ZoneCard({ meta, teaser, onClick }) {
  return (
    <div className="zonecard" style={{ borderColor: meta.accent }} onClick={onClick}>
      <div className="zone-icon">{meta.icon}</div>
      <h3 style={{ color: meta.accent, margin: '4px 0' }}>{meta.title}</h3>
      <p className="dim small" style={{ margin: 0 }}>{teaser}</p>
      <span className="small" style={{ color: meta.accent }}>look around →</span>
    </div>
  )
}

function ZoneView({ meta, zone, hourIdx, isCurrent, gameName, channelName, streamedSetup, onStream, back }) {
  return (
    <div style={{ marginTop: 10 }}>
      <div className="row">
        <button onClick={back}>← Back to the floor plan</button>
        <h3 style={{ color: meta.accent, margin: 0 }}>{meta.icon} {meta.title}</h3>
        {zone === 'setups' && isCurrent && streamedSetup == null && (
          <span className="dim small">pick one match to put on {channelName} this hour</span>
        )}
      </div>
      <div style={{ marginTop: 8 }}>
        {meta.events.length === 0 && (
          <p className="dim">
            {zone === 'setups' ? `Nobody is on ${gameName} right now.`
              : zone === 'concession' ? 'Nobody at the counter. The nacho cheese congeals in peace.'
              : 'The side cabinets blink their attract screens at no one.'}
          </p>
        )}
        {meta.events.map((ev, i) => {
          if (ev.type === 'match') {
            return (
              <LiveMatch
                key={`${hourIdx}-${ev.setupIndex}`} m={ev} spoil={!isCurrent}
                canStream={!!onStream && streamedSetup == null && !ev.stream}
                onStream={onStream ? () => onStream(ev.setupIndex) : null}
              />
            )
          }
          if (ev.type === 'interaction') return <InteractionEvent key={`i${i}`} ev={ev} />
          return <PlainEvent key={`p${i}`} ev={ev} />
        })}
      </div>
    </div>
  )
}

/**
 * A match on a setup. No spoilers: narration reveals line by line and the
 * winner is only announced by the final line. Past hours (and the recap)
 * show results freely.
 */
function LiveMatch({ m, spoil = false, canStream = false, onStream = null }) {
  const [open, setOpen] = useState(false)
  const [revealed, setRevealed] = useState(spoil ? m.narration.length : 0)
  const fullyRevealed = revealed >= m.narration.length

  return (
    <div className={`event match clickable ${m.moneyMatch ? 'moneymatch' : ''}`} onClick={() => setOpen(!open)}>
      <span>
        {m.moneyMatch
          ? <strong className="gold">💸 MONEY MATCH:</strong>
          : <><span>🕹 </span><strong>Setup {m.setupIndex}:</strong></>}{' '}
        {m.aName} ({m.charAName}) vs {m.bName} ({m.charBName})
        {' '}
        {fullyRevealed
          ? <span className="gold">— {m.winnerName} wins</span>
          : <span className="dim small">— in progress…</span>}
        {canStream && revealed === 0 && (m.streamTags || []).length > 0 && (
          <span className="small" style={{ color: 'var(--gold)' }}>
            {' '}· {m.streamTags.join(' · ')}
          </span>
        )}
        {m.stream && <span className="pink small"> · 📡 {m.stream.viewers} viewers</span>}
        {m.watcherNames?.length > 0 && <span className="dim small"> · {m.watcherNames.length} railbirds</span>}
      </span>
      {open && (
        <div className="narration" onClick={(e) => e.stopPropagation()}>
          <MatchHud m={m} revealed={revealed} />
          {canStream && revealed === 0 && (
            <button className="small primary" style={{ marginBottom: 8 }} onClick={onStream}>
              📡 Put this match on stream <span className="small">(before watching — no take-backs)</span>
            </button>
          )}
          <div className={m.stream ? 'stream-split' : ''}>
            <div>
              {(m.preMatch || []).map((s, i) => <SpeechLine key={`pre${i}`} s={s} />)}
              {m.narration.slice(0, revealed).map((l, i) => (
                <Fragment key={i}>
                  <p>{l}</p>
                  {(m.chatter || []).filter((c) => c.at === i).map((c, j) => <SpeechLine key={`c${j}`} s={c} />)}
                </Fragment>
              ))}
              {!fullyRevealed && (
                <button className="small" onClick={() => setRevealed(revealed + 1)}>
                  ▶ {revealed === 0 ? 'Watch the match' : 'What happens next?'}
                </button>
              )}
              {fullyRevealed && (m.postMatch || []).map((s, i) => <SpeechLine key={`post${i}`} s={s} />)}
              {fullyRevealed && (
                <p className="dim small" style={{ fontStyle: 'normal' }}>
                  win chance was {Math.round(m.probA * 100)}%–{Math.round((1 - m.probA) * 100)}% · ±{m.eloDelta} elo
                  {m.watcherNames?.length > 0 && <> · railbirds: {m.watcherNames.join(', ')}</>}
                </p>
              )}
              {fullyRevealed && m.stream && (
                <p className="small pink" style={{ fontStyle: 'normal' }}>
                  📡 stream quality {m.stream.quality}/100 · channel hype {m.stream.gain >= 0 ? '+' : ''}{m.stream.gain}
                </p>
              )}
            </div>
            {m.stream && <StreamChat stream={m.stream} revealed={revealed} />}
          </div>
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
        {(ev.beats || []).map((b, i) => (
          typeof b === 'string'
            ? <p key={`b${i}`} style={{ fontStyle: 'normal' }}>
                {b.includes('(−') ? '💢' : b.includes('(+') ? '✨' : '•'} {b}
              </p>
            : <SpeechLine key={`b${i}`} s={b} />
        ))}
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
    arrival: '🚪', team: '🛡', innovation: '💡', technique: '📈', main: '🎯', mentorship: '🎓',
    idle: '🥤', minigame: '🏅', moneymatch_announce: '💸', economy: '🧾', patch: '🛠',
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
    <div className="grid-main">
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
        className={`match ${ev.moneyMatch ? 'moneymatch' : ''}`}
        summary={
          <span>
            {ev.moneyMatch
              ? <strong className="gold">💸 MONEY MATCH:</strong>
              : <><span>🕹 </span><strong>Setup {ev.setupIndex}:</strong></>}{' '}
            {ev.aName} ({ev.charAName}) vs {ev.bName} ({ev.charBName})
            {' — '}<span className="gold">{ev.winnerName} wins {ev.setScore || ''}</span>
            {ev.stream && <span className="pink small"> · 📡 {ev.stream.viewers} viewers</span>}
          </span>
        }
      >
        <div className="narration">
          <MatchHud m={ev} />
          {(ev.preMatch || []).map((s, i) => <SpeechLine key={`pre${i}`} s={s} />)}
          {ev.narration.map((l, i) => (
            <Fragment key={i}>
              <p>{l}</p>
              {(ev.chatter || []).filter((c) => c.at === i).map((c, j) => <SpeechLine key={`c${j}`} s={c} />)}
            </Fragment>
          ))}
          {(ev.postMatch || []).map((s, i) => <SpeechLine key={`post${i}`} s={s} />)}
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
