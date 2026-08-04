import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from '../state/store.jsx'
import { HOUR_LABELS, WEEKDAYS, formatDay, weekdayOf } from '../game/constants.js'
import { pickVignette } from '../game/auto.js'
import { moodLabel } from '../game/social.js'
import { hiatusActive, hiatusDays } from '../game/hiatus.js'
import { revealState } from '../game/tournament.js'
import MatchPlayback from '../components/MatchPlayback.jsx'
import { SpeechLine, moodFace } from '../components/ui.jsx'
import { liveToasts, dismissToast } from '../game/notify.js'

/**
 * SPECTATOR MODE — the run, playing itself, with you watching.
 *
 * A full-screen stage rather than a panel on the Arcade tab. The overlays only
 * make sense against a dedicated surface, and more to the point this is a
 * different POSTURE: the arcade screen is a desk you work at, and this is a
 * chair you sit in. It borrows nothing from the nav.
 *
 * THE BEAT IS THE UNIT, NOT THE SECOND. There is no tick interval driving
 * this. Each in-game hour produces one vignette, and the stage advances when
 * that vignette has finished saying what it had to say: a match plays all the
 * way to its last exchange, a conversation holds for a few seconds, a day's
 * recap gets a breath. The speed control scales the dwell times of everything
 * EXCEPT matches, which run at their own reading pace — speeding up the fight
 * is what the skip button is for.
 *
 * Taking the wheel is always one click, and never destroys anything: the day
 * is mid-flight in exactly the state it was, and the Arcade picks it up.
 */
export default function Spectator() {
  const { save, spectateStep, stopSpectating, setSpectator, setSpectatorAuthority } = useStore()
  const spec = save.spectator || {}
  const paused = !!spec.paused
  const speed = spec.speed || 1

  // What is currently on the stage. Held in React state rather than derived
  // from the save because a beat OUTLIVES the mutation that produced it — the
  // save has already moved on to the next hour by the time you finish reading
  // the last one.
  const [beat, setBeat] = useState(null)
  const timer = useRef(null)
  const running = useRef(false)

  const clearTimer = () => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null }
  }

  // One beat: step the world, work out what it produced, and put it up.
  //
  // The re-entry guard is released in a `finally` on purpose. Held in the
  // happy path only, one throw anywhere in the engine would latch it true and
  // every later beat would return at the first line — a hard freeze with an
  // empty console, which is exactly the failure that is hardest to diagnose
  // from a screenshot. A crash should stop the stage and SAY so.
  const step = useCallback(() => {
    if (running.current) return
    running.current = true
    let outcome
    try {
      outcome = spectateStep()
    } catch (err) {
      running.current = false
      console.error('spectator step failed', err)
      setBeat({ kind: 'error', error: err })
      return
    }
    running.current = false
    if (!outcome) { setBeat({ kind: 'over' }); return }
    setBeat(makeBeat(outcome))
  }, [spectateStep])

  // Kick off, then let the WATCHDOG be the only thing this level times.
  //
  // The parent used to guess how long each beat needed — matches wait for a
  // callback, cards get a clock — which meant two places had to agree about
  // whether a given beat was playable. They disagreed exactly once, on a
  // bracket set with no narration, and the stage froze silently: the timer
  // thought a match was running, the stage was showing a card, and neither
  // was going to move. So the timing moved to whoever renders the thing
  // (`useHold` below), and what is left here is a backstop long enough that
  // no real set is ever cut short.
  useEffect(() => {
    if (paused) { clearTimer(); return }
    if (!beat) { step(); return }
    if (beat.kind === 'over' || beat.kind === 'error') return
    clearTimer()
    timer.current = setTimeout(step, WATCHDOG_MS)
    return clearTimer
  }, [beat, paused, step])

  // Nothing on stage yet, and the run is over: say so rather than sitting on a
  // blank screen waiting for a beat that will never come.
  const ended = beat?.kind === 'over'
  const crashed = beat?.kind === 'error'

  return (
    <div className={`spectator${spec.showFeed || spec.showBracket ? ' feed-on' : ''}${spec.showBoard ? ' board-on' : ''}`}>
      <StageHeader save={save} />

      <div className="spectator-stage">
        {crashed
          ? <div className="card" style={{ borderColor: 'var(--red)' }}>
              <h3 className="red" style={{ marginTop: 0 }}>The broadcast cut out.</h3>
              <p className="dim">Something went wrong simulating that beat. Take the wheel — the run itself is
              intact and the day picks up where it stopped.</p>
              <p className="dim small">{String(beat.error?.message || beat.error)}</p>
            </div>
          : ended
            ? <div className="card"><h3 style={{ marginTop: 0 }}>The run is over.</h3>
                <p className="dim">There is nothing left to watch. Take the wheel to see how it ended.</p></div>
            : <Stage save={save} beat={beat} speed={speed} onDone={step} />}
      </div>

      {/* Two rails of furniture. Stacked in a column rather than positioned
          individually, because the moment there was a third widget the
          absolute-positioned ones started landing on each other. */}
      <div className="spectator-rail spectator-rail-left">
        {spec.showBracket && <BracketOverlay save={save} beat={beat} />}
        {spec.showFeed && <FeedOverlay save={save} />}
      </div>
      <div className="spectator-rail spectator-rail-right">
        {spec.showBoard && <BoardOverlay save={save} />}
      </div>
      <DecisionToasts save={save} />

      <Controls
        save={save}
        spec={spec}
        onPause={() => setSpectator({ paused: !paused })}
        onSpeed={(v) => setSpectator({ speed: v })}
        onToggle={(k) => setSpectator({ [k]: !spec[k] })}
        onSkip={step}
        onAuthority={setSpectatorAuthority}
        onLeave={stopSpectating}
      />
    </div>
  )
}

// ---------- turning an outcome into something to look at ----------

// How long a non-match beat holds the stage, in ms at 1x. A conversation needs
// long enough to actually read; a one-line note does not.
const DWELL = { talk: 4200, note: 2600, recap: 3400, quiet: 1800, pool: 1500 }
// How long a self-timing beat may hold the stage before the loop moves on
// regardless. Long enough that no real set is ever cut short — a five-game
// narration runs well under this — and short enough that a stall is a pause,
// not the end of the session.
const WATCHDOG_MS = 90000

function makeBeat(outcome) {
  if (outcome.type === 'tournament-reveal' || outcome.type === 'tournament') {
    return { kind: 'tournament', record: outcome.record }
  }
  if (outcome.type === 'recap') return { kind: 'recap' }
  return { kind: 'hour' }
}

/**
 * Hold this view for `ms`, then advance. The unit of timing is whatever is
 * actually on screen, so a view that renders a card asks for a card's worth of
 * time and a view that renders a match asks for none — there is no second
 * opinion to disagree with.
 */
function useHold(ms, onDone) {
  useEffect(() => {
    if (!ms) return
    const h = setTimeout(onDone, ms)
    return () => clearTimeout(h)
  }, [ms, onDone])
}

/** A card: whatever is inside it, held for a readable beat. */
function Held({ ms, onDone, children }) {
  useHold(ms, onDone)
  return children
}

/** The set the reveal counter is currently pointing at, or null. */
function currentSet(record) {
  if (!record) return null
  const state = revealState(record)
  if (state.revealedCount <= 0) return null
  const m = state.flat[state.revealedCount - 1]?.m
  return m && !m.bye ? m : null
}

/** Which round that set belongs to — "Pool N · Round 2", "Top 16 · Grand Finals". */
function currentRound(record) {
  if (!record) return null
  const state = revealState(record)
  if (state.revealedCount <= 0) return null
  const ri = state.flat[state.revealedCount - 1]?.ri
  return ri == null ? null : record.rounds?.[ri] || null
}

/**
 * The stage. Reads the hour that was just simulated straight off the save and
 * picks its one shot (auto.js pickVignette): the setups first, because that is
 * what the arcade is for, then whatever the room was doing instead.
 */
function Stage({ save, beat, speed, onDone }) {
  const dip = save.dayInProgress
  // Computed BEFORE any early return — this is a hook, and the branches below
  // are not all taken on every render.
  const hour = dip?.hours?.[dip.hours.length - 1]
  const vignette = useMemo(() => pickVignette(save, hour), [save, hour])
  const label = hour?.label || ''

  if (!beat) return <div className="card"><p className="dim">Opening up…</p></div>

  if (beat.kind === 'tournament') {
    return <TournamentStage save={save} record={beat.record} speed={speed} onDone={onDone} />
  }

  if (beat.kind === 'recap') {
    return <Held ms={DWELL.recap / speed} onDone={onDone}><RecapStage save={save} /></Held>
  }

  if (!vignette) {
    return (
      <Held ms={DWELL.quiet / speed} onDone={onDone}>
      <div className="card spectator-card">
        <div className="dim small">{label}</div>
        <p className="dim" style={{ fontSize: 18 }}>
          {hiatusActive(save)
            ? 'The cabinets are dark. A couple of people stand around not playing anything.'
            : 'Quiet hour. Nobody much in.'}
        </p>
      </div>
      </Held>
    )
  }

  if (vignette.kind === 'match' && (vignette.ev.narration || []).length) {
    // A MATCH PLAYS TO ITS END. This is the one beat that decides its own
    // length — onComplete is what advances the clock, so a five-game set holds
    // the stage for five games and a sweep is over quickly. `key` is the match
    // id so React tears the player down and builds a fresh one per match
    // rather than trying to reconcile a half-played narration onto a new one.
    // LET PLAYBACK OWN THE HUD. Mounting MatchHud separately and passing
    // showHud={false} is the ALREADY-CONCLUDED arrangement (see LiveDay): with
    // no `revealed` prop the HUD renders the fully-revealed state, so the bars
    // sat at the end of the set from the first line onwards while the text
    // played out underneath them. MatchPlayback's own HUD is the one wired to
    // `revealed`, `hudState` and the per-hit tick, which is the whole point of
    // watching a match rather than reading its result.
    return (
      <div className="spectator-match">
        <div className="dim small">{label} · the setups</div>
        <MatchPlayback
          key={vignette.ev.id || `${vignette.ev.aId}-${vignette.ev.bId}-${label}`}
          m={vignette.ev}
          autoStart
          onComplete={onDone}
        />
      </div>
    )
  }

  if (vignette.kind === 'talk') {
    const ev = vignette.ev
    return (
      <Held ms={DWELL.talk / speed} onDone={onDone}>
      <div className="card spectator-card">
        <div className="dim small">{label} · {ev.where}</div>
        <h3 style={{ margin: '2px 0 8px' }}>{ev.memberNames.join(', ')}</h3>
        <div className="narration">
          {(ev.beats || []).slice(0, 4).map((b, i) => (
            typeof b === 'string'
              ? <p key={i} style={{ fontStyle: 'normal' }}>{b.includes('(−') ? '💢' : b.includes('(+') ? '✨' : '•'} {b}</p>
              : <SpeechLine key={i} s={b} />
          ))}
          {(ev.outcomes || []).map((o, i) => (
            <p key={`o${i}`} className="gold" style={{ fontStyle: 'normal' }}>★ {o}</p>
          ))}
        </div>
      </div>
      </Held>
    )
  }

  // A match with nothing recorded to play (older saves, off-screen rounds) is
  // still the hour's news — say the result rather than falling through to a
  // card with no text in it.
  if (vignette.kind === 'match') {
    const ev = vignette.ev
    return (
      <Held ms={DWELL.note / speed} onDone={onDone}>
        <div className="card spectator-card">
          <div className="dim small">{label} · the setups</div>
          <h3 style={{ margin: '2px 0 6px' }}>{ev.aName} vs {ev.bName}</h3>
          {ev.winnerName && <p className="gold" style={{ fontSize: 18 }}>{ev.winnerName} takes it{ev.score ? ` ${ev.score}` : ''}.</p>}
        </div>
      </Held>
    )
  }

  return (
    <Held ms={DWELL.note / speed} onDone={onDone}>
      <div className="card spectator-card">
        <div className="dim small">{label}</div>
        <p style={{ fontSize: 18 }}>{vignette.ev.text}</p>
      </div>
    </Held>
  )
}

/**
 * A bracket, one match at a time. The engine has already decided the whole
 * event (deterministically); this reveals it set by set, and each set plays
 * out in full exactly like a daily match does.
 */
function TournamentStage({ save, record, speed, onDone }) {
  const rec = record || save.lastTournament
  if (!rec) return <Held ms={DWELL.note / speed} onDone={onDone}><div className="card"><p className="dim">…</p></div></Held>
  const state = revealState(rec)
  const m = currentSet(rec)
  const round = currentRound(rec)
  // A SET WITH NO HEALTH BARS IS A SCORELINE, NOT A BROADCAST.
  //
  // EVO's pool rounds keep their narration but lose `narrationHud` — model.js
  // `compactRecord` strips per-line playback data from pools once a record
  // grows past 700k, because one EVO is otherwise heavy enough that the browser
  // refuses the write. Played through the full player, those sets render as an
  // unmoored wall of text with no fight above it, which is what a HUD-less
  // broadcast looks like.
  //
  // They are also, in compactRecord's own words, "sixty rounds of two-player
  // sets between people you have never heard of" — ninety-six of them at 128
  // entrants. Reading every line of those at broadcast pace is not a watch, it
  // is a sentence. So a set the game threw the bars away for is CALLED rather
  // than aired: who beat whom, briefly, and on to the next. Everything from
  // Media Day forward keeps its full playback.
  const aired = m && (m.narration || []).length > 0 && (m.narrationHud || []).length > 0
  const called = m && !aired && !!m.winnerName

  return (
    <div className="spectator-match">
      <div className="row spread">
        <span className="pink">🏆 {rec.name}{round?.title ? <span className="dim"> · {round.title}</span> : null}</span>
        <span className="dim small">
          {state.done ? 'the bracket is complete' : `match ${state.revealedCount} of ${state.flat.length}`}
        </span>
      </div>
      {aired ? (
        <MatchPlayback key={m.id} m={m} autoStart onComplete={onDone} />
      ) : called ? (
        <Held ms={DWELL.pool / speed} onDone={onDone}>
          <div className="card spectator-card" style={{ minHeight: 120 }}>
            <div className="row spread">
              <span className={m.winnerName === m.aName ? 'gold' : 'dim'}>
                {m.aName} {m.aChar && <span className="small dim">({m.aChar})</span>}
              </span>
              <span className="dim small">vs</span>
              <span className={m.winnerName === m.bName ? 'gold' : 'dim'}>
                {m.bName} {m.bChar && <span className="small dim">({m.bChar})</span>}
              </span>
            </div>
            <p style={{ fontSize: 18, margin: '8px 0 0' }}>
              <span className="gold">{m.winnerName}</span> takes it{m.score ? ` ${m.score}` : ''}.
            </p>
            <p className="dim small" style={{ margin: '6px 0 0' }}>
              Pool sets are called from the desk — the bracket gets the full broadcast.
            </p>
          </div>
        </Held>
      ) : (
        <Held ms={DWELL.note / speed} onDone={onDone}>
          <div className="card spectator-card">
            {/* THE CHAMPION IS A SPOILER UNTIL THE BRACKET SAYS SO.
                `rec.champion` is written the instant the event is simulated,
                which is before the first set is even shown — reading it here
                announced the winner at match 8 of 15. It is only news once the
                reveal has caught up. */}
            {state.done && rec.champion
              ? <h3 className="gold" style={{ marginTop: 0 }}>🏆 {rec.champion} takes it.</h3>
              : m
                ? (
                  <>
                    <h3 style={{ margin: '2px 0 6px' }}>{m.aName} vs {m.bName}</h3>
                    {m.winnerName && <p className="gold" style={{ fontSize: 18 }}>
                      {m.winnerName} takes it{m.score ? ` ${m.score}` : ''}.
                    </p>}
                  </>
                )
                : <p className="dim">The next set is being called…</p>}
          </div>
        </Held>
      )}
    </div>
  )
}

function RecapStage({ save }) {
  const r = save.lastDayReport
  const net = save.economy?.history?.at(-1)?.net ?? null
  if (!r) return <div className="card"><p className="dim">Closing up…</p></div>
  return (
    <div className="card spectator-card">
      <div className="dim small">last night</div>
      <h3 style={{ margin: '2px 0 8px' }}>{r.dateLabel}</h3>
      <div className="row" style={{ gap: 18, flexWrap: 'wrap' }}>
        <Stat label="through the door" value={(r.attendeeIds || []).length} />
        <Stat label="on the night" value={net == null ? '—' : `${net >= 0 ? '+' : '−'}$${Math.abs(Math.round(net))}`} />
        <Stat label="in the bank" value={`$${Math.round(save.economy?.money ?? 0)}`} />
      </div>
      {(save.chronicle || []).slice(0, 3).map((c, i) => (
        <p key={i} className="small" style={{ margin: '4px 0 0' }}>{c.icon} {c.text}</p>
      ))}
    </div>
  )
}

const Stat = ({ label, value }) => (
  <div>
    <div className="dim small">{label}</div>
    <div style={{ fontSize: 20 }}>{value}</div>
  </div>
)

// ---------- chrome ----------

function StageHeader({ save }) {
  const dip = save.dayInProgress
  return (
    <div className="spectator-header">
      <div>
        <strong>{save.arcade.name}</strong>
        <span className="dim"> · {WEEKDAYS[weekdayOf(save.day)]}, {formatDay(save.day, save.year)}</span>
        {dip && save.hour > 0 && <span className="dim"> · {HOUR_LABELS[Math.min(save.hour, HOUR_LABELS.length) - 1]}</span>}
      </div>
      <div className="dim small">
        {hiatusActive(save)
          ? <span className="gold">🔌 setups closed · {hiatusDays(save)}d</span>
          : <>${Math.round(save.economy?.money ?? 0)} · relevance {Math.round(save.relevance ?? 55)}</>}
      </div>
    </div>
  )
}

/**
 * WHERE WE ARE IN THE BRACKET.
 *
 * Only up during an event, and grouped by PHASE rather than listing rounds:
 * a Weekly has seven sets across three rounds and EVO has a hundred and
 * twenty-eight across sixty, so a flat list of round titles is either trivial
 * or unreadable and never in between. Phases collapse EVO to "pools, media
 * day, top 16" while a local bracket, which has no phases, falls back to its
 * rounds — the same widget reads correctly at both sizes.
 *
 * Deliberately shows PROGRESS, never the result: `rec.champion` is written the
 * moment the event is simulated, so anything that peeks past the reveal
 * counter is a spoiler (the stage itself learned this the hard way).
 */
function BracketOverlay({ save, beat }) {
  const rec = beat?.kind === 'tournament'
    ? (beat.record || save.lastTournament)
    : null
  if (!rec || !(rec.rounds || []).length) return null
  const state = revealState(rec)
  const here = currentRound(rec)

  // Phase -> {label, done, total}. Rounds carry `phase` on the big events;
  // a local bracket has none, so each round stands as its own group.
  const groups = []
  let seen = 0
  for (const round of rec.rounds) {
    const n = (round.matches || []).length
    const key = round.phase || round.title
    const label = round.phase ? PHASE_LABELS[round.phase] || round.phase : round.title
    let g = groups.find((x) => x.key === key)
    if (!g) { g = { key, label, total: 0, done: 0, current: false }; groups.push(g) }
    g.total += n
    g.done += Math.max(0, Math.min(n, state.revealedCount - seen))
    if (round === here) g.current = true
    seen += n
  }

  return (
    <div className="spectator-overlay">
      <div className="row spread" style={{ marginBottom: 4 }}>
        <span className="dim small">🏆 the bracket</span>
        <span className="dim small">{state.revealedCount}/{state.flat.length}</span>
      </div>
      {groups.map((g) => (
        <div key={g.key} style={{ marginBottom: 5 }}>
          <div className="row spread">
            <span className={`small ${g.current ? 'pink' : g.done >= g.total ? 'dim' : ''}`}>
              {g.current ? '▶ ' : g.done >= g.total ? '✓ ' : ''}{g.label}
            </span>
            <span className="dim small">{g.done}/{g.total}</span>
          </div>
          <div style={{ height: 3, background: 'var(--bg2)', borderRadius: 2, overflow: 'hidden', marginTop: 2 }}>
            <div style={{
              width: `${g.total ? Math.round((g.done / g.total) * 100) : 0}%`,
              height: '100%',
              background: g.current ? 'var(--pink)' : 'var(--cyan)',
            }} />
          </div>
        </div>
      ))}
      {here?.title && <div className="dim small" style={{ marginTop: 2 }}>{here.title}</div>}
    </div>
  )
}

const PHASE_LABELS = {
  pools: 'Pools',
  media: 'Media Day',
  top16: 'Top 16',
  bracket: 'Bracket',
}

/**
 * THE FEED, as an overlay. Deliberately the world's chatter rather than the
 * day's events — what is happening is already on the stage, and the thing a
 * broadcast wants alongside it is the room talking about it.
 */
function FeedOverlay({ save }) {
  const posts = (save.socialFeed || []).slice(0, 6)
  if (!posts.length) return null
  return (
    <div className="spectator-overlay">
      <div className="dim small" style={{ marginBottom: 4 }}>📱 the feed</div>
      {posts.map((p) => (
        <div key={p.id} className="small" style={{ marginBottom: 6, opacity: 0.92 }}>
          {p.title && <div className="cyan">{p.title}</div>}
          <div className="dim">{p.text}</div>
        </div>
      ))}
    </div>
  )
}

function BoardOverlay({ save }) {
  const top = Object.values(save.players || {})
    .filter((p) => p.isRegular && !p.retired && !p.banished)
    .sort((a, b) => (b.elo || 0) - (a.elo || 0))
    .slice(0, 8)
  if (!top.length) return null
  return (
    <div className="spectator-overlay">
      <div className="dim small" style={{ marginBottom: 4 }}>🏅 the room</div>
      {top.map((p, i) => (
        <div key={p.id} className="row spread small" style={{ gap: 10 }}>
          <span className={p.npc ? 'dim' : ''}>
            <span className="dim">{i + 1}.</span> {p.alias || p.firstName}
          </span>
          <span className="dim" title={moodLabel(p.mood)}>{moodFace(p.mood)} {Math.round(p.elo || 0)}</span>
        </div>
      ))}
    </div>
  )
}

/**
 * WHAT THE COMPUTER JUST DECIDED.
 *
 * Spectator mode takes over the whole screen, which means it takes over App's
 * toast layer too — and the toasts are the entire reason the decisions are
 * watchable rather than merely happening. Without this the arcade hires
 * someone, ships a patch and answers a breakthrough while you sit there
 * looking at a conversation about snacks.
 *
 * Not clickable through to the screen they name: "see it" would drop you out
 * of the broadcast, and if you want to go and look, that is what taking the
 * wheel is for. They are dismissible and they age out on their own.
 */
function DecisionToasts({ save }) {
  const { mutate } = useStore()
  const rows = liveToasts(save).slice(0, 4)
  if (!rows.length) return null
  return (
    <div className="spectator-toasts">
      {rows.map((t) => (
        <div key={t.id} className="card" style={{ margin: 0, padding: '8px 10px', display: 'flex', gap: 8, alignItems: 'center', borderColor: t.sticky ? 'var(--gold)' : 'var(--border)' }}>
          <span>{t.icon}</span>
          <span className="small" style={{ flex: 1 }}>{t.text}</span>
          <button className="small" onClick={() => mutate((s2) => dismissToast(s2, t.id), { ack: true })} title="dismiss">✕</button>
        </div>
      ))}
    </div>
  )
}

const SPEEDS = [0.5, 1, 2, 4]

/**
 * WHAT THE COMPUTER MAY DO WITHOUT YOU.
 *
 * Breakthroughs are on by default because the cast is actively waiting on that
 * answer and stalling it is worse than answering it. The other three are off:
 * banishing someone is permanent, and laying people off or selling cabinets
 * quietly dismantles a floor you are going to take back. Every one of them is
 * grantable — the brain can drive every lever in the game, it just is not
 * assumed to be allowed to.
 */
const AUTHORITY_ROWS = [
  ['eureka', 'breakthroughs', 'spend the cast\u2019s breakthrough points as they arrive'],
  ['hiatus', 'close the setups', 'shut the cabinets to cool the room off when bad blood spreads'],
  ['downsize', 'downsize', 'lay staff off and sell cabinets rather than let the books go under'],
  ['banish', 'bans', 'throw the source of a feud out. Permanent, and it costs you'],
]

function AuthorityPanel({ spec, onSet }) {
  const [open, setOpen] = useState(false)
  const auth = spec.authority || {}
  const on = AUTHORITY_ROWS.filter(([k]) => auth[k]).length
  return (
    <div style={{ position: 'relative' }}>
      <button className="small" onClick={() => setOpen(!open)}
        title="what the computer is allowed to decide on its own">
        🎛 Authority <span className="dim">({on}/{AUTHORITY_ROWS.length})</span>
      </button>
      {open && (
        <div className="card" style={{
          position: 'absolute', bottom: '110%', right: 0, width: 320, zIndex: 70, margin: 0, padding: '10px 12px',
        }}>
          <div className="small dim" style={{ marginBottom: 6 }}>
            The computer runs everything else — hiring, pricing, stock, ads, the floor, the road, patches.
            These are the ones it asks about.
          </div>
          {AUTHORITY_ROWS.map(([key, label, blurb]) => (
            <label key={key} style={{ display: 'flex', gap: 6, alignItems: 'flex-start', marginBottom: 6 }}>
              <input type="checkbox" checked={!!auth[key]} onChange={(e) => onSet(key, e.target.checked)} />
              <span className="small">
                {label}
                <span className="dim"> — {blurb}</span>
              </span>
            </label>
          ))}
        </div>
      )}
    </div>
  )
}

function Controls({ spec, onPause, onSpeed, onToggle, onSkip, onLeave, onAuthority }) {
  return (
    <div className="spectator-controls">
      <button className="primary small" onClick={onPause}>{spec.paused ? '▶ Play' : '⏸ Pause'}</button>
      <button className="small" onClick={onSkip} title="jump to the next beat">⏭ Skip</button>
      <select value={spec.speed || 1} onChange={(e) => onSpeed(Number(e.target.value))}
        title="how long each beat holds — matches always play at reading pace">
        {SPEEDS.map((v) => <option key={v} value={v}>{v}×</option>)}
      </select>
      <span className="spectator-sep" />
      <label className="small" style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
        <input type="checkbox" checked={!!spec.showFeed} onChange={() => onToggle('showFeed')} />
        <span className="dim">feed</span>
      </label>
      <label className="small" style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
        <input type="checkbox" checked={!!spec.showBoard} onChange={() => onToggle('showBoard')} />
        <span className="dim">leaderboard</span>
      </label>
      <label className="small" style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}
        title="where we are in the bracket — only up during an event">
        <input type="checkbox" checked={!!spec.showBracket} onChange={() => onToggle('showBracket')} />
        <span className="dim">bracket</span>
      </label>
      <span className="spectator-sep" />
      <AuthorityPanel spec={spec} onSet={onAuthority} />
      <button className="small" style={{ borderColor: 'var(--pink)', color: 'var(--pink)' }} onClick={onLeave}>
        🎮 Take the wheel
      </button>
    </div>
  )
}
