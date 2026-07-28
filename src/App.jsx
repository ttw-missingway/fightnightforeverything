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
import TierList from './screens/TierList.jsx'
import Manage from './screens/Manage.jsx'
import Vods from './screens/Vods.jsx'
import { formatDay } from './game/constants.js'
import { isVodWatched } from './game/model.js'
import DangerBanner from './components/dangers.jsx'
import EvoWeek from './screens/EvoWeek.jsx'
import World from './screens/World.jsx'
import { ACHIEVEMENTS, isUnlocked, howToUnlock } from './game/achievements.js'

export default function App() {
  const { save, screen, nav, closeSave } = useStore()
  useIdleLoop() // drives idle mode when it's running (no-op otherwise)

  if (!save) {
    return screen.name === 'setup' ? <Setup /> : <MainMenu />
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
  // Four of these are EARNED (see achievements.js). A locked tab still renders,
  // greyed and unclickable, with what opens it in the tooltip: a first-time
  // owner should be able to see that there is a Studio to earn, and an
  // invisible tab teaches nobody anything.
  const tabs = [
    ['arcade', '🕹 Arcade', null],
    ['players', '👥 Players', null],
    // Never gated. Its entire job is to be the thing a new lineage is aiming
    // at, and a locked ladder motivates nobody.
    ['world', '🌍 World', null],
    ['teams', '🛡 Teams', null],
    ['vods', newVods > 0 ? `📼 VODs (${newVods})` : '📼 VODs', 'vods'],
    ['halloffame', '🏛 Hall of Fame', null],
    ['codex', '📖 Codex', null],
    ['tiers', '📊 Tiers', 'tiers'],
    ['feed', '📱 Feed', 'feed'],
    ['studio', '🛠 Studio', 'studio'],
    ['manage', '🏪 Manage', null],
  ]
  const activeTab = screen.name === 'tournament' ? (screen.vodId ? 'vods' : 'arcade') : screen.name

  return (
    <div>
      <div className="topnav">
        <span className="brand">FIGHT NIGHT</span>
        {tabs.map(([k, label, gate]) => {
          const locked = gate && !isUnlocked(save, gate)
          return (
            <button key={k} disabled={!!locked}
              title={locked ? `Locked — earned by: ${howToUnlock(gate)}` : undefined}
              style={activeTab === k ? { borderColor: 'var(--pink)', color: 'var(--pink)' } : {}}
              onClick={() => { if (!locked) nav(k) }}>
              {locked ? `🔒 ${label.replace(/^\S+\s/, '')}` : label}
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

      {screen.name === 'arcade' && <Arcade />}
      {screen.name === 'players' && <Players />}
      {screen.name === 'world' && <World />}
      {screen.name === 'teams' && <Teams />}
      {screen.name === 'tournament' && <Tournament />}
      {screen.name === 'vods' && isUnlocked(save, 'vods') && <Vods />}
      {screen.name === 'halloffame' && <HallOfFame />}
      {screen.name === 'codex' && <Codex />}
      {screen.name === 'feed' && isUnlocked(save, 'feed') && <Feed />}
      {screen.name === 'tiers' && isUnlocked(save, 'tiers') && <TierList />}
      {screen.name === 'studio' && isUnlocked(save, 'studio') && <GameStudio />}
      {screen.name === 'manage' && <Manage />}

      <ForeclosureModal />
      <GameOverModal />
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
  const dismiss = () => mutate((s) => { s.unlockNotices = [] })
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
          <button className="primary" onClick={resetCurrentRun}>♻ Start a new run</button>
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
          <button className="primary" onClick={resetCurrentRun}>♻ Start a new run</button>
          <button onClick={closeSave}>Back to the main menu</button>
        </div>
      </div>
    </div>
  )
}

