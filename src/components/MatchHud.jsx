import { useEffect, useState } from 'react'
import { useStore } from '../state/store.jsx'
import { charArt, charArtFor, playerArt, playerArtFor, stageArt } from './art.js'
import { Portrait } from './ui.jsx'
import FxLayer, { shakeClassFor } from './fx.jsx'

const FRESH = { hpA: 100, hpB: 100, mA: 0, mB: 0, gA: 0, gB: 0 }

/**
 * The fight screen at the top of a narration box, framed like the game the
 * arcade is actually watching: the stage backdrop with both character
 * sprites standing on it, and the HUD (health, meter, rounds) overlaid
 * above them. Synced to how much of the match has been revealed — the HUD
 * only ever shows the state of the story so far.
 *
 * `revealed` = number of narration lines currently shown; omit it for
 * fully-revealed views (recaps, finished brackets). Matches recorded
 * before HUD data existed still get the stage + sprites, just no bars.
 *
 * `state` overrides the looked-up snapshot entirely. MatchPlayback uses it
 * to walk the bars DOWN a line's damage one hit at a time, so a combo
 * chips instead of teleporting.
 */
export default function MatchHud({ m, revealed = null, state = null, pulse = null, shakeKey = null }) {
  // A dizzy lasts until the follow-up lands, so it's a state, not a flash.
  const { save } = useStore()
  // Shake fires ONCE per narration line, not once per tick — a seven-hit
  // combo sparks seven times but only rocks the cabinet on the way in.
  const [shaking, setShaking] = useState(false)
  useEffect(() => {
    if (shakeKey == null) return
    setShaking(true)
    const t = setTimeout(() => setShaking(false), 420)
    return () => clearTimeout(t)
  }, [shakeKey])
  if (m.duels) return null // crew battles have no single fighter per side

  const hud = m.narrationHud
  const shown = revealed == null ? (hud?.length ?? 0) : Math.min(revealed, hud?.length ?? 0)
  const st = state || (hud && shown > 0 ? hud[shown - 1] : FRESH)
  const hasBars = !!hud

  const pickedAName = m.charAName ?? m.aChar
  const pickedBName = m.charBName ?? m.bChar
  const pickedA = save.game.characters.find((c) => c.id === m.charAId)
    || save.game.characters.find((c) => c.name === pickedAName)
  const pickedB = save.game.characters.find((c) => c.id === m.charBId)
    || save.game.characters.find((c) => c.name === pickedBName)

  // A transformed fighter is a DIFFERENT character for as long as the form is
  // up, so the sprite and the name follow the story rather than the pick. The
  // snapshot carries the live form per line (`fA`/`fB`), which is what lets a
  // replayed VOD change back at the bell exactly where the text says it does.
  // Anything recorded before forms existed has no `fA`, and reads as the pick.
  const formA = st.fA ? save.game.characters.find((c) => c.id === st.fA) : null
  const formB = st.fB ? save.game.characters.find((c) => c.id === st.fB) : null
  const chA = formA || pickedA
  const chB = formB || pickedB
  const charAName = formA?.name ?? pickedAName
  const charBName = formB?.name ?? pickedBName

  const stage = m.stageName ? save.game.stages.find((s) => s.name === m.stageName) : null
  const backdrop = stageArt(stage, m.stageName ?? `${m.aId ?? m.aName}|${m.bId ?? m.bName}`)
  // Topmost layer first for CSS, with a scrim on top so the HUD stays legible.
  const bgLayers = [
    'linear-gradient(rgba(6, 7, 18, 0.62), rgba(6, 7, 18, 0.08) 45%, rgba(6, 7, 18, 0.18))',
    ...[...backdrop.layers].reverse().map((u) => `url(${u})`),
  ].join(', ')

  const spriteA = chA ? charArt(chA) : charAName ? charArtFor(charAName, null) : null
  const spriteB = chB ? charArt(chB) : charBName ? charArtFor(charBName, null) : null
  const playerA = playerArt(save.players[m.aId]) ?? playerArtFor(m.aId ?? m.aName)
  const playerB = playerArt(save.players[m.bId]) ?? playerArtFor(m.bId ?? m.bName)

  const shake = shaking ? shakeClassFor(pulse) : ''
  return (
    <div className={`fightscreen ${shake}`} style={{ backgroundImage: bgLayers }} title={stage?.name || backdrop.name}
      onClick={(e) => e.stopPropagation()}>
      <div className="fs-bars">
        <BarSide side="a" name={m.aName} charName={charAName} playerUrl={playerA}
          hp={st.hpA} meter={st.mA} stun={st.sA} games={st.gA} target={m.ftTarget} hasBars={hasBars} />
        <div className="fs-vs">
          <span>VS</span>
          {m.ftTarget && <span className="fs-ft">FT{m.ftTarget}</span>}
        </div>
        <BarSide side="b" name={m.bName} charName={charBName} playerUrl={playerB}
          hp={st.hpB} meter={st.mB} stun={st.sB} games={st.gB} target={m.ftTarget} hasBars={hasBars} />
      </div>
      {/* How close they're standing, straight from the engine. Matches from
          before spacing existed have no `d`, so the fighters just hold their
          original marks. */}
      <div className="fs-arena" style={st.d != null ? { '--fs-close': 1 - st.d / 100 } : undefined}>
        {/* The slot walks; the sprite inside keeps its own mirror/flinch
            transforms, which would otherwise fight each other. */}
        <div className="fs-slot a">
          <FighterSprite url={spriteA} alt={charAName} ko={hasBars && st.hpA <= 0}
            dizzy={pulse?.t === 'dizzy' && pulse.side === 'A'}
            hitKey={pulse?.side === 'A' ? pulse.key : null} />
        </div>
        <div className="fs-slot b">
          <FighterSprite url={spriteB} alt={charBName} ko={hasBars && st.hpB <= 0} mirror
            dizzy={pulse?.t === 'dizzy' && pulse.side === 'B'}
            hitKey={pulse?.side === 'B' ? pulse.key : null} />
        </div>
        <FxLayer pulse={pulse} />
      </div>
    </div>
  )
}

function BarSide({ side, name, charName, playerUrl, hp, meter, stun, games, target, hasBars }) {
  const mirror = side === 'b'
  return (
    <div className={`hud-side ${side}`}>
      <span className="hud-player">
        <Portrait url={playerUrl} size={16} alt="" facing={mirror ? 'right' : 'left'} />
        {name}
        {charName && <span className="hud-charname dim small">· {charName}</span>}
      </span>
      {hasBars && (
        <>
          <div className="hud-health" title={`${hp}% health`}>
            {/* The chip layer trails the real bar — the red catching up is
                most of why a hit reads as a hit. */}
            <div className="chip" style={{ width: `${hp}%` }} />
            {/* Under 10% the bar goes into danger — the classic pulse that
                tells you the next clean hit ends it. */}
            <div className={`fill ${hp <= 25 ? 'low' : ''} ${hp > 0 && hp <= 10 ? 'danger' : ''}`}
              style={{ width: `${hp}%` }} />
          </div>
          <div className="hud-under">
            <div className="hud-meter" title={`${meter}% meter`}>
              <div className="fill" style={{ width: `${meter}%` }} />
            </div>
            {/* Stun gauge. Old matches have no stun data, so it stays hidden
                rather than drawing an empty bar that never moves. */}
            {stun != null && (
              <div className={`hud-stun ${stun >= 80 ? 'near' : ''}`} title={`${stun}% stun`}>
                <div className="fill" style={{ width: `${stun}%` }} />
              </div>
            )}
            <div className="hud-rounds" title={`${games} game${games === 1 ? '' : 's'} taken`}>
              {Array.from({ length: target || 2 }, (_, i) => (
                <span key={i} className={`pip ${i < games ? 'won' : ''}`} />
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// A fighter on the stage. KO'd fighters (0 health) slump into grayscale.
// `hitKey` changes each time this side eats one: the keyed remount is what
// restarts the flinch animation, so consecutive hits each register.
function FighterSprite({ url, alt, ko = false, mirror = false, hitKey = null, dizzy = false }) {
  if (!url) return <div />
  return (
    <img
      key={hitKey ?? 'idle'}
      className={`fs-fighter ${ko ? 'ko' : ''} ${hitKey != null ? 'hit' : ''} ${mirror ? 'from-right' : ''} ${dizzy ? 'dizzy' : ''}`}
      src={url} width={96} height={96} alt={alt} title={alt}
      style={mirror ? { transform: 'scaleX(-1)' } : undefined}
    />
  )
}
