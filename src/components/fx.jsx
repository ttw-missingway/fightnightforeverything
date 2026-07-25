/**
 * The VFX layer for the fight screen: comic-book impact words, hit sparks,
 * projectiles crossing the stage, and the flash on a KO.
 *
 * Everything here is drawn with CSS — no image assets, so effects inherit the
 * theme's colours, scale with the arena, and cost nothing to load. The ENGINE
 * decides what fires (`meta.fx`), this only draws it, which keeps replays of
 * the same seed visually identical.
 *
 * A pulse is one firing. MatchPlayback bumps `pulse.key` per tick, and the
 * keyed remount is what restarts the CSS animation — a seven-hit combo pops
 * seven sparks.
 */

const KIND_STYLE = {
  impact: { spark: 'var(--gold)', glow: 'rgba(255, 206, 79, 0.55)' },
  super: { spark: 'var(--pink)', glow: 'rgba(255, 45, 120, 0.65)' },
  grab: { spark: 'var(--red, #ff5f5f)', glow: 'rgba(255, 95, 95, 0.55)' },
  projectile: { spark: 'var(--cyan)', glow: 'rgba(45, 226, 230, 0.55)' },
  block: { spark: '#9fb3c8', glow: 'rgba(159, 179, 200, 0.45)' },
  dizzy: { spark: 'var(--gold)', glow: 'rgba(255, 206, 79, 0.5)' },
  drop: { spark: '#9fb3c8', glow: 'rgba(159, 179, 200, 0.35)' },
  whiff: { spark: '#7b8794', glow: 'rgba(123, 135, 148, 0.25)' },
}

/**
 * `pulse`: { key, t, side, mag, word, ko } — or null for lines with no visual.
 * `side` is the side taking the hit: 'A' is the left fighter, 'B' the right.
 */
// Projectile forms that need their own motion, not just their own colour.
const PROJECTILE_SHAPE = {
  'beam': 'beam',
  'screen-filling beam': 'beam',
  'arcing lob': 'arc',
  'burrowing': 'ground',
  'rolling': 'ground',
  'boomerang': 'boomerang',
}

export default function FxLayer({ pulse }) {
  if (!pulse || !pulse.t) return null
  const { t, side, mag = 0.4, word, ko, form, guard, tick = 0 } = pulse
  // A projectile has to cross the arena before it can hit anything. Without
  // this the impact fired the moment the shot launched, so the burst went off
  // next to the thrower while the projectile was still in the air.
  const awaitFlight = t === 'projectile' && tick === 0 ? 'after-flight' : ''
  // An overhead lands from above and a low from underneath — the guard
  // property is the whole guessing game, so it should be visible.
  const height = guard === 'overhead' ? 'high' : guard === 'low' ? 'low' : ''
  const shape = PROJECTILE_SHAPE[form] || ''
  const style = KIND_STYLE[t] || KIND_STYLE.impact
  const hitLeft = side === 'A'
  // Scale the whole effect with how hard it landed.
  const size = 40 + mag * 70

  return (
    // NOT keyed as a whole. Keying the layer meant every child was destroyed
    // and rebuilt on each tick — and since a projectile volley ticks every
    // 95ms while the travel animation runs 300ms, the projectile was killed a
    // third of the way across and never once reached the other fighter.
    <div className="fx-layer" aria-hidden="true">
      {t === 'projectile' && (
        <span
          // Keyed on the LINE, so one shot crosses the whole arena and
          // survives every tick of the volley.
          key={`p${pulse.lineKey}`}
          className={`fx-projectile ${hitLeft ? 'to-left' : 'to-right'} ${shape}`}
          style={{ '--fx-spark': style.spark, '--fx-glow': style.glow }}
        />
      )}

      {t !== 'whiff' && t !== 'drop' && (
        <span
          key={`b${pulse.key}`}
          className={`fx-burst ${hitLeft ? 'at-left' : 'at-right'} ${t === 'super' ? 'big' : ''} ${height} ${awaitFlight}`}
          style={{
            '--fx-spark': style.spark,
            '--fx-glow': style.glow,
            '--fx-size': `${size}px`,
          }}
        />
      )}

      {t === 'whiff' && (
        <span key={`s${pulse.key}`} className={`fx-swish ${hitLeft ? 'at-right' : 'at-left'}`} />
      )}

      {/* Dizzy: stars going round over their head, the way they should. */}
      {t === 'dizzy' && (
        <span key={`d${pulse.lineKey}`} className={`fx-stars ${hitLeft ? 'at-left' : 'at-right'}`}>
          <i /><i /><i />
        </span>
      )}

      {word && (
        <span
          key={`w${pulse.key}`}
          className={`fx-word ${hitLeft ? 'at-left' : 'at-right'} ${mag >= 0.62 ? 'heavy' : mag >= 0.3 ? 'medium' : 'light'} ${awaitFlight}`}
          style={{ '--fx-spark': style.spark }}
        >
          {word}
        </span>
      )}

      {ko && <span key={`k${pulse.key}`} className="fx-ko-flash" />}
    </div>
  )
}

/**
 * How hard the cabinet shakes for a given pulse. Returns a class suffix, or
 * '' for effects that shouldn't move the screen at all (whiffs, chip, blocks).
 */
export function shakeClassFor(pulse) {
  if (!pulse || !pulse.t) return ''
  if (pulse.t === 'whiff' || pulse.t === 'drop' || pulse.t === 'block') return ''
  if (pulse.t === 'dizzy') return 'shake-md'
  // Delay the shake on an incoming projectile for the same reason.
  const late = pulse.t === 'projectile' && (pulse.tick ?? 0) === 0 ? ' shake-late' : ''
  const mag = pulse.mag ?? 0
  if (pulse.ko || pulse.t === 'super' || mag >= 0.62) return 'shake-lg' + late
  if (mag >= 0.3) return 'shake-md' + late
  return 'shake-sm' + late
}
