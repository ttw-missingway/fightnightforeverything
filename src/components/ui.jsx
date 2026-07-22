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

export function StatBar({ label, value, max = 10, title }) {
  return (
    <div className="statbar" title={title}>
      <span className="label">{label}</span>
      <div className="track"><div className="fill" style={{ width: `${(value / max) * 100}%` }} /></div>
      <span className="val">{Math.round(value * 10) / 10}</span>
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
