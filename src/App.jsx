import { useStore } from './state/store.jsx'
import MainMenu from './screens/MainMenu.jsx'
import Setup from './screens/Setup.jsx'
import Arcade from './screens/Arcade.jsx'
import Players from './screens/Players.jsx'
import Teams from './screens/Teams.jsx'
import Tournament from './screens/Tournament.jsx'
import HallOfFame from './screens/HallOfFame.jsx'
import Codex from './screens/Codex.jsx'
import Feed from './screens/Feed.jsx'
import Manage from './screens/Manage.jsx'
import { formatDay } from './game/constants.js'

export default function App() {
  const { save, screen, nav, closeSave } = useStore()

  if (!save) {
    return screen.name === 'setup' ? <Setup /> : <MainMenu />
  }

  const tabs = [
    ['arcade', '🕹 Arcade'],
    ['players', '👥 Players'],
    ['teams', '🛡 Teams'],
    ['tournament', '🏆 Tournament'],
    ['halloffame', '🏛 Hall of Fame'],
    ['codex', '📖 Codex'],
    ['feed', '📱 Feed'],
    ['manage', '⚙ Manage'],
  ]

  return (
    <div>
      <div className="topnav">
        <span className="brand">FIGHT NIGHT</span>
        {tabs.map(([k, label]) => (
          <button key={k}
            style={screen.name === k ? { borderColor: 'var(--pink)', color: 'var(--pink)' } : {}}
            onClick={() => nav(k)}>
            {label}
          </button>
        ))}
        <span className="spacer" />
        <span className="dim small">{formatDay(save.day, save.year)}</span>
        <button className="small" onClick={closeSave}>Save & Quit</button>
      </div>

      {screen.name === 'arcade' && <Arcade />}
      {screen.name === 'players' && <Players />}
      {screen.name === 'teams' && <Teams />}
      {screen.name === 'tournament' && <Tournament />}
      {screen.name === 'halloffame' && <HallOfFame />}
      {screen.name === 'codex' && <Codex />}
      {screen.name === 'feed' && <Feed />}
      {screen.name === 'manage' && <Manage />}
    </div>
  )
}
