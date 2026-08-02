// THE CIRCUIT, MADE LEGIBLE.
//
// The world's calendar was the best thing P4 shipped and the least readable.
// A major fires, sixteen strangers appear, one of them wins, and the record
// says "Spring Major · Japan" — with no statement anywhere of what a major IS,
// how those sixteen got their chairs, how the bracket was drawn, why some
// world-ranked names turned up and others didn't, or why nobody from your room
// was in it. Every one of those is knowable from state the sim already writes
// down. None of it was ever said out loud.
//
// So: four pieces, all reading records rather than re-deriving anything.
//
//   CircuitPrimer   — what the four kinds of event are, permanently, on World
//   MajorSplash     — the title card and the field reveal, before the bracket
//   QualifierSeats  — who is going to the major, at the moment it's decided
//   EntryReport     — who of yours was in it, and one sentence per absence
//
// The rule they share: never invent. If the screen can't point at a specific
// gate the player could act on, it says nothing.

import { useState } from 'react'
import { countryName } from '../game/geo.js'
import { regionFlag } from '../game/flags.js'
import { ENTRY_RULE, SEED_RULE, REGIONAL_CUT, QUALIFIER_BELIEF } from '../game/circuit.js'

const KIND_META = {
  major: { icon: '🏛', label: 'World Major', accent: 'var(--gold)' },
  qualifier: { icon: '🎫', label: 'Qualifier', accent: 'var(--cyan)' },
  regional: { icon: '🗺', label: 'Regionals', accent: 'var(--green)' },
  squad: { icon: '🏮', label: 'Squad Showdown', accent: 'var(--pink)' },
}

export const circuitMeta = (kind) => KIND_META[kind] || null

// How a chair at a major was come by. The four routes in, in the order the
// game fills them, each with the sentence that makes it mean something.
const VIA_META = {
  qualified: { icon: '🎫', label: 'Qualified', blurb: 'won a seat at the qualifier, months ago', color: 'var(--cyan)' },
  vote: { icon: '📣', label: 'Fan vote', blurb: 'voted in by the crowd — personality is access', color: 'var(--pink)' },
  region: { icon: '🌍', label: 'Region seat', blurb: "one of their country's invitations", color: 'var(--gold)' },
  ranking: { icon: '📈', label: 'Ranking', blurb: 'invited to fill the field on world ranking alone', color: 'var(--dim)' },
}

// ---------- The permanent explainer ----------

/**
 * What the circuit IS. Lives on the World tab, open from day one, because the
 * calendar is the thing you are aiming at and a calendar you cannot read is
 * just dates.
 */
export function CircuitPrimer() {
  const [open, setOpen] = useState(false)
  const rows = [
    {
      kind: 'major',
      when: 'three a year — January, April, October',
      what: 'Sixteen chairs, three cities, double elimination. The biggest weekends on earth that are not EVO.',
      how: 'Invitation only. Four chairs go to the host country, two each to the next four strongest scenes, and four are won at the qualifier three months earlier — two by the bracket, two by the crowd’s vote.',
      you: 'Your player needs a seat AND a funded plane ticket. A seat with no fare is an empty chair, and the seat is spent either way.',
    },
    {
      kind: 'qualifier',
      when: 'three a year — March, September, December',
      what: 'Thirty-two names, single elimination, playing for four seats at the major that follows. December’s feeds NEXT January, which is the sharpest budgeting problem on the calendar.',
      how: `Open entry: anyone with belief ${QUALIFIER_BELIEF}+ can claim a place. Up to four of yours ask per event — belief and glory decide which four. The world’s top names don’t bother; they get invited to the major anyway.`,
      you: 'This is the door. Losing early still leaves the fan vote — two of the four seats go to whoever the crowd liked, which is what the stream is for.',
    },
    {
      kind: 'regional',
      when: 'twice a year — May and November',
      what: `Your country’s own top ${REGIONAL_CUT}, under one roof, double elimination. Winner takes the national season.`,
      how: `The cut is the invitation: be in the top ${REGIONAL_CUT} of the national board. World-ranked countrymen hold board spots but usually don’t travel for it — a regional pays them nothing — so most years the national title is contested by the board itself.`,
      you: 'The rung that makes the middle of the climb real. A year-two player can appear on the national board; nobody appears on the world list in year two.',
    },
    {
      kind: 'squad',
      when: 'once a year — February',
      what: 'Eight crews of four, survivor rules. A player stays on the machine until somebody knocks them off; the first crew out of bodies goes home.',
      how: 'National crews, strongest scenes first. Your arcade gets a chair the day one of yours cracks the world top 64 — and then it is one funded trip for four seats.',
      you: 'Your best four, ordered weakest-first with the ace anchoring. Staying on costs you: fatigue stacks every set you survive.',
    },
  ]
  return (
    <div className="card">
      <div className="row spread clickable" style={{ cursor: 'pointer' }} onClick={() => setOpen(!open)}>
        <h3 style={{ margin: 0 }}>🗓 How the circuit works</h3>
        <span className="small cyan">{open ? '▾ hide' : '▸ majors, qualifiers, regionals, crews'}</span>
      </div>
      {!open && (
        <p className="dim small" style={{ margin: '6px 0 0' }}>
          Ten fixed dates a year the whole planet runs on, plus EVO in June. For the first
          couple of years most of them are things you WATCH — that is the point, and this
          explains what you are watching.
        </p>
      )}
      {open && (
        <div style={{ marginTop: 8 }}>
          {rows.map((r) => {
            const meta = KIND_META[r.kind]
            return (
              <div key={r.kind} className="card sub" style={{ margin: '0 0 8px', borderColor: meta.accent }}>
                <div className="row spread">
                  <strong style={{ color: meta.accent }}>{meta.icon} {meta.label}</strong>
                  <span className="dim small">{r.when}</span>
                </div>
                <p className="small" style={{ margin: '4px 0' }}>{r.what}</p>
                <p className="small dim" style={{ margin: '2px 0' }}><strong>Getting in:</strong> {r.how}</p>
                <p className="small dim" style={{ margin: '2px 0' }}><strong>For you:</strong> {r.you}</p>
                <p className="small dim" style={{ margin: '2px 0' }}><strong>The bracket:</strong> {SEED_RULE[r.kind]}.</p>
              </div>
            )
          })}
          <p className="dim small" style={{ margin: 0 }}>
            🌏 EVO sits above all of it, once a year in June — a 64-player open major and the only
            thing on the calendar that decides a world champion.
          </p>
        </div>
      )}
    </div>
  )
}

// ---------- The major's title card ----------

/**
 * A world major, announced. Two beats: the card (which major, where, what is
 * at stake) and the field (all sixteen in seeded order, each with how they got
 * their chair). Then it hands off to the bracket.
 *
 * Deliberately not an EvoWeek-sized broadcast — three of these a year would be
 * three EVO-sized sit-downs, and EVO has to stay the one night that stops the
 * game. This is a title card and a start list, and it is skippable.
 */
export function MajorSplash({ record, onDone }) {
  const [beat, setBeat] = useState('card')
  const host = record.host
  const yours = (record.field || []).filter((f) => f.yours)

  if (beat === 'card') {
    return (
      <div className="circuit-splash" onClick={() => setBeat('field')}>
        <div className="circuit-splash-inner">
          <div className="circuit-splash-kicker">A WORLD MAJOR</div>
          <div className="circuit-splash-flag">{host ? regionFlag(host) : '🌍'}</div>
          <h1 className="circuit-splash-title">{record.name}</h1>
          <div className="circuit-splash-sub">
            {record.dateLabel} · {record.entrantCount} invitations · double elimination
          </div>
          <p className="circuit-splash-blurb">
            Sixteen chairs. Twelve handed out by region, four won at the qualifier.
            {yours.length
              ? ` ${yours.length === 1 ? `${yours[0].name} has one of them.` : `${yours.length} of yours are in the room.`}`
              : ' Nobody from your arcade is in the room.'}
          </p>
          {(record.emptyChairs || []).length > 0 && (
            <p className="circuit-splash-warn">
              🪑 {record.emptyChairs.join(', ')} qualified and stayed home — the fare wasn't there.
            </p>
          )}
          <button className="primary" onClick={(e) => { e.stopPropagation(); setBeat('field') }}>
            See the field →
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="circuit-splash">
      <div className="circuit-splash-inner wide">
        <div className="circuit-splash-kicker">{record.name} — THE FIELD</div>
        <p className="dim small" style={{ margin: '0 0 10px' }}>
          Seeded by elo, top to bottom: seed 1 plays seed 16, and the bracket is drawn from there.
          The tag says how each of them got into the building.
        </p>
        <div className="circuit-field">
          {(record.field || []).map((f) => {
            const v = VIA_META[f.via] || VIA_META.ranking
            return (
              <div key={`${f.seed}-${f.name}`} className={`circuit-seat${f.yours ? ' mine' : ''}`}>
                <span className="circuit-seed">{f.seed}</span>
                <span className="circuit-seat-name">
                  {f.region ? `${regionFlag(f.region)} ` : ''}
                  <strong className={f.yours ? 'cyan' : ''}>{f.name}</strong>
                  {f.char && <span className="dim small"> · {f.char}</span>}
                </span>
                <span className="circuit-via" style={{ color: v.color }} title={v.blurb}>
                  {v.icon} {v.label}
                </span>
                <span className="dim small">{f.elo}</span>
              </div>
            )
          })}
        </div>
        <div className="row" style={{ marginTop: 10, gap: 14, flexWrap: 'wrap' }}>
          {Object.entries(VIA_META).map(([k, v]) => (
            <span key={k} className="small dim">
              <span style={{ color: v.color }}>{v.icon} {v.label}</span> — {v.blurb}
            </span>
          ))}
        </div>
        <button className="primary" style={{ marginTop: 12 }} onClick={onDone}>
          Start the bracket ▶
        </button>
      </div>
    </div>
  )
}

// ---------- The qualifier's payoff ----------

/**
 * "Who is going to the major." A qualifier's whole point is a date three
 * months away, and that connection used to live only in engine state — the
 * seats went into `circuit.seats` and the player was left to remember across a
 * season. This is the boarding pass, on the record.
 */
export function QualifierSeats({ record }) {
  const q = record.qualifiedFor
  if (!q || !q.seats?.length) return null
  const mine = q.seats.filter((s) => s.yours)
  return (
    <div className="card" style={{ borderColor: 'var(--cyan)' }}>
      <div className="row spread">
        <h3 className="cyan" style={{ margin: 0 }}>🎫 Going to {q.majorName}</h3>
        <span className="dim small">
          {q.daysAway > 0 ? `in ${q.daysAway} days` : 'the date is set'}
        </span>
      </div>
      <p className="dim small" style={{ margin: '4px 0 8px' }}>
        Four seats came out of this bracket: the finalists by right, and two more voted in by the
        crowd. They join the twelve names their regions send.
      </p>
      {q.seats.map((s, i) => (
        <div className="row spread" key={i} style={{ borderBottom: '1px solid var(--border)', padding: '4px 0' }}>
          <span>
            <span style={{ color: s.via === 'bracket' ? 'var(--cyan)' : 'var(--pink)' }}>
              {s.via === 'bracket' ? '🎫' : '📣'}
            </span>{' '}
            <strong className={s.yours ? 'cyan' : ''}>{s.name}</strong>
            {s.yours && <span className="cyan small"> — yours</span>}
          </span>
          <span className="dim small">
            {s.via === 'bracket'
              ? `by right — finished ${s.place === 1 ? '1st' : '2nd'}`
              : 'by the crowd — fan vote'}
          </span>
        </div>
      ))}
      {mine.length > 0 && (
        <p className="small gold" style={{ margin: '8px 0 0' }}>
          ✈️ The seat is won. The trip still has to be paid for when the ask comes in — three weeks
          out, and a chair with no plane ticket sits empty.
        </p>
      )}
    </div>
  )
}

// ---------- Who of yours was in it ----------

/**
 * The answer to "why am I watching this?". Names everyone of yours who was in
 * the field, and for everyone who wasn't, the specific gate they failed. A
 * reason the player can act on, or none at all.
 */
export function EntryReport({ record }) {
  const e = record.entry
  if (!e) return null
  const kind = record.circuitKind
  const meta = KIND_META[kind]
  if (!meta) return null
  return (
    <div className="card" style={{ borderColor: e.entered.length ? 'var(--green)' : 'var(--border)' }}>
      <div className="row spread">
        <h3 style={{ margin: 0 }}>
          {e.entered.length ? '🎽 Your arcade in this one' : '📺 Nobody of yours is in this one'}
        </h3>
        <span className="dim small">{meta.icon} {meta.label}</span>
      </div>
      <p className="dim small" style={{ margin: '4px 0 8px' }}>
        <strong>Entry:</strong> {e.rule}. <strong>Bracket:</strong> {e.seeding}.
      </p>
      {e.entered.length > 0 && (
        <p className="small green" style={{ margin: '0 0 6px' }}>
          In the field: {e.entered.map((x) => x.name).join(', ')}.
        </p>
      )}
      {e.missed.length === 0 && e.entered.length === 0 && (
        <p className="small dim" style={{ margin: 0 }}>
          You have nobody eligible yet. That is the normal state of the first couple of years —
          the circuit is something you watch until it isn't.
        </p>
      )}
      {/* GROUPED BY REASON. Six people can fail the same gate for the same
          reason — "no seat: a major is invitation only" is one fact about your
          room, not six facts about six people — and printing the sentence six
          times buries the one line that is actually about a decision you made.
          Anything you chose (a trip you didn't fund, an ask you never answered)
          stays on its own row and stays first. */}
      {(() => {
        const mine = e.missed.filter((m) => m.yours)
        const rest = e.missed.filter((m) => !m.yours)
        const grouped = []
        for (const m of rest) {
          const g = grouped.find((x) => x.reason === m.reason)
          if (g) g.names.push(m.name)
          else grouped.push({ reason: m.reason, names: [m.name] })
        }
        return (
          <>
            {mine.map((m) => (
              <div className="row spread" key={m.id} style={{ borderBottom: '1px solid var(--border)', padding: '3px 0' }}>
                <span className="small">⚠️ {m.name}</span>
                <span className="small gold" style={{ textAlign: 'right', maxWidth: '65%' }}>{m.reason}</span>
              </div>
            ))}
            {grouped.map((g, i) => (
              <div className="row spread" key={i} style={{ borderBottom: '1px solid var(--border)', padding: '3px 0' }}>
                <span className="small">
                  {g.names.slice(0, 3).join(', ')}
                  {g.names.length > 3 && <span className="dim"> and {g.names.length - 3} more</span>}
                </span>
                <span className="small dim" style={{ textAlign: 'right', maxWidth: '65%' }}>{g.reason}</span>
              </div>
            ))}
          </>
        )
      })()}
    </div>
  )
}

/** A short host line for any circuit record — used in headers. */
export const hostLine = (record) =>
  record.host ? `${regionFlag(record.host)} ${countryName(record.host)}` : null

export { ENTRY_RULE }
