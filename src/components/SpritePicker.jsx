import { useState } from 'react'
import { Portrait } from './ui.jsx'
import { STAGE_CATALOG } from './art.js'

/**
 * Pick a pixel sprite from a catalog ([{key, url}]). `value` is the chosen
 * key or null for "auto" (the deterministic pick, previewed via `autoUrl`).
 * Collapsed it shows the current sprite; expanded it shows the whole grid.
 */
export function SpritePicker({ catalog, value, onChange, autoUrl = null, size = 34 }) {
  const [open, setOpen] = useState(false)
  const current = value ? catalog.find((c) => c.key === value) : null

  return (
    <div className="spritepicker">
      <div className="row">
        <Portrait url={current ? current.url : autoUrl} size={size} alt={value || 'auto'} className="hud-char" />
        <span className="dim small">{value ? prettyKey(value) : 'auto'}</span>
        <button className="small" onClick={() => setOpen(!open)}>{open ? 'Close' : '✎ Choose sprite'}</button>
      </div>
      {open && (
        <div className="sprite-grid">
          <div
            className={`sprite-cell ${value == null ? 'on' : ''}`}
            title="auto — picked for you, stable per character"
            onClick={() => { onChange(null); setOpen(false) }}
          >
            <Portrait url={autoUrl} size={size} alt="auto" />
            <span className="small dim">auto</span>
          </div>
          {catalog.map((c) => (
            <div
              key={c.key}
              className={`sprite-cell ${value === c.key ? 'on' : ''}`}
              title={prettyKey(c.key)}
              onClick={() => { onChange(c.key); setOpen(false) }}
            >
              <Portrait url={c.url} size={size} alt={prettyKey(c.key)} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/** A stage backdrop thumbnail: parallax layers stacked with CSS. */
export function StageThumb({ layers, width = 96, height = 54, className = '' }) {
  return (
    <div
      className={`stage-thumb ${className}`}
      style={{
        width, height,
        backgroundImage: [...layers].reverse().map((u) => `url(${u})`).join(', '),
      }}
    />
  )
}

/** Pick a stage backdrop. `value` is the bgKey or null for auto. */
export function StagePicker({ value, onChange, autoStage = null }) {
  const [open, setOpen] = useState(false)
  const current = value ? STAGE_CATALOG.find((s) => s.key === value) : null
  const shown = current || autoStage

  return (
    <div className="spritepicker">
      <div className="row">
        {shown && <StageThumb layers={shown.layers} />}
        <span className="dim small">{current ? current.name : `auto${autoStage ? ` (${autoStage.name})` : ''}`}</span>
        <button className="small" onClick={() => setOpen(!open)}>{open ? 'Close' : '✎ Choose backdrop'}</button>
      </div>
      {open && (
        <div className="sprite-grid">
          <div className={`sprite-cell ${value == null ? 'on' : ''}`} title="auto — picked for you, stable per stage"
            onClick={() => { onChange(null); setOpen(false) }}>
            {autoStage ? <StageThumb layers={autoStage.layers} /> : <span className="dim">?</span>}
            <span className="small dim">auto</span>
          </div>
          {STAGE_CATALOG.map((s) => (
            <div key={s.key} className={`sprite-cell ${value === s.key ? 'on' : ''}`} title={s.name}
              onClick={() => { onChange(s.key); setOpen(false) }}>
              <StageThumb layers={s.layers} />
              <span className="small dim">{s.name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function prettyKey(key) {
  return String(key).replaceAll('_', ' ')
}
