import { useStore } from '../state/store.jsx'
import { charArt, charArtFor, playerArt, playerArtFor, stageArt } from './art.js'
import { Portrait } from './ui.jsx'

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
 */
export default function MatchHud({ m, revealed = null }) {
  const { save } = useStore()
  if (m.duels) return null // crew battles have no single fighter per side

  const hud = m.narrationHud
  const shown = revealed == null ? (hud?.length ?? 0) : Math.min(revealed, hud?.length ?? 0)
  const st = hud && shown > 0 ? hud[shown - 1] : FRESH
  const hasBars = !!hud

  const charAName = m.charAName ?? m.aChar
  const charBName = m.charBName ?? m.bChar
  const chA = save.game.characters.find((c) => c.id === m.charAId)
    || save.game.characters.find((c) => c.name === charAName)
  const chB = save.game.characters.find((c) => c.id === m.charBId)
    || save.game.characters.find((c) => c.name === charBName)

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

  return (
    <div className="fightscreen" style={{ backgroundImage: bgLayers }} title={stage?.name || backdrop.name}
      onClick={(e) => e.stopPropagation()}>
      <div className="fs-bars">
        <BarSide side="a" name={m.aName} charName={charAName} playerUrl={playerA}
          hp={st.hpA} meter={st.mA} games={st.gA} target={m.ftTarget} hasBars={hasBars} />
        <div className="fs-vs">
          <span>VS</span>
          {m.ftTarget && <span className="fs-ft">FT{m.ftTarget}</span>}
        </div>
        <BarSide side="b" name={m.bName} charName={charBName} playerUrl={playerB}
          hp={st.hpB} meter={st.mB} games={st.gB} target={m.ftTarget} hasBars={hasBars} />
      </div>
      <div className="fs-arena">
        <FighterSprite url={spriteA} alt={charAName} ko={hasBars && st.hpA <= 0} />
        <FighterSprite url={spriteB} alt={charBName} ko={hasBars && st.hpB <= 0} mirror />
      </div>
    </div>
  )
}

function BarSide({ side, name, charName, playerUrl, hp, meter, games, target, hasBars }) {
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
            <div className={`fill ${hp <= 25 ? 'low' : ''}`} style={{ width: `${hp}%` }} />
          </div>
          <div className="hud-under">
            <div className="hud-meter" title={`${meter}% meter`}>
              <div className="fill" style={{ width: `${meter}%` }} />
            </div>
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
function FighterSprite({ url, alt, ko = false, mirror = false }) {
  if (!url) return <div />
  return (
    <img
      className={`fs-fighter ${ko ? 'ko' : ''}`}
      src={url} width={96} height={96} alt={alt} title={alt}
      style={mirror ? { transform: 'scaleX(-1)' } : undefined}
    />
  )
}
