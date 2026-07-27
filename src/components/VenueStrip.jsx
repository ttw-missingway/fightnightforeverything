import { useStore } from '../state/store.jsx'
import { venueVitals } from '../game/venue.js'
import { helperOn } from '../game/constants.js'

/**
 * The standing readout of the four numbers that decide a run, on the screen
 * the owner is already looking at every day.
 *
 * Before this, the only economy on the Arcade page was `· 💰 $342` appended to
 * the end of the STREAM stats line — the same size and colour as the follower
 * count, and read by everyone as flavour. Rent, payroll, staffing and
 * cleanliness appeared nowhere outside Manage, which is the last tab in the
 * nav with the levers a further click down. Runs were being lost to mechanics
 * the owner had never seen.
 *
 * Every cell is a button that lands on the exact sub-tab where its lever
 * lives. A number you cannot act on from where you are reading it is a number
 * you learn to ignore.
 */
export default function VenueStrip() {
  const { save, nav } = useStore()
  if (!save?.economy || save.settings?.mode === 'sandbox') return null
  if (!helperOn(save, 'vitals')) return null
  const v = venueVitals(save)
  const y = v.yesterday

  const money = (n) => `${n < 0 ? '−' : ''}$${Math.abs(Math.round(n))}`
  const go = (tab) => () => nav('manage', { tab })

  // Cash is judged against what a day costs, not against zero: $200 in hand is
  // comfortable at a $20 nut and nearly over at a $90 one.
  const daysHeld = v.nut.total > 0 ? v.cash / v.nut.total : 99
  const cashTone = v.cash < 0 ? 'red' : daysHeld < 7 ? 'red' : daysHeld < 21 ? 'gold' : 'green'
  const netTone = !y ? 'dim' : y.net > 0 ? 'green' : y.net < 0 ? 'red' : 'dim'
  const cleanTone = v.cleanliness < 30 ? 'red' : v.cleanliness < 55 ? 'gold' : 'green'
  const staffTone = v.staff.total === 0 ? 'red' : v.staff.morale < 50 ? 'gold' : 'green'

  return (
    <div className="vstrip">
      <button className="vcell" onClick={go('arcade')} title="Cash on hand — click for prices and the floor">
        <div className="vlabel">💰 Cash</div>
        <div className={`vbig ${cashTone}`}>{money(v.cash)}</div>
        {/* Runway only exists while there is still cash to burn. Once the
            account is under water there is no "days left" to quote, so say
            the rate instead — the one thing it must never do is report a
            falling balance as steady. */}
        <div className="vsub">
          {v.runwayDays != null
            ? <span className={v.runwayDays < 14 ? 'red' : 'dim'}>▸ {v.runwayDays}d of runway</span>
            : v.trend == null
              ? <span className="dim">▸ no trading yet</span>
              : v.trend > 0.5
                ? <span className="green">▸ up {money(v.trend)}/day</span>
                : v.trend < -0.5
                  ? <span className="red">▸ down {money(-v.trend)}/day</span>
                  : <span className="dim">▸ holding steady</span>}
        </div>
      </button>

      <button className="vcell" onClick={go('arcade')} title="What the last day of trading did">
        <div className="vlabel">{!y || y.net >= 0 ? '📈' : '📉'} Yesterday</div>
        <div className={`vbig ${netTone}`}>{y ? money(y.net) : '—'}</div>
        <div className="vsub dim">
          {y ? <>took {money(y.took)} · paid {money(y.paid)}</> : 'no trading yet'}
        </div>
      </button>

      <button className="vcell" onClick={go('arcade')} title="What a day costs before anyone walks in">
        <div className="vlabel">🧾 Daily nut</div>
        <div className="vbig">{money(v.nut.total)}<span className="vunit">/day</span></div>
        <div className="vsub dim">
          rent {money(v.nut.rent)} · upkeep {money(v.nut.upkeep)} · payroll {money(v.nut.payroll)}
        </div>
      </button>

      <button className="vcell" onClick={go('staff')} title="Staffing and the state of the room">
        <div className="vlabel">🧹 Venue</div>
        <div className={`vbig ${staffTone}`}>
          {v.staff.total === 0 ? 'No staff' : `${v.staff.total} staff`}
        </div>
        <div className="vsub">
          <span className={cleanTone}>clean {v.cleanliness}%</span>
          {v.staff.total > 0 && <span className="dim"> · morale {v.staff.morale}</span>}
        </div>
      </button>
    </div>
  )
}

/**
 * Where the day's money actually went, under the daily recap.
 *
 * The sim has always written a labelled ledger line for every movement; none of
 * it was ever shown. Cause and effect on the same screen is what teaches the
 * economy — a net figure alone just tells you the verdict.
 */
export function DayLedger({ save }) {
  const v = venueVitals(save)
  const y = v.yesterday
  if (!y || !y.items.length) return null
  const money = (n) => `${n < 0 ? '−' : ''}$${Math.abs(Math.round(n * 100) / 100)}`
  return (
    <details className="ledger">
      <summary>
        <span className="dim">💵 Took </span><span className="green">{money(y.took)}</span>
        <span className="dim"> · Paid </span><span className="red">{money(y.paid)}</span>
        <span className="dim"> · Net </span>
        <span className={y.net >= 0 ? 'green' : 'red'} style={{ fontWeight: 700 }}>
          {y.net >= 0 ? '+' : ''}{money(y.net)}
        </span>
        <span className="dim small"> — what moved</span>
      </summary>
      <div className="ledger-rows">
        {y.items.map((e, i) => (
          <div className="ledger-row" key={i}>
            <span>{e.label}</span>
            <span className={e.amount >= 0 ? 'green' : 'red'}>
              {e.amount >= 0 ? '+' : ''}{money(e.amount)}
            </span>
          </div>
        ))}
      </div>
    </details>
  )
}
