import { useState } from 'react'

export function Field({ label, children }) {
  return (
    <div className="field">
      <label>{label}</label>
      {children}
    </div>
  )
}

export function NumField({ label, value, onChange, min = 0, max = 100, step = 1 }) {
  return (
    <Field label={label}>
      <input
        type="number" value={value} min={min} max={max} step={step}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </Field>
  )
}

export function StatBar({ label, value, max = 10, title, color }) {
  return (
    <div className="statbar" title={title}>
      <span className="label">{label}</span>
      <div className="track">
        <div className="fill" style={{ width: `${(value / max) * 100}%`, ...(color ? { background: color } : {}) }} />
      </div>
      <span className="val">{Math.round(value * 10) / 10}</span>
    </div>
  )
}

/**
 * A stat drawn as points rather than a number.
 *
 * "3" is a reading on a dial; three filled dots out of five is an amount of
 * something you spent. The whole build is a point-buy off a fixed allowance,
 * and the dots are what make that legible at a glance — how much sits here,
 * and how much room is left, in the same shape everywhere the stat appears.
 *
 * `granted` is the free point a temperament hands out. It is drawn in the
 * row's colour instead of white, because it is the one point in the row that
 * was never the owner's to spend and cannot be traded away.
 *
 * `compact` is the header variant: smaller, inline, and it wraps — the total
 * allowance can run to thirty dots once a lineage has banked some legacy.
 */
export function PointDots({ label, value, max = 5, granted = 0, color, title, onChange, compact = false }) {
  const v = Math.round(value)
  return (
    <div className={`pdots${compact ? ' compact' : ''}`} title={title}>
      {label != null && <span className="label">{label}</span>}
      <span className="dots">
        {Array.from({ length: max }, (_, i) => i + 1).map((i) => {
          const filled = i <= v
          const isGranted = filled && i <= granted
          return (
            <span
              key={i}
              className={`pdot${filled ? ' on' : ''}${onChange ? ' clickable' : ''}`}
              style={isGranted && color ? { background: color, borderColor: color } : undefined}
              // Clicking the topmost filled dot clears it, so the same row that
              // spends a point can take it back without a second control.
              onClick={onChange ? () => onChange(i === v ? i - 1 : i) : undefined}
            />
          )
        })}
      </span>
    </div>
  )
}

// A list of toggleable string pills.
export function PillPicker({ options, selected, onToggle, badSelected = [] }) {
  return (
    <div>
      {options.map((o) => (
        <span
          key={o}
          className={`pill clickable ${selected.includes(o) ? 'on' : ''} ${badSelected.includes(o) ? 'bad' : ''}`}
          onClick={() => onToggle(o)}
        >
          {o}
        </span>
      ))}
      {options.length === 0 && <span className="dim small">none defined</span>}
    </div>
  )
}

// Free-form string list editor (foods, other games, tags...).
export function StringListEditor({ items, onChange, placeholder = 'add item…' }) {
  const [draft, setDraft] = useState('')
  const add = () => {
    const v = draft.trim()
    if (v && !items.includes(v)) onChange([...items, v])
    setDraft('')
  }
  return (
    <div>
      <div className="row">
        <input
          value={draft} placeholder={placeholder}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
        />
        <button className="small" onClick={add}>Add</button>
      </div>
      <div style={{ marginTop: 6 }}>
        {items.map((it) => (
          <span key={it} className="pill">
            {it}{' '}
            <span
              style={{ cursor: 'pointer', color: 'var(--red)' }}
              onClick={() => onChange(items.filter((x) => x !== it))}
            >
              ×
            </span>
          </span>
        ))}
      </div>
    </div>
  )
}

export function Expandable({ summary, children, className = '' }) {
  const [open, setOpen] = useState(false)
  return (
    <div className={`event clickable ${className}`} onClick={() => setOpen(!open)}>
      {summary}
      {open && <div onClick={(e) => e.stopPropagation()}>{children}</div>}
    </div>
  )
}

// A spoken line: 💬 Name: "words" — with an optional dim consequence note.
export function SpeechLine({ s }) {
  return (
    <p className="speech">
      💬 <strong className="cyan">{s.speaker}</strong>: “{s.text}”
      {s.note && <span className="dim small"> {s.note}</span>}
    </p>
  )
}

// A pixel sprite scaled up crisp. `facing="right"` mirrors it so the two
// sides of a match face each other.
export function Portrait({ url, size = 40, alt = '', facing = 'left', className = '' }) {
  if (!url) return null
  return (
    <img
      className={`pixel-portrait ${className}`}
      src={url} width={size} height={size} alt={alt} title={alt}
      style={facing === 'right' ? { transform: 'scaleX(-1)' } : undefined}
    />
  )
}

export function moodFace(mood) {
  if (mood >= 9) return '🤩'
  if (mood >= 7) return '😄'
  if (mood >= 5) return '🙂'
  if (mood >= 3) return '😕'
  if (mood >= 1) return '😞'
  return '😡'
}
