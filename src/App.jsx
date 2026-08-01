import { useEffect, useState } from 'react'
import { useStore, useIdleLoop } from './state/store.jsx'
import MainMenu from './screens/MainMenu.jsx'
import Setup from './screens/Setup.jsx'
import Arcade from './screens/Arcade.jsx'
import Players from './screens/Players.jsx'
import Teams from './screens/Teams.jsx'
import Tournament from './screens/Tournament.jsx'
import HallOfFame from './screens/HallOfFame.jsx'
import Codex from './screens/Codex.jsx'
import Feed from './screens/Feed.jsx'
import GameStudio from './screens/GameStudio.jsx'
import Manage from './screens/Manage.jsx'
import Vods from './screens/Vods.jsx'
import { formatDay } from './game/constants.js'
import { isVodWatched } from './game/model.js'
import DangerBanner from './components/dangers.jsx'
import EvoWeek from './screens/EvoWeek.jsx'
import GrandOpening from './screens/GrandOpening.jsx'
import DevSuite from './screens/DevSuite.jsx'
import World from './screens/World.jsx'
import { ACHIEVEMENTS, isUnlocked, howToUnlock } from './game/achievements.js'
import { TAB_GATES, tabOpen, tabHint } from './game/tabs.js'
import { setFacePalette } from './components/art.js'
import { bannerToasts, liveToasts, dismissToast } from './game/notify.js'
import { pendingAsks, fundAsk, denyAsk, daysUntil, TRAVEL_TIERS } from './game/travel.js'
import { useToastSound, useRunEndSound, useAudioUnlock } from './audio/useSound.jsx'
import { displayName } from './game/util.js'

export default function App() {
  const { save, screen, nav, closeSave, mutate } = useStore()
  useIdleLoop() // drives idle mode when it's running (no-op otherwise)
  // SOUND (REVISION §5-P7). Observes the notification layer and voices what
  // lands; the engine has no idea it exists. See audio/useSound.jsx for why
  // the dependency points this way.
  useAudioUnlock()
  useToastSound(save)
  useRunEndSound(save)
  // Tracked in state, not read straight off `window`, so typing #dev into an
  // already-open tab works. Changing the hash doesn't reload the page and
  // nothing else here would re-render, so without this the suite only ever
  // appeared on a cold load — which is exactly when you don't want to have to
  // remember it.
  const [hash, setHash] = useState(() => window.location.hash)
  useEffect(() => {
    const onHash = () => setHash(window.location.hash)
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])
  // The portrait palette is a per-save cosmetic; art.js holds it as module
  // state (it can't reach the store). Set before anything renders a Portrait.
  setFacePalette(save?.settings?.facePalette)

  // The dev suite, at /#dev. `import.meta.env.DEV` is a COMPILE-TIME constant:
  // in a production build this folds to false, the branch is dropped, and
  // DevSuite stops being imported at all — so it cannot ship by accident and
  // cannot be reached by guessing the URL on a live build.
  //
  // Before the save check on purpose: the cinematics don't need a world to run
  // in, so they can be inspected with nothing loaded.
  if (import.meta.env.DEV && hash.startsWith('#dev')) {
    return <DevSuite />
  }

  if (!save) {
    return screen.name === 'setup' ? <Setup /> : <MainMenu />
  }

  // Opening night, before anything else — including the tab bar. A world's
  // first screen should be the door being unlocked, not a nav row.
  if (save.grandOpening) {
    return <GrandOpening onDone={() => mutate((s) => { s.grandOpening = false }, { ack: true })} />
  }

  const newVods = (save.vods || []).filter((v) => !isVodWatched(v)).length

  // EVO takes over the whole screen while it is on. It is the one night of the
  // year the game stops being a management sim and puts on a broadcast, and a
  // tab bar over the top of it would say the opposite.
  const evoLive = save.evoWeek && save.evoWeek.step !== 'done' && save.lastTournament?.type === 'evo'
  if (evoLive) {
    return (
      <EvoWeek
        record={save.lastTournament}
        onFinish={() => nav('arcade')}
      />
    )
  }

  // The Tournament screen lost its tab (VODs cover replays) but still shows
  // live events — reached from the Arcade on event days, and from VODs.
  //
  // Two kinds of gate live here. Tiers and Studio are LINEAGE unlocks from
  // achievements.js — proved once, kept forever. World, Hall of Fame, VODs and
  // Teams are gated per-RUN by tabs.js, on the run having actually done the
  // thing the tab is about. Either way a locked tab still renders, greyed and
  // unclickable, with what opens it in the tooltip: a first-time owner should
  // be able to see there is a Studio to earn, and an invisible tab teaches
  // nobody anything.
  const tabs = [
    ['arcade', '🕹 Arcade', null],
    ['players', '👥 Players', null],
    ['world', '🌍 World', 'world'],
    ['teams', '🛡 Teams', 'teams'],
    ['vods', newVods > 0 ? `📼 VODs (${newVods})` : '📼 VODs', 'vods'],
    ['halloffame', '🏛 Hall of Fame', 'halloffame'],
    // Tier lists live INSIDE the Codex now (its own sub-tab, still gated on the
    // same achievement) rather than owning a header slot. They are reference
    // material about the cast, which is what the Codex is.
    ['codex', '📖 Codex', 'codex'],
    ['studio', '🛠 Studio', 'studio'],
    ['manage', '🏪 Manage', null],
    // Last in the row, past Manage. NOT gated: the feed is mostly about the
    // wider world, and watching the top players from the outside is precisely
    // what builds the appetite to get your own arcade into that conversation.
    // Locking it hides the goal.
    ['feed', '📱 Feed', null],
  ]
  // Everything you can actually press, in authored order, then everything you
  // can't. Locks drifting through the middle of the bar make the row you use
  // every day jump around as the run earns things; parked on the end they read
  // as a list of what is still to come. Stable partition, so the authored order
  // survives inside each half.
  const gateShut = (gate) => !!gate && !(TAB_GATES[gate] ? tabOpen(save, gate) : isUnlocked(save, gate))
  const ordered = [...tabs.filter(([, , g]) => !gateShut(g)), ...tabs.filter(([, , g]) => gateShut(g))]
  const activeTab = screen.name === 'tournament' ? (screen.vodId ? 'vods' : 'arcade') : screen.name

  return (
    <div>
      <div className="topnav">
        <span className="brand">FIGHT NIGHT</span>
        {ordered.map(([k, label, gate]) => {
          const locked = gateShut(gate)
            // FRESHLY OPENED, AND SAYING SO (§6). A tab that unlocks mid-run
            // is a thing the player earned and will otherwise never notice —
            // the bar simply has one more button than it did. Gold outline
            // until visited, cleared on the visit itself.
            const fresh = !locked && gate && !(save.seenTabs || []).includes(k)
            return (
            <button key={k} disabled={!!locked}
              title={locked ? `Locked — earned by: ${TAB_GATES[gate] ? tabHint(gate) : howToUnlock(gate)}`
                : fresh ? 'Newly unlocked' : undefined}
              style={activeTab === k ? { borderColor: 'var(--pink)', color: 'var(--pink)' }
                : fresh ? { borderColor: 'var(--gold)', color: 'var(--gold)' } : {}}
              onClick={() => {
                if (locked) return
                if (fresh) mutate((s2) => { s2.seenTabs = [...(s2.seenTabs || []), k] }, { ack: true })
                nav(k)
              }}>
              {fresh ? `✦ ${label}` : locked ? `🔒 ${label.replace(/^\S+\s/, '')}` : label}
            </button>
          )
        })}
        <span className="spacer" />
        {save.idle?.enabled && (
          <span className="idle-badge" title={save.idle.running ? 'idle mode running' : 'idle mode paused'}>
            {save.idle.running ? '▶ IDLE' : '⏸ IDLE'}
          </span>
        )}
        <span className="dim small">{formatDay(save.day, save.year)}</span>
        <button className="small" onClick={closeSave}>Save & Quit</button>
      </div>

      {/* Above the tab content, so a run about to end is visible from every
          page rather than only in a recap line the owner already clicked past. */}
      <DangerBanner />
      {/* Above the tab content for the same reason the danger rows are: it has
          to be seen from wherever the owner happened to be standing. */}
      <UnlockBanner />
      {/* The nearly-too-late class persists HERE, on the arcade screen, until
          waved off (REVISION §0.4). Everywhere else it rides the overlay. */}
      {screen.name === 'arcade' && <ToastBanner />}
      {screen.name === 'arcade' && <TravelBanner />}

      {screen.name === 'arcade' && <Arcade />}
      {screen.name === 'players' && <Players />}
      {/* Gated screens check the gate again rather than trusting the nav — a
          deep link from anywhere else must not walk through a locked door. */}
      {screen.name === 'world' && tabOpen(save, 'world') && <World />}
      {screen.name === 'teams' && tabOpen(save, 'teams') && <Teams />}
      {screen.name === 'tournament' && <Tournament />}
      {screen.name === 'vods' && tabOpen(save, 'vods') && <Vods />}
      {screen.name === 'halloffame' && tabOpen(save, 'halloffame') && <HallOfFame />}
      {screen.name === 'codex' && tabOpen(save, 'codex') && <Codex />}
      {screen.name === 'feed' && <Feed />}
      {screen.name === 'studio' && isUnlocked(save, 'studio') && <GameStudio />}
      {screen.name === 'manage' && <Manage />}

      <AwayReport />
      <ToastOverlay onArcade={screen.name === 'arcade'} />
      <ForeclosureModal />
      <GameOverModal />
    </div>
  )
}

/**
 * WELCOME BACK. Idle now runs with the tab closed (§6's idle shrink), so the
 * world can be meaningfully further along than you left it — and time passing
 * behind your back is only acceptable if the game tells you exactly what it
 * did. Everything here comes from the catch-up itself; nothing is re-simulated
 * to build it.
 */
function AwayReport() {
  const { save, mutate, nav } = useStore()
  const r = save?.idle?.awayReport
  if (!r || !r.daysPassed) return null
  const close = () => mutate((s) => { s.idle.awayReport = null }, { ack: true })
  return (
    <div className="modal-backdrop" onClick={close}>
      <div className="card" style={{ maxWidth: 520, borderColor: 'var(--gold)' }} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ marginTop: 0 }}>🌙 While you were away</h3>
        <p className="dim small" style={{ marginTop: 0 }}>
          {r.daysPassed} day{r.daysPassed === 1 ? '' : 's'} passed at {save.arcade.name}.
        </p>
        {(r.headlines || []).length > 0 && (
          <div className="card sub">
            {r.headlines.map((h, i) => <div key={i} className="small" style={{ margin: '3px 0' }}>{h}</div>)}
          </div>
        )}
        {(r.tournaments || []).length > 0 && (
          <p className="small">
            📼 {r.tournaments.length} event{r.tournaments.length === 1 ? '' : 's'} ran —{' '}
            <button className="small" onClick={() => { close(); nav('vods') }}>watch the replays →</button>
          </p>
        )}
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button className="primary" onClick={close}>Back to it</button>
        </div>
      </div>
    </div>
  )
}

/**
 * The notification layer's arcade face: sticky toasts as persistent banner
 * rows until dismissed. "See it" goes to the actual thing and is omitted when
 * there is nothing to show. All dismissible, always (REVISION §6).
 */
function ToastBanner() {
  const { save, nav, mutate } = useStore()
  const rows = bannerToasts(save)
  if (!rows.length) return null
  const wave = (id) => mutate((s) => dismissToast(s, id), { ack: true })
  return (
    <div className="dangers">
      {rows.map((t) => (
        <div key={t.id} className="danger unlock">
          <span className="d-icon">{t.icon}</span>
          <div><div className="d-title">{t.text}</div></div>
          {t.see && <button className="d-go" onClick={() => { wave(t.id); nav(t.see.screen, t.see.params || {}) }}>See it →</button>}
          <button className="d-go" onClick={() => wave(t.id)}>✕</button>
        </div>
      ))}
    </div>
  )
}

/**
 * The ask/deny loop (travel.js): a player wants to be sent somewhere, the
 * books are on the table, and both buttons are real decisions. Refusing
 * while flush reads as a betrayal — the copy says so, because the game
 * will act like it.
 */
function TravelBanner() {
  const { save, mutate } = useStore()
  const asks = pendingAsks(save)
  if (!asks.length) return null
  const cash = Math.round(save.economy?.money ?? 0)
  return (
    <div className="dangers">
      {asks.map((a) => {
        const p = save.players[a.playerId]
        if (!p) return null
        const flush = cash >= a.cost * 3
        return (
          <div key={a.id} className="danger unlock">
            <span className="d-icon">✈️</span>
            <div>
              <div className="d-title">
                {a.squad ? `The crew wants to go to ${a.eventName}` : `${displayName(p, save)} wants to go to ${a.eventName}`}
              </div>
              <div className="d-detail">
                {TRAVEL_TIERS[a.kind]?.label || 'the road'} · in {daysUntil(save, a)} days · costs ${a.cost} of your ${cash}.
                A placing recoups; an early exit is money burned.
              </div>
              {flush && <div className="d-fix">You can afford this, and they know it.</div>}
            </div>
            <button className="d-go" onClick={() => mutate((s) => fundAsk(s, a.id), { kind: 'travel' })}>
              Fund it (${a.cost})
            </button>
            <button className="d-go" onClick={() => mutate((s) => denyAsk(s, a.id), { kind: 'travel' })}>
              Not this time
            </button>
          </div>
        )
      })}
    </div>
  )
}

/**
 * Toasts on ANY screen — the ambient stack. On the arcade the sticky class
 * already owns the banner, so the overlay only carries the rest there.
 */
function ToastOverlay({ onArcade }) {
  const { save, nav, mutate } = useStore()
  const rows = liveToasts(save).filter((t) => !(onArcade && t.sticky)).slice(0, 4)
  if (!rows.length) return null
  const wave = (id) => mutate((s) => dismissToast(s, id), { ack: true })
  return (
    <div style={{ position: 'fixed', right: 14, bottom: 14, zIndex: 60, display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 380 }}>
      {rows.map((t) => (
        <div key={t.id} className="card" style={{ margin: 0, padding: '8px 10px', display: 'flex', gap: 8, alignItems: 'center', borderColor: t.sticky ? 'var(--gold)' : 'var(--border)' }}>
          <span>{t.icon}</span>
          <span className="small" style={{ flex: 1 }}>{t.text}</span>
          {t.see && <button className="small" onClick={() => { wave(t.id); nav(t.see.screen, t.see.params || {}) }}>See it →</button>}
          <button className="small" onClick={() => wave(t.id)} title="dismiss">✕</button>
        </div>
      ))}
    </div>
  )
}

/**
 * "You just earned that, and you keep it."
 *
 * The one moment in the game that is about the LINEAGE rather than the run,
 * so it gets said out loud on whatever page you happen to be on. Without it
 * the only record of a permanent unlock was a chronicle line three clicks
 * away, which is indistinguishable from nothing having happened.
 *
 * Dismissing clears the queue — the Legacy tab is the permanent record, this
 * is just the notification.
 */
function UnlockBanner() {
  const { save, nav, mutate } = useStore()
  const queued = (save?.unlockNotices || [])
    .map((k) => ACHIEVEMENTS.find((a) => a.key === k))
    .filter(Boolean)
  if (!queued.length) return null
  const dismiss = () => mutate((s) => { s.unlockNotices = [] }, { ack: true })
  return (
    <div className="dangers">
      {queued.map((a) => (
        <div key={a.key} className="danger unlock">
          <span className="d-icon">{a.icon}</span>
          <div>
            <div className="d-title">{a.name} — unlocked for good</div>
            <div className="d-detail">
              {a.unlockLabel}. Yours in every run from here
              {a.points > 0 ? `, plus ${a.points} creation point${a.points === 1 ? '' : 's'}.` : '.'}
            </div>
            <div className="d-fix">{a.how}</div>
          </div>
          <button className="d-go" onClick={() => { dismiss(); nav('halloffame') }}>See it →</button>
          <button className="d-go" onClick={dismiss}>Nice</button>
        </div>
      ))}
    </div>
  )
}

// Consequential mode's fail state: too long in the red and the landlord
// takes the keys. The only way forward is a new run — the design and the
// roster survive, fame converts to prestige.
function ForeclosureModal() {
  const { save, resetCurrentRun, closeSave } = useStore()
  if (!save?.economy?.foreclosed) return null
  const prestige = save.prestige?.points || 0
  return (
    <div className="modal-backdrop">
      <div className="modal card" style={{ borderColor: 'var(--red)' }}>
        <h3 style={{ marginTop: 0 }} className="red">🔒 Foreclosed</h3>
        <p>
          The account stayed in the red too long. The landlord changed the locks on {save.arcade.name} —
          this run is over.
        </p>
        <p className="small dim">
          A new run keeps your game design and player roster (progress wiped), archives this run's
          chronicle, hall of fame, and VODs, and converts your arcade's fame into prestige points for
          player creation{prestige > 0 ? ` (${prestige} banked so far)` : ''}.
        </p>
        <div className="row" style={{ marginTop: 12 }}>
          <button className="primary" onClick={resetCurrentRun}>♻ Run it back</button>
          <button onClick={closeSave}>Back to the main menu</button>
        </div>
      </div>
    </div>
  )
}

// The two fail states that aren't the bank: the room emptied out (mid-game
// arcade dynamics) or the world stopped caring (late-game community opinion).
// Both carry the reason the run ended, because that's the lesson to take into
// the next one.
function GameOverModal() {
  const { save, resetCurrentRun, closeSave } = useStore()
  const over = save?.gameOver
  if (!over || save?.economy?.foreclosed) return null
  const icon = over.funnel === 'dynamics' ? '🏁' : '🪦'
  return (
    <div className="modal-backdrop">
      <div className="modal card" style={{ borderColor: 'var(--red)' }}>
        <h3 style={{ marginTop: 0 }} className="red">{icon} {over.title}</h3>
        <p>{over.text}</p>
        <p className="small dim">
          A new run keeps your game design and player roster (progress wiped), archives this run's
          chronicle, hall of fame, and VODs, and converts your arcade's fame into prestige points.
        </p>
        <div className="row" style={{ marginTop: 12 }}>
          <button className="primary" onClick={resetCurrentRun}>♻ Run it back</button>
          <button onClick={closeSave}>Back to the main menu</button>
        </div>
      </div>
    </div>
  )
}

