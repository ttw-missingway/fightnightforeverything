import { useState, useRef } from 'react'
import { Field, NumField, StringListEditor, PillPicker, Portrait } from './ui.jsx'
import { newCharacter, newMove, newStage, newTournamentEntry, cloneCharacterFresh, duplicateCharacter } from '../game/model.js'
import { downloadJson, fileStem } from '../state/store.jsx'
import {
  generateCharacter, generateGameTitle, generateArcadeName,
  generateStage, generateTournamentName,
  generateChannelName,
} from '../game/generate.js'
import {
  ARCHETYPE_KITS, applyArchetypeKit, generateMoveNameForType, STAGE_VIBES,
  generateMoveData, generateCombo, comboDamage, adjustCharacterPower,
  applyMoveDescriptors, MOVE_FORMS, DAMAGE_TIERS, CHIP_TIERS, SPEED_TIERS,
  BLOCK_TIERS, COST_TIERS, DURATION_TIERS, VITALITY_TIERS, SIZE_TIERS, REACH_TIERS,
  EFFECT_TRIGGERS, EFFECT_KINDS, GUARD_TIERS, comboMoves, comboLinks, linkStatus, LINK_LABEL,
} from '../game/design.js'
import {
  computeMatchup, computeMatchups, matchupExplanation,
  STYLE_BEATS, STYLE_WHY, STYLE_ROLES, styleRoleOf,
} from '../game/balance.js'
import {
  RULE_FAMILIES, NETCODE_OPTIONS, defaultRules, tryNetcode, netcodeTaunt,
} from '../game/rules.js'
import {
  ARCHETYPES, MOVE_TYPES, DAYS_PER_YEAR, EVO_DAY, formatDay, WEEKDAYS, BRACKET_SIZES,
  DIFFICULTIES, difficultyOf, DEFAULT_FOOD_PRICE, DEFAULT_GAME_TOKENS, AD_CHANNELS,
  HELPERS, helperOn,
} from '../game/constants.js'
import {
  availableFoods, lockedFoodPacks, availableAttractions, lockedAttractionPacks,
  hasFreeInstall, claimFreeInstall,
} from '../game/catalog.js'
import { howToUnlock, isUnlocked } from '../game/achievements.js'
import { bandwidthCap, scheduleLoad, fitsBandwidth, eventLoad, BANDWIDTH_TIERS } from '../game/bandwidth.js'
import { canStream, STREAM_RIG_COST } from '../game/stream.js'
import { countryFlag, KNOWN_COUNTRIES } from '../game/flags.js'
import {
  FORM_MOVE_TYPE, selectableChars, formsOf, originOf, canBeFormOf, reachableForms, pruneForms,
  switchTargetsOf, revertMoveOf,
} from '../game/forms.js'
import { newSkin, skinsOf } from '../game/skins.js'
import { PRESET_ROSTERS, buildPresetRoster, presetRoster, presetSize } from '../game/rosters.js'
import { CHARACTER_NAMES, TAG_SUGGESTIONS, PLAYER_TAG_SUGGESTIONS } from '../game/names.js'
import { choice, sample, displayName } from '../game/util.js'
import {
  trySpend, monthlyRent, weeklyUpkeep, projectedMonthlyCost, SETUP_COST,
  startingBudget, arcadeBuildCost, foodPriceOf, gameTokensOf,
  FOOD_CATALOG, GAME_CATALOG, adWeeklyCost, adEffectiveness,
  FAIR_WAGE, HIRE_COST, newStaffMember, staffCounts, managementQuality, isStaffed,
  playerStaffAppeal, playTokensOf, costPerPlay,
} from '../game/economy.js'
import { SpritePicker, StagePicker } from './SpritePicker.jsx'
import { CHAR_SPRITE_CATALOG, CHAR_SPRITE_GROUPS, charArt, charArtFor, stageArt, FACE_PALETTES, playerArtFor } from './art.js'
import { MIXED_PALETTE } from '../game/palettes.js'

// Every editor gets (save, update) where update(fn) mutates a draft of the save.

// The arcade's books, shown wherever money matters.
export function EconomyCard({ save }) {
  if (!save.economy) return null
  return (
    <div className="card">
      <div className="row spread">
        <h3>💰 The Books</h3>
        <span className={save.economy.money < 0 ? 'red' : 'green'} style={{ fontSize: 18, fontWeight: 700 }}>
          ${Math.round(save.economy.money)}
        </span>
      </div>
      <p className="dim small">
        Income: tokens and food the players actually buy, plus stream ad revenue.
      </p>
      <div className="row spread" style={{ borderTop: '1px solid var(--border)', paddingTop: 6, marginBottom: 6 }}>
        <span className="small">📅 Projected running cost</span>
        <span className="small gold">~${projectedMonthlyCost(save)}/month</span>
      </div>
      <p className="dim small" style={{ marginTop: 0 }}>
        Rent ${monthlyRent(save)} on the 1st · restocking &amp; upkeep ${weeklyUpkeep(save)}/wk ·
        payroll ${(staffCounts(save).employees * (save.staffing?.employeeWage || 0) + staffCounts(save).managers * (save.staffing?.managerWage || 0))}/day.
      </p>
      {save.economy.log.slice(0, 12).map((e, i) => (
        <div className="row spread" key={i} style={{ borderBottom: '1px solid var(--border)', padding: '2px 0' }}>
          <span className="small">{e.label}</span>
          <span className={`small ${e.amount >= 0 ? 'green' : 'red'}`}>
            {e.amount >= 0 ? '+' : '−'}${Math.abs(e.amount).toFixed(0)}
            <span className="dim"> · {formatDay(e.day, e.year)}</span>
          </span>
        </div>
      ))}
      {save.economy.log.length === 0 && <p className="dim small">No transactions yet.</p>}
    </div>
  )
}

// Mid-save settings that DON'T touch the economy or the game itself.
// Consequential mode locks the world-defining ones.
export function SettingsEditor({ save, update }) {
  const locked = save.settings.mode !== 'sandbox'
  return (
    <div className="grid2">
      <div className="card">
        <h3>Settings</h3>
        <Field label="Save name">
          <input value={save.saveName} onChange={(e) => update((s) => { s.saveName = e.target.value })} />
        </Field>
        <Field label="Refer to players by">
          <select value={save.settings.nameDisplay || 'alias'}
            onChange={(e) => update((s) => { s.settings.nameDisplay = e.target.value })}>
            <option value="alias">Alias / gamer tag</option>
            <option value="fullname">First + last name</option>
          </select>
        </Field>
        <Field label="Portrait palette">
          {/* Purely cosmetic, so never locked — even a consequential run can
              redecorate. The default lets everybody keep the palette they came
              with; picking one overrides the whole roster at once. */}
          <div className="row" style={{ gap: 8, alignItems: 'center' }}>
            <select value={save.settings.facePalette || MIXED_PALETTE}
              onChange={(e) => update((s) => { s.settings.facePalette = e.target.value })}>
              <option value={MIXED_PALETTE}>Mixed — everyone their own</option>
              {FACE_PALETTES.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
            </select>
            <Portrait url={playerArtFor('palette-preview')} size={30} alt="preview" />
            <Portrait url={playerArtFor('palette-preview-2', 'woman')} size={30} alt="preview" />
          </div>
        </Field>
        <Field label="Stream channel name">
          <div className="row">
            <input value={save.stream?.channelName || ''} onChange={(e) => update((s) => { s.stream.channelName = e.target.value })} />
            <button className="small" title="random name" onClick={() => update((s) => { s.stream.channelName = generateChannelName() })}>🎲</button>
          </div>
        </Field>
        <LocationField save={save} update={update} />
        {/* Free forever, and switchable off. These are reading aids, not
            rewards — the owner who most needs them is the one with nothing
            banked, so they can never be something you buy. */}
        <h4 style={{ margin: '14px 0 2px' }}>Helpers</h4>
        <p className="dim small" style={{ margin: '0 0 6px' }}>
          On by default. Switch them off once you know the place — nothing about the
          simulation changes, you just stop being told about it.
        </p>
        {HELPERS.map(([key, label, blurb]) => (
          <label key={key} className="row" style={{ alignItems: 'flex-start', gap: 8, marginBottom: 6, cursor: 'pointer' }}>
            <input type="checkbox" style={{ marginTop: 3 }}
              checked={helperOn(save, key)}
              onChange={(e) => update((s) => {
                s.settings.helpers ??= {}
                s.settings.helpers[key] = e.target.checked
              })} />
            <span>
              <span className="small">{label}</span>
              <span className="dim small" style={{ display: 'block' }}>{blurb}</span>
            </span>
          </label>
        ))}
      </div>
      <div className="card">
        <h3>World Rules {locked && <span className="pill" style={{ borderColor: 'var(--gold)', color: 'var(--gold)' }}>🔒 consequential</span>}</h3>
        {locked && (
          <p className="dim small">
            You chose a consequential arcade — the world's rules were locked at creation.
            (New saves can pick sandbox mode instead.)
          </p>
        )}
        {locked ? (
          <p className="dim small">
            🧑‍🤝‍🧑 Generated players fill the roster automatically over time, up to the 48-player cap —
            more regulars is always a good thing for business, so there's no cap to set.
          </p>
        ) : (
          <>
            <Field label="Allow computer-generated players?">
              <select
                value={save.settings.allowGeneratedPlayers ? 'yes' : 'no'}
                onChange={(e) => update((s) => { s.settings.allowGeneratedPlayers = e.target.value === 'yes' })}>
                <option value="yes">Yes — new faces wander in over time</option>
                <option value="no">No — only my created players</option>
              </select>
            </Field>
            {save.settings.allowGeneratedPlayers && (
              <Field label="Max generated players">
                <input type="number" min={0} max={60} value={save.settings.maxGeneratedPlayers}
                  onChange={(e) => update((s) => { s.settings.maxGeneratedPlayers = Number(e.target.value) })} />
              </Field>
            )}
          </>
        )}
        {save.settings.mode !== 'sandbox' && (
          <Field label="Difficulty (locked at creation)">
            <select disabled value={save.settings.difficulty || 'normal'}>
              {DIFFICULTIES.map((d) => <option key={d.key} value={d.key}>{d.label}</option>)}
            </select>
          </Field>
        )}
      </div>
    </div>
  )
}


/**
 * Where the arcade is — and therefore which flag your whole cast competes
 * under at EVO and in the world rankings.
 *
 * This used to live only in the setup wizard, which meant that once a run had
 * started there was no way to set it at all: the flag was decided forever by
 * whatever you typed (or didn't) before day one. It is aesthetic, so it is
 * editable any time, in any mode.
 *
 * The resolved flag is shown live next to the field because the match is on
 * free text — a white flag is the control telling you it didn't recognise what
 * you typed, rather than you finding out at EVO.
 */
export function LocationField({ save, update }) {
  const country = save.arcade.location?.country || ''
  const flag = countryFlag(country)
  return (
    <Field label="Location & flag">
      <div className="row">
        <input placeholder="city" value={save.arcade.location?.city || ''}
          onChange={(e) => update((s) => { s.arcade.location = { ...(s.arcade.location || {}), city: e.target.value } })} />
        <input placeholder="state / region" value={save.arcade.location?.state || ''}
          onChange={(e) => update((s) => { s.arcade.location = { ...(s.arcade.location || {}), state: e.target.value } })} />
        <input placeholder="country" list="fn-countries" value={country}
          onChange={(e) => update((s) => { s.arcade.location = { ...(s.arcade.location || {}), country: e.target.value } })} />
        <datalist id="fn-countries">
          {KNOWN_COUNTRIES.map((c) => <option key={c} value={c} />)}
        </datalist>
        <span style={{ fontSize: 26, lineHeight: 1 }} title={flag === '🏳️' ? "Not recognised — your cast will fly a blank flag" : country}>
          {flag}
        </span>
      </div>
      <p className="dim small" style={{ margin: '4px 0 0' }}>
        {flag === '🏳️'
          ? country
            ? `"${country}" isn't a country this recognises — try the suggestions, or a two-letter code like JP.`
            : 'Set a country and your players carry its flag at EVO and in the world rankings.'
          : `Your cast competes under ${flag} — at EVO, in the pools, and on the world ladder.`}
      </p>
    </Field>
  )
}

export function BasicsEditor({ save, update }) {
  return (
    <div className="grid2">
      <div className="card">
        <h3>Save & Game</h3>
        <Field label="Save name">
          <input value={save.saveName} onChange={(e) => update((s) => { s.saveName = e.target.value })} />
        </Field>
        <Field label="Fighting game title">
          <div className="row">
            <input value={save.game.name} onChange={(e) => update((s) => { s.game.name = e.target.value })} />
            <button className="small" title="random title" onClick={() => update((s) => { s.game.name = generateGameTitle() })}>🎲</button>
          </div>
        </Field>
        <Field label="Arcade name">
          <div className="row">
            <input value={save.arcade.name} onChange={(e) => update((s) => { s.arcade.name = e.target.value })} />
            <button className="small" title="random name" onClick={() => update((s) => { s.arcade.name = generateArcadeName() })}>🎲</button>
          </div>
        </Field>
        <LocationField save={save} update={update} />
        <Field label="Stream channel name">
          <div className="row">
            <input value={save.stream?.channelName || ''} onChange={(e) => update((s) => { s.stream.channelName = e.target.value })} />
            <button className="small" title="random name" onClick={() => update((s) => { s.stream.channelName = generateChannelName() })}>🎲</button>
          </div>
        </Field>
        <Field label="Refer to players by">
          <select
            value={save.settings.nameDisplay || 'alias'}
            onChange={(e) => update((s) => { s.settings.nameDisplay = e.target.value })}
          >
            <option value="alias">Alias / gamer tag</option>
            <option value="fullname">First + last name</option>
          </select>
        </Field>
      </div>
      <div className="card">
        <h3>Commitment</h3>
        <Field label="How locked-in is this world?">
          <select value={save.settings.mode || 'consequential'}
            onChange={(e) => update((s) => { s.settings.mode = e.target.value })}>
            <option value="consequential">Consequential — settings lock, purchases cost, patches have fallout</option>
            <option value="sandbox">Sandbox — adjust everything freely, no consequences</option>
          </select>
        </Field>
        <p className="dim small">
          Consequential: world rules freeze at creation, mid-save additions cost money, the landlord can
          foreclose, and every game patch triggers a community reaction that matters. Sandbox: tune
          anything anytime, for free.
        </p>
        {save.settings.mode !== 'sandbox' && (
          <>
            <Field label="Difficulty">
              <select value={save.settings.difficulty || 'normal'}
                onChange={(e) => update((s) => { s.settings.difficulty = e.target.value })}>
                {DIFFICULTIES.map((d) => (
                  <option key={d.key} value={d.key}>{d.label}</option>
                ))}
              </select>
            </Field>
            <p className="dim small" style={{ marginTop: 0 }}>
              {difficultyOf(save).blurb}{' '}
              Starting budget <strong className="green">${difficultyOf(save).startingMoney}</strong> (spent building your
              arcade; the rest is opening cash) · {difficultyOf(save).statPoints} stat points per created
              player (max 5/stat) · rent ×{difficultyOf(save).rentMult} ·
              popularity gain ×{difficultyOf(save).popularityMult}.
            </p>
          </>
        )}
      </div>
    </div>
  )
}

// The Manage screen's arcade-management tab: everything with a price tag.
export function ArcadeManagement({ save, update }) {
  const live = save.settings.mode !== 'sandbox'
  return (
    <div>
      <EconomyCard save={save} />
      <div className="grid2">
        <IncomeChart save={save} />
        <FootTraffic save={save} />
      </div>
      <PricesEditor save={save} update={update} />
      <ArcadeEditor save={save} update={update} live={live} />
    </div>
  )
}

// Trailing slice of the daily economy history (newest last), only rows with
// the field we're charting present.
function recentHistory(save, n, field) {
  const h = save.economy?.history || []
  return h.filter((d) => d[field] != null).slice(-n)
}

// Daily net income as up/down bars over the last few weeks. Green above the
// zero line, red below it — a quick read on whether the arcade is bleeding.
export function IncomeChart({ save }) {
  const data = recentHistory(save, 30, 'net')
  const W = 320
  const H = 96
  if (data.length < 2) {
    return (
      <div className="card">
        <h3>📈 Daily income</h3>
        <p className="dim small">Not enough days yet — play a few and the trend shows up here.</p>
      </div>
    )
  }
  const nets = data.map((d) => d.net)
  const peak = Math.max(1, ...nets.map((v) => Math.abs(v)))
  const mid = H / 2
  const bw = W / data.length
  const total = nets.reduce((s, v) => s + v, 0)
  const avg = total / nets.length
  const best = Math.max(...nets)
  const worst = Math.min(...nets)
  return (
    <div className="card">
      <div className="row spread">
        <h3 style={{ margin: 0 }}>📈 Daily income</h3>
        <span className={`small ${avg >= 0 ? 'green' : 'red'}`}>
          avg {avg >= 0 ? '+' : '−'}${Math.abs(avg).toFixed(0)}/day
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} style={{ marginTop: 6, display: 'block' }}>
        <line x1="0" y1={mid} x2={W} y2={mid} stroke="var(--border)" strokeWidth="1" />
        {data.map((d, i) => {
          const h = (Math.abs(d.net) / peak) * (mid - 3)
          const up = d.net >= 0
          return (
            <rect key={i} x={i * bw + 1} y={up ? mid - h : mid} width={Math.max(1, bw - 2)} height={Math.max(0.5, h)}
              fill={up ? 'var(--green)' : 'var(--red)'} opacity={i === data.length - 1 ? 1 : 0.72}>
              <title>{`Day ${d.absDay}: ${up ? '+' : '−'}$${Math.abs(d.net).toFixed(0)}`}</title>
            </rect>
          )
        })}
      </svg>
      <div className="row spread" style={{ marginTop: 4 }}>
        <span className="small green">best +${best.toFixed(0)}</span>
        <span className="dim small">last {data.length} days</span>
        <span className="small red">worst {worst < 0 ? '−' : '+'}${Math.abs(worst).toFixed(0)}</span>
      </div>
    </div>
  )
}

// Foot traffic: how many people came through the door today, with a sparkline
// of the last few weeks and the running average.
export function FootTraffic({ save }) {
  const data = recentHistory(save, 30, 'attendance')
  const latest = data.length ? data[data.length - 1].attendance : null
  const W = 320
  const H = 56
  if (data.length < 2) {
    return (
      <div className="card">
        <h3>🚶 Foot traffic</h3>
        <div style={{ fontSize: 30, fontWeight: 700 }} className="cyan">{latest ?? '—'}</div>
        <p className="dim small">through the door today</p>
      </div>
    )
  }
  const counts = data.map((d) => d.attendance)
  const peak = Math.max(1, ...counts)
  const avg = counts.reduce((s, v) => s + v, 0) / counts.length
  const stepX = W / (counts.length - 1)
  const pts = counts.map((v, i) => `${(i * stepX).toFixed(1)},${(H - 3 - (v / peak) * (H - 6)).toFixed(1)}`).join(' ')
  return (
    <div className="card">
      <div className="row spread">
        <h3 style={{ margin: 0 }}>🚶 Foot traffic</h3>
        <span className="small dim">avg {avg.toFixed(1)}/day</span>
      </div>
      <div className="row" style={{ alignItems: 'baseline', gap: 8 }}>
        <span style={{ fontSize: 30, fontWeight: 700 }} className="cyan">{latest ?? '—'}</span>
        <span className="dim small">through the door today · peak {peak}</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} style={{ marginTop: 4, display: 'block' }}>
        <polyline points={pts} fill="none" stroke="var(--cyan)" strokeWidth="2"
          strokeLinejoin="round" strokeLinecap="round" />
        {counts.map((v, i) => (
          <circle key={i} cx={i * stepX} cy={H - 3 - (v / peak) * (H - 6)} r={i === counts.length - 1 ? 3 : 1.5}
            fill="var(--cyan)">
            <title>{`Day ${data[i].absDay}: ${v}`}</title>
          </circle>
        ))}
      </svg>
    </div>
  )
}

export function TagsEditor({ save, update }) {
  return (
    <div className="grid2">
      <div className="card">
        <h3>Character Tags</h3>
        <p className="dim small">
          Create any tags you like (e.g. "edgy", "cute", "big damage", "honest"). Assign them to characters,
          then mark players as attracted to or repelled by them — this shapes who mains whom.
        </p>
        <StringListEditor items={save.game.tags} placeholder="new character tag…"
          onChange={(items) => update((s) => { s.game.tags = items })} />
        <button className="small" style={{ marginTop: 6 }} onClick={() => update((s) => {
          const fresh = TAG_SUGGESTIONS.filter((t) => !s.game.tags.includes(t))
          s.game.tags.push(...sample(fresh, Math.min(3, fresh.length)))
        })}>🎲 Add random tags</button>
      </div>
      <div className="card">
        <h3>Player Tags</h3>
        <p className="dim small">
          Vibe tags for people (e.g. "loud", "meme lord", "old head", "tryhard"). Give players their own tags,
          then mark who's drawn to or put off by each vibe — this pulls players together or pushes them apart.
        </p>
        <StringListEditor items={save.game.playerTags || []} placeholder="new player tag…"
          onChange={(items) => update((s) => { s.game.playerTags = items })} />
        <button className="small" style={{ marginTop: 6 }} onClick={() => update((s) => {
          const fresh = PLAYER_TAG_SUGGESTIONS.filter((t) => !(s.game.playerTags || []).includes(t))
          s.game.playerTags.push(...sample(fresh, Math.min(3, fresh.length)))
        })}>🎲 Add random tags</button>
      </div>
    </div>
  )
}

/**
 * The forms panel: one control on the FORM (who it belongs to) and a read-only
 * summary on the ORIGIN (what it can become, and how easily).
 *
 * There is deliberately no "make this a form origin" switch. Origin-ness is
 * derived from a form pointing here, so there is no such thing as an origin
 * with nothing on the other side — the state that would be a lie.
 */
function FormLink({ save, sel, update, setSelId }) {
  const myForms = formsOf(save.game, sel.id)
  const origin = originOf(save.game, sel)
  const candidates = canBeFormOf(save.game, sel)
  const reach = reachableForms(save.game, sel)
  // A form that nothing switches into is unreachable — it exists in the game
  // and can never be played. Worth saying out loud, since it's a silent bug
  // in a design otherwise.
  const orphaned = myForms.filter((f) => !reach.some((r) => r.form.id === f.id))

  return (
    <Field label="Forms">
      {!myForms.length && (
        <div className="row">
          <span className="dim small">Form of</span>
          <select value={sel.formOf || ''} onChange={(e) => update((s) => {
            const c = s.game.characters.find((x) => x.id === sel.id)
            if (!c) return
            c.formOf = e.target.value || null
            // Becoming a form removes them from every pool at once, so the
            // chart has to be rebuilt around a smaller cast.
            pruneForms(s.game)
            computeMatchups(s.game)
          })}>
            <option value="">— nobody, this is a normal character —</option>
            {candidates.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          {origin && (
            <button className="small" onClick={() => setSelId(origin.id)}>↑ {origin.name}</button>
          )}
        </div>
      )}
      {origin ? (
        <>
          <p className="dim small" style={{ margin: '4px 0 0' }}>
            <span className="gold">⟳ Not selectable.</span> {sel.name} only exists as a form of{' '}
            <strong>{origin.name}</strong> — reached with a <em>form change</em> move, and gone at the bell.
            Design them like a full character; their power counts as {origin.name}'s.
          </p>
          <p className="small" style={{ margin: '4px 0 0' }}>
            {revertMoveOf(save.game, sel)
              ? <>↩ Two-way: <strong>{revertMoveOf(save.game, sel).name}</strong> drops back to {origin.name} early,
                instead of waiting for the bell.</>
              : <span className="dim">One-way: {sel.name} holds until the bell. To let them return early, add a{' '}
                <em>form change</em> move below and point it at {origin.name}.</span>}
          </p>
        </>
      ) : myForms.length ? (
        <>
          <p className="small" style={{ margin: '2px 0 4px' }}>
            {sel.name} can become:{' '}
            {myForms.map((f, i) => {
              const r = reach.find((x) => x.form.id === f.id)
              return (
                <span key={f.id}>
                  {i > 0 && ', '}
                  <a className="clickable pink" onClick={() => setSelId(f.id)}>{f.name}</a>
                  <span className="dim"> ({r ? `${Math.round(r.access * 100)}% access via ${r.move.name}` : 'no move points here'})</span>
                </span>
              )
            })}
          </p>
          <p className="dim small" style={{ margin: 0 }}>
            Access is how cheaply {sel.name} can actually get there — meter cost, startup and safety on
            block. The balance chart moves {sel.name} toward whatever a form is <em>better</em> at, in
            proportion to that number, so a free instant transformation is very nearly the form itself
            and a full-bar punishable one mostly isn't.
          </p>
          {orphaned.length > 0 && (
            <p className="red small" style={{ margin: '4px 0 0' }}>
              ⚠ {orphaned.map((f) => f.name).join(', ')} {orphaned.length === 1 ? 'has' : 'have'} no way in.
              Add a <em>form change</em> move below and point it at {orphaned.length === 1 ? 'them' : 'each of them'},
              or {orphaned.length === 1 ? 'that form' : 'those forms'} can never be played.
            </p>
          )}
        </>
      ) : (
        <p className="dim small" style={{ margin: '4px 0 0' }}>
          A form is a whole second character on the other side of a move — its own movelist, body and
          art — that nobody can pick from character select. To give {sel.name} one: make (or generate)
          the second character, set its <em>Form of</em> to {sel.name}, then add a <em>form change</em>{' '}
          move here pointing at it. It lasts until the bell.
        </p>
      )}
    </Field>
  )
}

/**
 * Skins: alternate looks for the same fighter. Deliberately thin — a name and
 * a sprite, nothing that could affect a match. There is no balance surface
 * here to get wrong, because a skin is not a character and never enters
 * `game.characters`.
 */
function SkinsEditor({ sel, patchChar }) {
  const skins = skinsOf(sel)
  return (
    <Field label={`Skins (${skins.length})`}>
      <p className="dim small" style={{ margin: '0 0 6px' }}>
        A different face on the same fighter — its own name and sprite, identical in every other way.
        Skins never appear on the tier list or the balance chart, and nobody talks about them: the
        discourse is about <strong>{sel.name}</strong>. Players settle on a look they like, so this is
        what you'll see next to their name once they main {sel.name}.
      </p>
      {skins.map((sk) => (
        <div className="card sub" key={sk.id}>
          <div className="row spread">
            <input value={sk.name} style={{ minWidth: 150 }}
              onChange={(e) => patchChar((c) => {
                const x = (c.skins || []).find((y) => y.id === sk.id)
                if (x) x.name = e.target.value
              })} />
            <button className="small danger" title="remove this skin"
              onClick={() => patchChar((c) => { c.skins = (c.skins || []).filter((y) => y.id !== sk.id) })}>×</button>
          </div>
          <div style={{ marginTop: 6 }}>
            <SpritePicker
              catalog={CHAR_SPRITE_CATALOG}
              groups={CHAR_SPRITE_GROUPS}
              value={sk.spriteKey || null}
              autoUrl={charArt(sel)}
              onChange={(k) => patchChar((c) => {
                const x = (c.skins || []).find((y) => y.id === sk.id)
                if (x) x.spriteKey = k
              })}
            />
          </div>
        </div>
      ))}
      <button className="small" style={{ marginTop: 6 }}
        onClick={() => patchChar((c) => {
          c.skins = [...(c.skins || []), newSkin({ name: `${c.name} Alt ${(c.skins || []).length + 1}` })]
        })}>+ Add skin</button>
    </Field>
  )
}

export function CharactersEditor({ save, update }) {
  const [selId, setSelId] = useState(null)
  const importRef = useRef(null)
  const chars = save.game.characters
  const sel = chars.find((c) => c.id === selId) || null
  const pickable = selectableChars(save.game)
  // Each selectable character followed by its own forms — the shape the cast
  // actually has, rather than roster insertion order.
  const rosterOrder = pickable.flatMap((c) => [c, ...formsOf(save.game, c.id)])

  const patchChar = (fn) => update((s) => {
    const c = s.game.characters.find((x) => x.id === selId)
    if (c) fn(c)
  })

  // Roster files: a designed cast is real work — carry it between worlds.
  const exportRoster = () => downloadJson(
    `${fileStem(save.game.name, 'roster')}.characters.fightnight.json`,
    {
      format: 'fightnight-characters', formatVersion: 1, exportedAt: Date.now(),
      gameName: save.game.name, tags: save.game.tags || [], characters: chars,
    })
  const importRoster = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      const data = JSON.parse(await file.text())
      if (data.format !== 'fightnight-characters' || !Array.isArray(data.characters)) {
        alert('That file is not a Fight Night character roster.')
        return
      }
      update((s) => {
        // The imported cast's tags come along — they shape who mains whom.
        for (const t of data.tags || []) if (!s.game.tags.includes(t)) s.game.tags.push(t)
        const have = new Set(s.game.characters.map((c) => c.id))
        // Character ids can change on the way in (a re-import clones under
        // fresh ones), and forms are stored as ids — both the `formOf` link
        // and every form change move's target. Remap them together afterwards
        // or a re-imported cast arrives with all its transformations severed.
        const idMap = {}
        const landed = []
        for (const char of data.characters) {
          const next = have.has(char.id) ? cloneCharacterFresh(char) : structuredClone(char)
          idMap[char.id] = next.id
          landed.push(next)
          s.game.characters.push(next)
        }
        for (const c of landed) {
          if (c.formOf) c.formOf = idMap[c.formOf] ?? null
          for (const m of c.moves || []) {
            if (m.type === FORM_MOVE_TYPE && m.d?.becomes) {
              m.d = { ...m.d, becomes: idMap[m.d.becomes] ?? null }
            }
          }
        }
        pruneForms(s.game) // anything the file pointed at but didn't ship
        computeMatchups(s.game) // the imported designs are matchup data now
      })
    } catch {
      alert('Could not read that file.')
    }
  }

  return (
    <>
    <PresetRosters save={save} update={update} setSelId={setSelId} />
    <div className="grid2">
      <div className="card">
        <div className="row spread">
          <h3>Roster ({chars.length})</h3>
          <div className="row">
            <button className="small" onClick={() => update((s) => {
              const c = newCharacter()
              s.game.characters.push(c)
            })}>+ New</button>
            <button className="small" onClick={() => update((s) => {
              const used = new Set(s.game.characters.map((c) => c.name))
              s.game.characters.push(generateCharacter(used))
            })}>🎲 Generate</button>
            {chars.length > 0 && (
              <button className="small" title="download this cast as a file you can import into another world" onClick={exportRoster}>📤</button>
            )}
            <button className="small" title="import a character roster file (.characters.fightnight.json)" onClick={() => importRef.current?.click()}>📥</button>
            <input ref={importRef} type="file" accept=".json,application/json" style={{ display: 'none' }} onChange={importRoster} />
          </div>
        </div>
        <div className="table-scroll"><table>
          <tbody>
            {rosterOrder.map((c) => {
              const form = !!c.formOf
              return (
                <tr key={c.id} className="clickable" onClick={() => setSelId(c.id)}>
                  <td style={{
                    ...(selId === c.id ? { color: 'var(--pink)' } : {}),
                    // Forms sit under the character that turns into them, so
                    // the roster reads as a cast rather than a flat list with
                    // strangers in it.
                    ...(form ? { paddingLeft: 18 } : {}),
                  }}>
                    {form && <span className="dim" title="a form — not selectable">⟳ </span>}{c.name}
                  </td>
                  <td className="dim">{c.archetype}</td>
                  <td className="dim small">
                    {form ? 'form' : `diff ${c.difficulty} · pop ${c.popularity}`}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table></div>
        {chars.length === 0 && <p className="dim">No characters yet — a fighting game needs a cast!</p>}
        {chars.length > pickable.length && (
          <p className="dim small" style={{ margin: '6px 0 0' }}>
            {pickable.length} selectable · {chars.length - pickable.length} form{chars.length - pickable.length === 1 ? '' : 's'}.
            Forms don't appear on character select — you reach them with a <em>form change</em> move, and the bell puts you back.
          </p>
        )}
      </div>

      {sel && (
        <div className="card">
          <div className="row spread">
            <h3>Edit: {sel.name}</h3>
            <div className="row">
              <button className="small"
                title="a full copy under fresh ids — moves, combos, body, tags and any forms"
                onClick={() => {
                  // Cloned OUTSIDE `update`: in the setup wizard `update` runs
                  // inside a React state updater, so ids minted in there aren't
                  // reliably readable afterwards — and we need the new id to
                  // select the copy.
                  const dup = duplicateCharacter(save.game, sel.id)
                  if (!dup) return
                  update((s) => {
                    s.game.characters.push(...structuredClone(dup.characters))
                    computeMatchups(s.game)
                  })
                  setSelId(dup.id)
                }}>⧉ Duplicate</button>
              <button className="small danger" onClick={() => {
                // Deleting an origin does NOT delete its forms — they're complete
                // designs and throwing them away silently would bin real work.
                // `pruneForms` sets them loose as ordinary characters instead.
                const orphans = formsOf(save.game, sel.id)
                if (orphans.length && !confirm(
                  `${sel.name} has ${orphans.length} form${orphans.length === 1 ? '' : 's'} (${orphans.map((f) => f.name).join(', ')}).\n\n`
                  + `Deleting ${sel.name} keeps them, as ordinary selectable characters. Continue?`)) return
                setSelId(null)
                update((s) => {
                  s.game.characters = s.game.characters.filter((c) => c.id !== sel.id)
                  pruneForms(s.game)
                  computeMatchups(s.game)
                })
              }}>Delete</button>
            </div>
          </div>
          <FormLink save={save} sel={sel} update={update} setSelId={setSelId} />
          <Field label="Name">
            <div className="row">
              <input value={sel.name} onChange={(e) => patchChar((c) => { c.name = e.target.value })} />
              <button className="small" title="random name" onClick={() => update((s) => {
                const c = s.game.characters.find((x) => x.id === sel.id)
                if (!c) return
                const used = new Set(s.game.characters.map((x) => x.name))
                const free = CHARACTER_NAMES.filter((n) => !used.has(n))
                if (free.length) c.name = choice(free)
              })}>🎲</button>
            </div>
          </Field>
          <Field label="Archetype">
            <div className="row">
              <select value={sel.archetype} onChange={(e) => patchChar((c) => { c.archetype = e.target.value })}>
                {ARCHETYPES.map((a) => <option key={a}>{a}</option>)}
              </select>
              <button className="small" title="fill stats, moves and tags from the archetype template"
                onClick={() => update((s) => {
                  const c = s.game.characters.find((x) => x.id === sel.id)
                  if (c) applyArchetypeKit(c, c.archetype, s.game.tags)
                })}>
                📦 Apply {sel.archetype} kit
              </button>
            </div>
            {ARCHETYPE_KITS[sel.archetype] && (
              <p className="dim small" style={{ margin: '4px 0 0' }}>{ARCHETYPE_KITS[sel.archetype].blurb}</p>
            )}
          </Field>
          <Field label="Sprite">
            <SpritePicker
              catalog={CHAR_SPRITE_CATALOG}
              groups={CHAR_SPRITE_GROUPS}
              value={sel.spriteKey || null}
              autoUrl={charArtFor(sel.id, sel.archetype)}
              onChange={(k) => patchChar((c) => { c.spriteKey = k })}
            />
          </Field>
          <SkinsEditor sel={sel} patchChar={patchChar} />
          {/* No popularity dial. It still exists and still does the heavy
              lifting in `charAppeal` — it's the biggest term deciding who
              gravitates to a character — but typing a number for it was
              setting the answer rather than designing toward it. The archetype
              kit gives it a range, and play moves it from there. */}
          <div className="row">
            <NumField label="Difficulty (1-10)" value={sel.difficulty} min={1} max={10}
              onChange={(v) => patchChar((c) => { c.difficulty = v })} />
          </div>
          <div className="row">
            <Field label="Health">
              <select value={sel.vitality || 'normal'}
                onChange={(e) => patchChar((c) => { c.vitality = e.target.value })}>
                {VITALITY_TIERS.map((t) => <option key={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="Size">
              <select value={sel.size || 'normal'}
                onChange={(e) => patchChar((c) => { c.size = e.target.value })}>
                {SIZE_TIERS.map((t) => <option key={t}>{t}</option>)}
              </select>
            </Field>
            <span className="dim small" style={{ alignSelf: 'center' }}>
              a tank carries a bigger bar; a big body is easier to combo and slower to move
            </span>
          </div>
          <Field label="Description">
            <textarea value={sel.description} onChange={(e) => patchChar((c) => { c.description = e.target.value })} />
          </Field>
          <Field label="Tags">
            <PillPicker options={save.game.tags} selected={sel.tags || []}
              onToggle={(t) => patchChar((c) => {
                c.tags = c.tags || []
                c.tags = c.tags.includes(t) ? c.tags.filter((x) => x !== t) : [...c.tags, t]
              })} />
          </Field>
          <Field label="Quick balance">
            <div className="row">
              <button className="small" title="scale the whole kit up a little"
                onClick={() => patchChar((c) => adjustCharacterPower(c, 'buff', 'light'))}>▲ Light buff</button>
              <button className="small" title="scale the whole kit down a little"
                onClick={() => patchChar((c) => adjustCharacterPower(c, 'nerf', 'light'))}>▼ Light nerf</button>
              <button className="small" title="scale the whole kit up hard"
                onClick={() => patchChar((c) => adjustCharacterPower(c, 'buff', 'heavy'))}>⏫ Heavy buff</button>
              <button className="small" title="scale the whole kit down hard"
                onClick={() => patchChar((c) => adjustCharacterPower(c, 'nerf', 'heavy'))}>⏬ Heavy nerf</button>
            </div>
            <p className="dim small" style={{ margin: '4px 0 0' }}>
              A one-click shortcut for when you don't want to hand-tune frame data: shoves every move's
              damage, startup/recovery, block advantage and meter cost together so the character actually
              moves on the chart. Blunt by design — stack them for bigger swings. All changes land in the
              patch notes.
            </p>
          </Field>
          <MovelistEditor char={sel} patchChar={patchChar} forms={switchTargetsOf(save.game, sel)} />
          <CombosEditor char={sel} patchChar={patchChar} />
        </div>
      )}
    </div>
    </>
  )
}

/**
 * Premade casts, for the world that doesn't want to design twelve fighters
 * before it has played a night. Each one lands as ordinary characters — same
 * archetype kits, same frame data, fully editable afterwards — so a preset is
 * a starting point rather than a locked-in choice.
 */
function PresetRosters({ save, update, setSelId }) {
  const [key, setKey] = useState(PRESET_ROSTERS[0].key)
  const [open, setOpen] = useState(false)
  const preset = presetRoster(key)
  const chars = save.game.characters

  const load = (replace) => {
    if (replace && chars.length && !confirm(
      `Replace the current cast (${chars.length} character${chars.length === 1 ? '' : 's'}) `
      + `with ${preset.name} — ${presetSize(preset)} fighters?`)) return
    // Built OUTSIDE `update`: in the setup wizard an update runs inside a React
    // state updater, and this mints ids that other ids point at (a form's
    // `formOf`, a form change move's target). Minting them in there is how you
    // get a cast whose transformations are severed on arrival.
    const built = buildPresetRoster(key)
    if (!built) return
    setSelId(null)
    update((s) => {
      for (const t of built.preset.tags) if (!s.game.tags.includes(t)) s.game.tags.push(t)
      if (replace) s.game.characters = []
      s.game.characters.push(...structuredClone(built.characters))
      // Only when the world hasn't been named yet — a preset suggests a title,
      // it doesn't overwrite one somebody typed.
      if (replace && s.game.name === 'Untitled Fighter') s.game.name = built.preset.gameName
      pruneForms(s.game)
      computeMatchups(s.game)
    })
  }

  return (
    <div className="card" style={{ marginBottom: 12 }}>
      <div className="row spread">
        <h3>Premade rosters</h3>
        <button className="small" onClick={() => setOpen(!open)}>{open ? 'Hide cast' : `Preview the ${presetSize(preset)}`}</button>
      </div>
      <p className="dim small" style={{ margin: '0 0 8px' }}>
        A full cast lifted from a game everyone already knows, movelists and all. They arrive as
        ordinary characters: rename them, retune them, delete half of them.
      </p>
      <div className="row">
        <select value={key} onChange={(e) => setKey(e.target.value)}>
          {PRESET_ROSTERS.map((p) => <option key={p.key} value={p.key}>{p.name}</option>)}
        </select>
        <button className="small primary" onClick={() => load(true)}>Use this cast</button>
        <button className="small" title="keep what's here and append the preset" onClick={() => load(false)}>+ Add to roster</button>
      </div>
      <p className="dim small" style={{ margin: '6px 0 0' }}>{preset.blurb}</p>
      {open && (
        <div className="table-scroll" style={{ marginTop: 8 }}><table>
          <tbody>
            {preset.characters.map((c) => {
              const forms = c.forms || (c.form ? [c.form] : [])
              return (
              <tr key={c.name}>
                <td>{c.name}{!!forms.length && (
                  <span className="dim" title={`turns into ${forms.map((f) => f.name).join(', ')}`}> ⟳</span>
                )}</td>
                <td className="dim">{c.archetype}</td>
                <td className="dim small">{c.description}</td>
              </tr>
              )
            })}
          </tbody>
        </table></div>
      )}
    </div>
  )
}

// Above this many selectable characters the matchup report stops listing every
// pair and focuses one character at a time. Twelve is a normal fighting-game
// roster (66 pairs); the crossover presets are four times that.
const MATCHUP_FOCUS_ABOVE = 16

// The chart is COMPUTED from the movesets now — the game tells you what
// you built. In the wizard it's pure design theory; in a live save it's
// OBSERVED data that starts blurry after each patch and sharpens as sets
// get played (pass `observe`, `confidence`, `games`).
export function MatchupReport({ save, observe = null, confidence = 1, games = 0, changedIds = new Set() }) {
  // Forms have no row here. Nobody picks one, so "Origin vs Form" is not a
  // matchup — the form's power is already inside its origin's numbers.
  const chars = selectableChars(save.game)
  // ONE CHARACTER AT A TIME once the cast is big. The chart is quadratic: a
  // twelve-strong roster is 66 readable rows, but a crossover cast of 48 is
  // 1128 and sixty thousand pixels of scroll — a screen nobody can find a
  // matchup in. Past the threshold the report becomes "who am I looking at",
  // which is the question anyone with a roster that size is actually asking.
  const [focusId, setFocusId] = useState(null)
  const focused = chars.length > MATCHUP_FOCUS_ABOVE
  const focus = (focused && (chars.find((c) => c.id === focusId) || chars[0])) || null
  const pairs = []
  if (focus) {
    for (const c of chars) if (c.id !== focus.id) pairs.push([focus, c])
  } else {
    for (let i = 0; i < chars.length; i++) {
      for (let j = i + 1; j < chars.length; j++) pairs.push([chars[i], chars[j]])
    }
  }
  const pct = Math.round(confidence * 100)
  return (
    <div className="card">
      <h3>Matchup Report <span className="dim small">{observe ? '(observed from play)' : '(projected from your designs)'}</span></h3>
      {observe && (
        <div className="card sub" style={{ marginBottom: 8 }}>
          <span className="small">
            📈 Data confidence: <strong className={pct >= 70 ? 'green' : pct >= 35 ? 'gold' : 'red'}>{pct}%</strong>
            <span className="dim"> · {games} sets on this build</span>
          </span>
          {pct < 70 && (
            <p className="dim small" style={{ margin: '4px 0 0' }}>
              Early numbers lie. Patch off thin data and you may nerf a phantom — or miss the real problem.
            </p>
          )}
        </div>
      )}
      <p className="dim small">
        The game reads every character's frame data, damage, meter and setups and derives the chart —
        zoning smothers slow approaches, pressure beats thin defense, damage decides trades.
        Matchups mostly matter at very high skill levels.
      </p>
      {focus && (
        <Field label={`Matchups for (${chars.length} characters — showing one at a time)`}>
          <select value={focus.id} onChange={(e) => setFocusId(e.target.value)}>
            {chars.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
      )}
      {pairs.length === 0 && <p className="dim">Need at least two characters.</p>}
      {pairs.map(([a, b]) => {
        const mu = observe ? observe(save.game, a, b) : computeMatchup(a, b, save.game.rules, save.game)
        const draftPair = changedIds.has(a.id) || changedIds.has(b.id)
        const margin = draftPair ? 9 : Math.round((1 - confidence) * 4.5)
        return (
          <div key={`${a.id}|${b.id}`} style={{ padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
            <div className="row spread">
              <span className="small">
                <strong>{a.name}</strong> vs <strong>{b.name}</strong>
                {draftPair && <span className="red small"> ✏ unreleased changes — projection</span>}
              </span>
              <span className={`small ${Math.abs(mu - 50) >= 8 ? 'red' : Math.abs(mu - 50) >= 4 ? 'gold' : 'green'}`}>
                {mu}–{100 - mu}{observe && margin > 0 && <span className="dim"> ±{margin}</span>}
              </span>
            </div>
            <div className="track" style={{ height: 6, background: 'var(--bg2)', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{ width: `${mu}%`, height: '100%', background: 'linear-gradient(90deg, var(--cyan), var(--pink))' }} />
            </div>
            <span className="dim small">
              {draftPair
                ? 'design spreadsheet math — nobody has played a single set on these numbers'
                : observe && confidence < 0.25 ? 'too early to say why — the data is still arguing with itself' : matchupExplanation(a, b, save.game.rules, save.game)}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// The descriptor controls, in the order they read as a sentence.
const D_FIELDS = [
  ['damage', 'Damage', DAMAGE_TIERS],
  ['chip', 'Chip', CHIP_TIERS],
  ['startup', 'Speed', SPEED_TIERS],
  ['recovery', 'Recovery', SPEED_TIERS],
  ['onBlock', 'On block', BLOCK_TIERS],
  ['guard', 'Blocked', GUARD_TIERS],
  ['reach', 'Reach', REACH_TIERS],
  ['cost', 'Meter', COST_TIERS],
]
const TIMED_KINDS = ['set up', 'trap', 'install']

const fmtPlus = (v) => (v > 0 ? `+${v}` : `${v}`)

// Overheads and lows are the guessing game, so they get to shout about it.
const GUARD_NOTE = {
  overhead: { label: 'must block standing', color: 'var(--gold)' },
  low: { label: 'must block crouching', color: 'var(--cyan)' },
  unblockable: { label: 'unblockable', color: 'var(--red)' },
  mid: null,
}

// What the engine actually sees, once the description resolves. Read-only by
// design: the numbers are derived, and letting them be typed over would leave
// a move claiming "light damage" while hitting for heavy.
function DerivedNumbers({ m }) {
  const bits = [`${m.startup}f start`, `${m.recovery}f rec`, `${fmtPlus(m.onBlock)} on block`]
  if (m.damage) bits.push(`${m.damage} dmg`)
  if (m.chip) bits.push(`${m.chip} chip`)
  if (m.meterCost) bits.push(`${m.meterCost} meter`)
  if (m.duration) bits.push(`${m.duration}s`)
  return <span className="dim small">{bits.join(' · ')}</span>
}

// A labelled dropdown, compact enough to sit in a wrapping row.
function TierPick({ label, value, options, onChange }) {
  return (
    <label className="tierpick">
      <span className="dim">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((t) => <option key={t}>{t}</option>)}
      </select>
    </label>
  )
}

/**
 * One move, as a card. This used to be a row in a very wide table — adding the
 * guard property made it fourteen columns and the whole editor scrolled
 * sideways. Cards wrap instead, so the sheet fits any width and each move
 * reads as its own little design statement.
 */
function MoveCard({ m, patchMove, onDelete, forms = [] }) {
  const set = (key, value) => patchMove(m.id, (x) => {
    x.d = { ...x.d, [key]: value }
    applyMoveDescriptors(x) // descriptors are the truth; re-derive the numbers
  })
  const note = GUARD_NOTE[m.d?.guard]
  const isSwitch = m.type === FORM_MOVE_TYPE
  // `forms` here is whatever this character may switch INTO. An origin's
  // targets are all forms; a form's single target is its origin, which is the
  // one entry with no `formOf`. So an unformed target means this is the way
  // home — no need to thread the owning character down for it.
  const isReturn = isSwitch && !!m.d?.becomes && forms.some((t) => t.id === m.d.becomes && !t.formOf)
  return (
    <div className="movecard">
      <div className="row spread" style={{ marginBottom: 6 }}>
        <div className="row" style={{ gap: 4 }}>
          <input value={m.name} style={{ minWidth: 150 }}
            onChange={(e) => patchMove(m.id, (x) => { x.name = e.target.value })} />
          <button className="small" title="random name for this type"
            onClick={() => patchMove(m.id, (x) => { x.name = generateMoveNameForType(x.type) })}>🎲</button>
          <select value={m.type} onChange={(e) => patchMove(m.id, (x) => {
            x.type = e.target.value
            Object.assign(x, generateMoveData(x.type)) // a fresh description for the new kind
          })}>
            {MOVE_TYPES.map((t) => <option key={t}>{t}</option>)}
          </select>
          <select value={m.d?.form ?? ''} onChange={(e) => set('form', e.target.value)}>
            {(MOVE_FORMS[m.type] || MOVE_FORMS['melee']).map((fm) => <option key={fm}>{fm}</option>)}
          </select>
        </div>
        <button className="small danger" onClick={onDelete}>×</button>
      </div>

      {isSwitch && (
        <div className="row" style={{ gap: 8, marginBottom: 6, alignItems: 'center' }}>
          <label className="tierpick">
            <span className="dim">Becomes</span>
            <select value={m.d?.becomes || ''} onChange={(e) => set('becomes', e.target.value || null)}>
              <option value="">— nothing yet —</option>
              {forms.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          </label>
          {!forms.length ? (
            <span className="red small">
              Nothing to switch into. Point another character's <em>Form of</em> at this one first.
            </span>
          ) : !m.d?.becomes ? (
            <span className="gold small">This move does nothing until it has a target.</span>
          ) : isReturn ? (
            <span className="dim small">
              The way home — drops the form early instead of waiting for the bell.
            </span>
          ) : (
            <span className="dim small">
              Lasts until the bell — meter, speed and safety are what it costs.
            </span>
          )}
        </div>
      )}

      <div className="row" style={{ gap: 8 }}>
        {D_FIELDS.map(([k, label, tiers]) => (
          <TierPick key={k} label={label} value={m.d?.[k] ?? tiers[0]} options={tiers}
            onChange={(v) => set(k, v)} />
        ))}
        {TIMED_KINDS.includes(m.type) && (
          <TierPick label="Lasts" value={m.d?.duration ?? 'none'} options={DURATION_TIERS}
            onChange={(v) => set('duration', v)} />
        )}
      </div>

      <div className="row" style={{ gap: 6, marginTop: 6 }}>
        {(m.d?.effects || []).map((fx, i) => (
          <span className="row" key={i} style={{ gap: 2 }}>
            <select value={fx.trigger} onChange={(e) => patchMove(m.id, (x) => {
              const next = [...x.d.effects]
              next[i] = { ...next[i], trigger: e.target.value }
              x.d = { ...x.d, effects: next }
              applyMoveDescriptors(x)
            })}>
              {EFFECT_TRIGGERS.map((t) => <option key={t}>{t}</option>)}
            </select>
            <select value={fx.effect} onChange={(e) => patchMove(m.id, (x) => {
              const next = [...x.d.effects]
              next[i] = { ...next[i], effect: e.target.value }
              x.d = { ...x.d, effects: next }
              applyMoveDescriptors(x)
            })}>
              {EFFECT_KINDS.map((t) => <option key={t}>{t}</option>)}
            </select>
            <button className="small danger" onClick={() => patchMove(m.id, (x) => {
              x.d = { ...x.d, effects: x.d.effects.filter((_, j) => j !== i) }
              applyMoveDescriptors(x)
            })}>×</button>
          </span>
        ))}
        <button className="small" title="add an extra effect to this move"
          onClick={() => patchMove(m.id, (x) => {
            x.d = {
              ...x.d,
              effects: [...(x.d?.effects || []), { trigger: EFFECT_TRIGGERS[1], effect: EFFECT_KINDS[0] }],
            }
            applyMoveDescriptors(x)
          })}>+ rider</button>
        <DerivedNumbers m={m} />
        {note && <span className="small" style={{ color: note.color }}>· {note.label}</span>}
      </div>
    </div>
  )
}

// The movelist sheet. Moves are DESCRIBED, not numbered — pick what the move
// is like and the game works out the frame data.
function MovelistEditor({ char, patchChar, forms = [] }) {
  const patchMove = (id, fn) => patchChar((c) => {
    const m = c.moves.find((x) => x.id === id)
    if (m) fn(m)
  })
  const [addType, setAddType] = useState('projectile')
  const groups = [
    ['normal', 'Normals'],
    ['special', 'Specials'],
    ['super', 'Supers'],
  ]
  return (
    <div>
      <h4>Movelist</h4>
      {groups.map(([slot, label]) => {
        const moves = char.moves.filter((m) => (m.slot || 'special') === slot)
        if (!moves.length) return null
        return (
          <div key={slot}>
            <p className="dim small" style={{ margin: '10px 0 2px', textTransform: 'uppercase', letterSpacing: 1 }}>{label}</p>
            {moves.map((m) => (
              <MoveCard key={m.id} m={m} patchMove={patchMove} forms={forms}
                onDelete={() => patchChar((c) => { c.moves = c.moves.filter((x) => x.id !== m.id) })} />
            ))}
          </div>
        )
      })}
      <div className="row" style={{ marginTop: 8 }}>
        <select value={addType} onChange={(e) => setAddType(e.target.value)}>
          {MOVE_TYPES.map((t) => <option key={t}>{t}</option>)}
        </select>
        <button className="small" onClick={() => patchChar((c) => {
          c.moves.push(newMove({ name: generateMoveNameForType(addType), type: addType }))
        })}>+ Add {addType}</button>
        <span className="dim small">
          describe what the move is like — the game derives the frame data
        </span>
      </div>
    </div>
  )
}

// Whether a step actually connects to the next one, in a colour you can scan.
const LINK_STYLE = {
  cancel: { color: 'var(--cyan)', mark: '▸' },
  links: { color: 'var(--green)', mark: '▸' },
  counter: { color: 'var(--gold)', mark: '▸' },
  no: { color: 'var(--red)', mark: '✕' },
}

function LinkChip({ status }) {
  const st = LINK_STYLE[status] || LINK_STYLE.no
  return (
    <span className="small" style={{ color: st.color, whiteSpace: 'nowrap' }}
      title={status === 'cancel' ? 'a normal cancelled into a special — always works'
        : status === 'links' ? 'the advantage on hit covers the next move\'s startup'
          : status === 'counter' ? 'only connects on counter-hit'
            : 'they recover first — the combo drops here'}>
      {st.mark} {LINK_LABEL[status]}
    </span>
  )
}

/**
 * Named routes, built from the real movelist and validated against the real
 * frame data. A route stops paying out at the first broken link, so the
 * block-advantage and speed choices made upstairs decide what's buildable.
 */
function CombosEditor({ char, patchChar }) {
  const editCombo = (id, fn) => patchChar((c) => {
    const x = (c.combos || []).find((y) => y.id === id)
    if (x) fn(x, c)
  })
  return (
    <div style={{ marginTop: 12 }}>
      <div className="row spread">
        <h4 style={{ margin: 0 }}>Combos</h4>
        <button className="small" onClick={() => patchChar((c) => {
          const combo = generateCombo(c, (c.combos || []).map((x) => x.name))
          if (combo) { c.combos = c.combos || []; c.combos.push(combo) }
        })}>🎲 New combo</button>
      </div>
      <p className="dim small">
        Routes are checked against the frame data you wrote. A move only follows another if it
        cancels, or if the previous move leaves enough advantage on hit to cover its startup —
        so making a button safer or faster is what opens new routes up.
      </p>
      {(char.combos || []).map((combo) => {
        const moves = comboMoves(char, combo)
        const links = comboLinks(char, combo)
        const breakAt = links.indexOf('no')
        return (
          <div className="card sub" key={combo.id}>
            <div className="row spread">
              <div className="row">
                <input value={combo.name} style={{ minWidth: 150 }}
                  onChange={(e) => editCombo(combo.id, (x) => { x.name = e.target.value })} />
                <span className="gold small">{comboDamage(char, combo)} dmg</span>
                {breakAt >= 0 && (
                  <span className="small" style={{ color: 'var(--red)' }}>
                    drops after hit {breakAt + 1} — the rest doesn't count
                  </span>
                )}
              </div>
              <div className="row">
                <button className="small" title="reroll the route" onClick={() => patchChar((c) => {
                  const x = (c.combos || []).find((y) => y.id === combo.id)
                  const fresh = generateCombo(c, [])
                  if (x && fresh) x.moveIds = fresh.moveIds
                })}>🎲</button>
                <button className="small danger" onClick={() => patchChar((c) => {
                  c.combos = (c.combos || []).filter((y) => y.id !== combo.id)
                })}>×</button>
              </div>
            </div>

            <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginTop: 6, alignItems: 'center' }}>
              {moves.map((m, i) => (
                <span className="row" key={`${combo.id}-${i}`} style={{ gap: 4, alignItems: 'center' }}>
                  {i > 0 && <LinkChip status={links[i - 1]} />}
                  <select value={m.id}
                    style={breakAt >= 0 && i > breakAt ? { opacity: 0.45 } : undefined}
                    onChange={(e) => editCombo(combo.id, (x) => {
                      const next = [...x.moveIds]; next[i] = e.target.value; x.moveIds = next
                    })}>
                    {char.moves.map((opt) => (
                      <option key={opt.id} value={opt.id}>{opt.name}</option>
                    ))}
                  </select>
                  <button className="small danger" title="drop this hit"
                    onClick={() => editCombo(combo.id, (x) => {
                      x.moveIds = x.moveIds.filter((_, j) => j !== i)
                    })}>×</button>
                </span>
              ))}
              <button className="small" onClick={() => editCombo(combo.id, (x) => {
                const last = moves[moves.length - 1]
                // Offer something that actually connects, if anything does.
                const fits = char.moves.filter((o) => !x.moveIds.includes(o.id) && linkStatus(last, o) !== 'no')
                const pick = fits[0] || char.moves.find((o) => !x.moveIds.includes(o.id)) || char.moves[0]
                if (pick) x.moveIds = [...x.moveIds, pick.id]
              })}>+ hit</button>
            </div>
            {!moves.length && <p className="small dim" style={{ margin: '4px 0 0' }}>route uses deleted moves</p>}
          </div>
        )
      })}
      {!(char.combos || []).length && <p className="dim small">No combos named yet.</p>}
    </div>
  )
}

export function StagesEditor({ save, update }) {
  return (
    <div className="card">
      <div className="row spread">
        <h3>Stages</h3>
        <div className="row">
          <button className="small" onClick={() => update((s) => { s.game.stages.push(newStage()) })}>+ Add stage</button>
          <button className="small" onClick={() => update((s) => {
            s.game.stages.push(generateStage(s.game.stages))
          })}>🎲 Generate</button>
        </div>
      </div>
      <p className="dim small">Stages set the backdrop matches are fought on — pick each one's art below.</p>
      {save.game.stages.map((st) => (
        <div className="card sub" key={st.id}>
          <div className="row spread">
            <div className="row">
              <input value={st.name} onChange={(e) => update((s) => {
                const x = s.game.stages.find((y) => y.id === st.id); if (x) x.name = e.target.value
              })} />
              <select value={st.vibe || 'hype'} title="stage vibe" onChange={(e) => update((s) => {
                const x = s.game.stages.find((y) => y.id === st.id); if (x) x.vibe = e.target.value
              })}>
                {STAGE_VIBES.map((v) => <option key={v}>{v}</option>)}
              </select>
            </div>
            <button className="small danger" onClick={() => update((s) => {
              s.game.stages = s.game.stages.filter((y) => y.id !== st.id)
            })}>×</button>
          </div>
          <div style={{ margin: '6px 0' }}>
            <StagePicker
              value={st.bgKey || null}
              autoStage={stageArt({ ...st, bgKey: null })}
              onChange={(k) => update((s) => {
                const x = s.game.stages.find((y) => y.id === st.id); if (x) x.bgKey = k
              })}
            />
          </div>
          <textarea placeholder="description…" value={st.description} onChange={(e) => update((s) => {
            const x = s.game.stages.find((y) => y.id === st.id); if (x) x.description = e.target.value
          })} />
        </div>
      ))}
    </div>
  )
}

/**
 * The concession stand and the side-cabinet floor, from FIXED catalogs —
 * no more inventing menu items. Every item has a real price tag: an install
 * cost up front and a weekly upkeep/restock. Prices are always shown.
 *
 * `live` (mid-save) spends destructively from the account. `budget`
 * (creation) shows costs and a budget bar but doesn't touch the account — the
 * leftover becomes opening cash at start. Sandbox: everything is free.
 */
export function ArcadeEditor({ save, update, live = false, budget = false }) {
  const priced = live || budget
  const toggle = (key, name, initialCost, costLabel) => update((s) => {
    const owned = s.arcade[key].includes(name)
    if (owned) {
      s.arcade[key] = s.arcade[key].filter((x) => x !== name)
    } else {
      // The run that earns an attraction gets one room on the house.
      if (live && !claimFreeInstall(s, name) && !trySpend(s, initialCost, costLabel)) return
      s.arcade[key].push(name)
      // Seed a default price so it's sellable from day one (editable in Prices).
      if (key === 'foods') { s.arcade.foodPrices = { ...(s.arcade.foodPrices || {}) }; s.arcade.foodPrices[name] ??= DEFAULT_FOOD_PRICE }
      if (key === 'otherGames') { s.arcade.gameTokens = { ...(s.arcade.gameTokens || {}) }; s.arcade.gameTokens[name] ??= DEFAULT_GAME_TOKENS }
    }
  })

  const setSetups = (v) => update((s) => {
    const cur = s.settings.setups
    if (live && v > cur) {
      let n = cur
      while (n < v && trySpend(s, SETUP_COST, 'new setup cabinet')) n++
      s.settings.setups = n
    } else {
      s.settings.setups = Math.max(1, v)
    }
  })

  // Only what this lineage has earned the right to carry. Locked packs are
  // listed below the catalogue rather than hidden — a counter you cannot stock
  // yet is supposed to be visible, because half the regulars want something off
  // it and you can read exactly what would open it.
  const catalogCard = (title, blurb, key, catalog, describe, costOf, labelOf, allowed, locked) => (
    <div className="card">
      <h3>{title}</h3>
      <p className="dim small">{blurb}</p>
      {catalog.filter((item) => allowed.includes(item.name)).map((item) => {
        const owned = save.arcade[key].includes(item.name)
        const free = !owned && hasFreeInstall(save, item.name)
        return (
          <div className="row spread" key={item.name} style={{ borderBottom: '1px solid var(--border)', padding: '3px 0' }}>
            <span className={`pill clickable ${owned ? 'on' : ''}`}
              onClick={() => toggle(key, item.name, costOf(item), labelOf(item))}>
              {owned ? '✓ ' : '+ '}{item.name}
            </span>
            <span className="dim small">
              {free && <span className="gold">first one on the house · </span>}{describe(item)}
            </span>
          </div>
        )
      })}
      {locked.map((pack) => (
        <div key={pack.key} style={{ borderTop: '1px solid var(--border)', paddingTop: 6, marginTop: 6, opacity: 0.75 }}>
          <div className="row spread">
            <span className="small">🔒 {pack.icon} {pack.label}</span>
            <span className="dim small">{(pack.foods || pack.items).length} items</span>
          </div>
          <p className="dim small" style={{ margin: '2px 0 0' }}>
            {pack.blurb} <span className="gold">Earned by: {howToUnlock(pack.key)}</span>
          </p>
        </div>
      ))}
      {/* Legacy custom items from before the fixed catalogs still work — they just can't be re-added. */}
      {save.arcade[key].filter((n) => !catalog.some((c) => c.name === n)).map((n) => (
        <div className="row spread" key={n} style={{ padding: '3px 0' }}>
          <span className="pill on clickable" onClick={() => toggle(key, n, 0, '')}>✓ {n}</span>
          <span className="dim small">custom (legacy)</span>
        </div>
      ))}
    </div>
  )

  return (
    <div>
      {budget && <BudgetBar save={save} />}
      <StreamRigCard save={save} update={update} priced={priced} />
      <div className="card">
        <h3>🕹 Setups <span className="dim small">— cabinets running {save.game.name || 'the main game'}</span></h3>
        <p className="dim small">
          More setups mean more matches an hour (and more token income), but each cabinet
          {priced ? <> costs <strong className="gold">${SETUP_COST}</strong> to install and</> : ''} adds to the rent and upkeep.
        </p>
        <NumField label="Number of setups" value={save.settings.setups} min={1} max={20} onChange={setSetups} />
      </div>
      <div className="grid2">
        {catalogCard(
          'Concession Stand',
          'Players who find their favorite snacks show up more often — and buy them at the price you set. Stocking costs up front; restocking hits the books weekly.',
          'foods', FOOD_CATALOG,
          (f) => `${priced ? `$${f.stockCost} to stock · ` : ''}$${f.restock}/wk restock`,
          (f) => f.stockCost, (f) => `stocked ${f.name}`,
          availableFoods(save), lockedFoodPacks(save),
        )}
        {catalogCard(
          'The Floor',
          'Side cabinets your players hang around between sets, and attractions that pull a crowd of their own — the bowling lanes take money on an afternoon when not one fighting-game player walks in. Everything here costs an installation fee, weekly maintenance, and rent.',
          'otherGames', GAME_CATALOG,
          (g) => `${priced ? `$${g.price} to install · ` : ''}$${g.upkeep}/wk upkeep`,
          (g) => g.price, (g) => `installed ${g.name}`,
          availableAttractions(save), lockedAttractionPacks(save),
        )}
      </div>
      <AdvertisingEditor save={save} update={update} />
    </div>
  )
}

/**
 * The camera. Bought every single run, and never carried over.
 *
 * Streaming is the strongest lever in the game — belief, popularity, followers,
 * and the only route to a player who doesn't choke at EVO — so the price is
 * really "will you spend most of an opening float on something that pays back
 * over months". Skipping it is a legitimate strategy for one lean run and a
 * terrible one for a lineage.
 */
function StreamRigCard({ save, update, priced }) {
  const has = canStream(save)
  const afford = (save.economy?.money ?? 0) >= STREAM_RIG_COST
  return (
    <div className="card" style={has ? undefined : { borderColor: 'var(--gold)' }}>
      <div className="row spread">
        <h3 style={{ margin: 0 }}>📡 Streaming Setup</h3>
        {has
          ? <span className="green small">✓ on the air as {save.stream?.channelName}</span>
          : <span className="gold small">{priced ? `$${STREAM_RIG_COST}` : 'not set up'}</span>}
      </div>
      {has ? (
        <p className="dim small" style={{ margin: '4px 0 0' }}>
          A camera on setup one and an encoder under the counter. Every match you put on the
          channel builds followers, and builds the nerve of whoever is playing.
        </p>
      ) : (
        <>
          <p className="dim small" style={{ margin: '4px 0 6px' }}>
            Without one there is no channel this run — no followers, no hype, and nobody on
            your roster gets the stage time that stops them freezing at EVO. It does not
            carry over: every run buys its own.
          </p>
          <button className="primary small" disabled={priced && !afford}
            onClick={() => update((s) => {
              if (priced && !trySpend(s, STREAM_RIG_COST, 'streaming setup')) return
              s.arcade.streamRig = true
            })}>
            {priced ? `Buy the rig — $${STREAM_RIG_COST}` : 'Set up the channel'}
          </button>
          {priced && !afford && <span className="red small"> — you can't afford it yet.</span>}
        </>
      )}
    </div>
  )
}

// Advertising: how you get people through the door, especially early. Each
// channel is a recurring weekly upkeep cost. Some reach further while you're
// unknown; others hold momentum or steer public opinion once you're rolling.
export function AdvertisingEditor({ save, update }) {
  const active = save.arcade.ads || []
  const toggle = (key) => update((s) => {
    const cur = s.arcade.ads || []
    s.arcade.ads = cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key]
  })
  const phaseHint = (c) => {
    if (c.phase === 'opinion') return { text: '📣 steers opinion', color: 'var(--cyan)' }
    if (c.phase === 'steady') return { text: '🔁 steady momentum', color: 'var(--cyan)' }
    if (c.phase === 'late') return { text: '💪 late-game reach', color: 'var(--gold)' }
    // early: effectiveness fades as you become known
    const eff = adEffectiveness(save, c)
    if (eff >= 0.7) return { text: '🔥 great right now', color: 'var(--green)' }
    if (eff >= 0.35) return { text: '📉 fading — you\'re getting known', color: 'var(--gold)' }
    return { text: '🥱 barely worth it now', color: 'var(--red)' }
  }
  return (
    <div className="card">
      <div className="row spread">
        <h3>📣 Advertising</h3>
        <span className="small gold">+${adWeeklyCost(save)}/wk to upkeep</span>
      </div>
      <p className="dim small">
        Run as many channels as you like — each adds its weekly cost to your upkeep bill. This is the
        main way to get people through the door before there's a scene to speak of.
      </p>
      {AD_CHANNELS.map((c) => {
        const on = active.includes(c.key)
        const locked = c.unlock && !isUnlocked(save, c.unlock)
        const hint = phaseHint(c)
        if (locked) {
          return (
            <div key={c.key} className="row spread" style={{ borderBottom: '1px solid var(--border)', padding: '5px 0', alignItems: 'flex-start', opacity: 0.7 }}>
              <div style={{ flex: 1 }}>
                <span className="pill">🔒 {c.label}</span>
                <p className="dim small" style={{ margin: '2px 0 0' }}>
                  {c.blurb} <span className="gold">Earned by: {howToUnlock(c.unlock)}</span>
                </p>
              </div>
              <span className="dim small" style={{ whiteSpace: 'nowrap' }}>${c.cost}/wk</span>
            </div>
          )
        }
        return (
          <div key={c.key} className="row spread" style={{ borderBottom: '1px solid var(--border)', padding: '5px 0', alignItems: 'flex-start' }}>
            <div style={{ flex: 1 }}>
              <span className={`pill clickable ${on ? 'on' : ''}`} onClick={() => toggle(c.key)}>
                {on ? '✓ ' : '+ '}{c.label}
              </span>
              <span className="small" style={{ color: hint.color, marginLeft: 6 }}>{hint.text}</span>
              <p className="dim small" style={{ margin: '3px 0 0' }}>{c.blurb}</p>
            </div>
            <span className="small gold" style={{ whiteSpace: 'nowrap', marginLeft: 8 }}>${c.cost}/wk</span>
          </div>
        )
      })}
    </div>
  )
}

// The creation budget: your difficulty's starting funds, spent building the
// arcade. Shown while setting up so you can see what's left before you open.
export function BudgetBar({ save }) {
  if (save.settings.mode === 'sandbox') return null
  const budget = startingBudget(save)
  const spent = arcadeBuildCost(save)
  const left = budget - spent
  const pct = Math.max(0, Math.min(100, Math.round((spent / budget) * 100)))
  return (
    <div className="card sub" style={{ marginBottom: 10, ...(left < 0 ? { borderColor: 'var(--red)' } : {}) }}>
      <div className="row spread">
        <span className="small">💰 Build budget</span>
        <span className={`small ${left < 0 ? 'red' : 'green'}`}>
          ${spent} spent · <strong>${left}</strong> {left < 0 ? 'over budget' : 'left to open with'}
        </span>
      </div>
      <div className="track" style={{ height: 6, background: 'var(--bg2)', borderRadius: 3, overflow: 'hidden', marginTop: 4 }}>
        <div style={{ width: `${pct}%`, height: '100%', background: left < 0 ? 'var(--red)' : left < budget * 0.15 ? 'var(--gold)' : 'linear-gradient(90deg, var(--cyan), var(--green))' }} />
      </div>
      <div className="row spread" style={{ marginTop: 6 }}>
        <span className="dim small">of ${budget} starting budget</span>
        <span className="dim small">then ~${projectedMonthlyCost(save)}/month to run</span>
      </div>
    </div>
  )
}

// The owner sets the prices; the players vote with their wallets. One global
// token price (what a token costs), a per-cabinet token cost to play each
// side game, and a per-item dollar price for every food.
export function PricesEditor({ save, update }) {
  const token = save.arcade.prices?.token ?? 1
  const play = playTokensOf(save)
  const perPlay = costPerPlay(save)
  // What the room actually judges is the two multiplied, so say it out loud —
  // otherwise "25c a token" reads as generous while quietly charging $2.
  const verdict = perPlay <= 0.55 ? ['pocket change', 'var(--green)']
    : perPlay <= 1.15 ? ['what an arcade costs', 'var(--green)']
    : perPlay <= 1.75 ? ['steep — they will notice', 'var(--gold)']
    : perPlay <= 2.5 ? ['expensive; the machines will sit quiet', 'var(--red)']
    : ['nobody pays this for one match', 'var(--red)']
  return (
    <div className="card">
      <h3>💲 Prices</h3>
      <p className="dim small">
        A token costs the price below, and a match on the main game takes however many tokens you
        set. What players judge is the two multiplied — a 25¢ token at 4 a match is the same dollar
        as a $1 token at 1. Price a match too high and the machines sit quiet; price it low and the
        room fills up with people who play all night and spend at the counter instead.
      </p>
      <div className="row" style={{ gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div style={{ maxWidth: 240 }}>
          <NumField label="Token price ($ per token)" value={token} min={0.25} max={5} step={0.25}
            onChange={(v) => update((s) => { s.arcade.prices = { ...(s.arcade.prices || {}), token: v } })} />
        </div>
        <div style={{ maxWidth: 240 }}>
          <NumField label="Tokens per match" value={play} min={1} max={8} step={1}
            onChange={(v) => update((s) => { s.arcade.prices = { ...(s.arcade.prices || {}), play: Math.max(1, Math.round(v)) } })} />
        </div>
      </div>
      <p className="small" style={{ margin: '2px 0 0' }}>
        <span className="dim">A match costs </span>
        <strong style={{ color: verdict[1] }}>${perPlay.toFixed(2)}</strong>
        <span style={{ color: verdict[1] }}> — {verdict[0]}</span>
      </p>

      <div className="grid2" style={{ marginTop: 8 }}>
        <div>
          <h4 style={{ margin: '4px 0' }}>Side cabinets <span className="dim small">(tokens to play)</span></h4>
          {save.arcade.otherGames.length === 0 && <p className="dim small">No side cabinets installed.</p>}
          {save.arcade.otherGames.map((g) => (
            <div className="row spread" key={g} style={{ padding: '2px 0' }}>
              <span className="small">{g}</span>
              <span className="row" style={{ gap: 4 }}>
                <input type="number" className="fd" min={1} max={12} value={gameTokensOf(save, g)}
                  onChange={(e) => update((s) => {
                    s.arcade.gameTokens = { ...(s.arcade.gameTokens || {}), [g]: Math.max(1, Number(e.target.value)) }
                  })} />
                <span className="dim small">tokens</span>
              </span>
            </div>
          ))}
        </div>
        <div>
          <h4 style={{ margin: '4px 0' }}>Concessions <span className="dim small">($ per item)</span></h4>
          {save.arcade.foods.length === 0 && <p className="dim small">No food stocked.</p>}
          {save.arcade.foods.map((f) => (
            <div className="row spread" key={f} style={{ padding: '2px 0' }}>
              <span className="small">{f}</span>
              <span className="row" style={{ gap: 4 }}>
                <span className="dim small">$</span>
                <input type="number" className="fd" min={1} max={30} step={0.5} value={foodPriceOf(save, f)}
                  onChange={(e) => update((s) => {
                    s.arcade.foodPrices = { ...(s.arcade.foodPrices || {}), [f]: Math.max(0.5, Number(e.target.value)) }
                  })} />
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/**
 * Payroll and the people on it. Wages are the levers: underpay and staff
 * quit and stop caring (dirty floor, broken machines, unhappy players);
 * managers keep the floor effective — in the right ratio. Players can be
 * hired too, but nobody works the counter and plays at the same time.
 */
export function StaffManagement({ save, update }) {
  const st = save.staffing
  const live = save.settings.mode !== 'sandbox'
  const { employees, managers } = staffCounts(save)
  const mgmt = managementQuality(save)
  const clean = Math.round(save.arcade.cleanliness ?? 80)
  const hirable = Object.values(save.players).filter((p) => !p.npc && p.isRegular && !p.retired && !isStaffed(save, p.id))
  const [hirePlayerId, setHirePlayerId] = useState('')
  const draw = playerStaffAppeal(save)
  // Per-player pull if put behind the counter — mirrors playerStaffAppeal's
  // single-member contribution, so the dropdown can flag who's actually a draw.
  const appealOf = (p) => {
    const fame = Math.max(0, Math.min(1, (p.respect + p.glory * 1.2) / 100))
    const warmth = (((p.social?.community ?? 5) + (p.social?.charisma ?? 5)) / 20)
    return fame * 0.75 + warmth * 0.35
  }

  const hire = (role, playerId = null) => update((s) => {
    if (live && !trySpend(s, HIRE_COST, `hired a ${role}`)) return
    const player = playerId ? s.players[playerId] : null
    const member = newStaffMember(role, playerId, player ? `${player.firstName} ${player.lastName}` : null)
    s.staffing.staff.push(member)
  })

  const meter = (label, value, goodAt) => (
    <div style={{ flex: 1, minWidth: 180 }}>
      <div className="row spread">
        <span className="small">{label}</span>
        <span className={`small ${value >= goodAt ? 'green' : value >= goodAt * 0.6 ? 'gold' : 'red'}`}>{value}</span>
      </div>
      <div className="track" style={{ height: 6, background: 'var(--bg2)', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ width: `${value}%`, height: '100%', background: value >= goodAt ? 'var(--green)' : value >= goodAt * 0.6 ? 'var(--gold)' : 'var(--red)' }} />
      </div>
    </div>
  )

  return (
    <div>
      <div className="card">
        <h3>🧹 Staff</h3>
        <div className="row" style={{ gap: 16 }}>
          {meter('Staff morale', Math.round(st.morale), 60)}
          {meter('Cleanliness', clean, 55)}
          {meter('Management', Math.round(mgmt * 100), 60)}
          {draw > 0.05 && meter('Counter draw', Math.min(100, Math.round(draw * 55)), 40)}
        </div>
        <p className="dim small">
          Employees clean and keep customers happy. Managers keep employees effective (about one per
          four employees, fairly paid) — too few and the floor slips and machines break; too many and
          people quit. Cleanliness below 30 invites the health inspector, and a failed inspection means
          a temporary shutdown.
        </p>
      </div>

      <div className="grid2">
        <div className="card">
          <h4 style={{ marginTop: 0 }}>Wages <span className="dim small">(per person, per day — market rate: ${FAIR_WAGE.employee} / ${FAIR_WAGE.manager})</span></h4>
          <div className="row">
            <NumField label="Employee wage ($/day)" value={st.employeeWage} min={1} max={40}
              onChange={(v) => update((s) => { s.staffing.employeeWage = v })} />
            <NumField label="Manager wage ($/day)" value={st.managerWage} min={1} max={60}
              onChange={(v) => update((s) => { s.staffing.managerWage = v })} />
          </div>
          <p className="dim small">
            Daily payroll: ${employees * st.employeeWage + managers * st.managerWage}
            {' '}({employees} employee{employees === 1 ? '' : 's'}, {managers} manager{managers === 1 ? '' : 's'}).
            Underpaying drives turnover and tanks morale.
          </p>
          <div className="row">
            <button className="small" onClick={() => hire('employee')}>+ Hire employee{live ? ` ($${HIRE_COST})` : ''}</button>
            <button className="small" onClick={() => hire('manager')}>+ Hire manager{live ? ` ($${HIRE_COST})` : ''}</button>
          </div>
          {hirable.length > 0 && (
            <div className="row" style={{ marginTop: 6 }}>
              <select value={hirePlayerId} onChange={(e) => setHirePlayerId(e.target.value)}>
                <option value="">Hire a player…</option>
                {[...hirable].sort((a, b) => appealOf(b) - appealOf(a)).map((p) => (
                  <option key={p.id} value={p.id}>
                    {appealOf(p) >= 0.6 ? '⭐ ' : ''}{displayName(p, save)} — draw {appealOf(p).toFixed(1)}
                  </option>
                ))}
              </select>
              <button className="small" disabled={!hirePlayerId}
                title="a familiar face draws regulars in and lifts staff morale — but they can't compete while working"
                onClick={() => { hire('employee', hirePlayerId); setHirePlayerId('') }}>
                Put them on the counter
              </button>
            </div>
          )}
          <p className="dim small">
            <b>Outside hire:</b> pure labor — cheap, and you don't lose a competitor.{' '}
            <b>Put a player on the counter:</b> a familiar (or famous) face is a draw — regulars
            turn up to hang out where their friend works, and a community-minded player lifts staff
            morale. The cost: they can't compete or train while on shift, and their passion slowly
            cools. Staff who watch enough sets sometimes quit to become players.
          </p>
        </div>

        <div className="card">
          <h4 style={{ marginTop: 0 }}>On the payroll ({st.staff.length})</h4>
          {st.staff.length === 0 && <p className="dim">Nobody. You're mopping this floor yourself.</p>}
          {st.staff.map((s) => (
            <div className="row spread" key={s.id} style={{ borderBottom: '1px solid var(--border)', padding: '3px 0' }}>
              <span className="small">
                {s.role === 'manager' ? '📋' : '🧹'} {s.name}
                <span className="dim"> — {s.role}</span>
                {s.playerId && <span className="cyan small"> (player)</span>}
              </span>
              <button className="small danger" onClick={() => update((x) => {
                x.staffing.staff = x.staffing.staff.filter((y) => y.id !== s.id)
              })}>let go</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export function ScheduleEditor({ save, update }) {
  const consequential = save.settings.mode !== 'sandbox'
  // Consequential worlds hold real tournaments to a floor: no sub-8-player
  // singles brackets and no sub-4-team crew battles. Sandbox allows anything.
  const minBracket = (type) => (consequential ? (type === 'teams' ? 4 : 8) : 2)

  // Every edit is checked against the bandwidth meter BEFORE it lands, so an
  // over-booked calendar is impossible rather than merely inadvisable. A change
  // that doesn't fit is simply refused — see game/bandwidth.js.
  const patchEntry = (id, fn) => update((s) => {
    const x = s.arcade.schedule.find((y) => y.id === id)
    if (!x) return
    const trial = structuredClone(x)
    fn(trial)
    if (!fitsBandwidth(s, trial, id)) return
    fn(x)
  })

  const cap = bandwidthCap(save)
  const used = scheduleLoad(save)
  const pct = Math.min(100, Math.round((used / cap) * 100))
  const tone = used > cap ? 'red' : pct > 85 ? 'gold' : 'green'
  const nextTier = BANDWIDTH_TIERS.find((t) => !isUnlocked(save, t.unlock))

  return (
    <div className="card">
      <div className="row spread">
        <h3>Recurring Tournaments</h3>
        <button className="small" onClick={() => update((s) => {
          const entry = newTournamentEntry({ name: generateTournamentName(), size: minBracket('singles') })
          if (!fitsBandwidth(s, entry)) return
          s.arcade.schedule.push(entry)
        })}>+ Schedule tournament</button>
      </div>

      {/* The meter. A bracket costs a night of setups, a staff shift and a
          floor that needs cleaning afterwards — this is where you find out
          that a weekly 32-player double-elim was never a real plan. */}
      <div style={{ margin: '4px 0 10px' }}>
        <div className="row spread">
          <span className="small">📡 Bandwidth</span>
          <span className={`small ${tone}`}>{used} / {cap} matches a month</span>
        </div>
        <div className="track" style={{ height: 8, background: 'var(--bg2)', borderRadius: 4, overflow: 'hidden', marginTop: 3 }}>
          <div style={{ width: `${pct}%`, height: '100%', background: `var(--${tone})` }} />
        </div>
        <p className="dim small" style={{ margin: '4px 0 0' }}>
          What a calendar costs is the SETS it has to get through, so a round robin is dear and a
          yearly major is cheap. You cannot book past the meter.
          {nextTier && <> <span className="gold">Next {nextTier.amount}: {howToUnlock(nextTier.unlock)}</span></>}
        </p>
      </div>

      <p className="dim small">
        Brackets are always a power of two — the bracket size you set here is the invite list, filled by
        elo + reputation. If the slots can't be filled, that running of the tournament is cancelled.
        {consequential && ' Consequential worlds require at least 8 players (singles) or 4 teams (crew battles).'}
        {' '}EVO happens automatically on day {EVO_DAY} ({formatDay(EVO_DAY, 1).replace(', Year 1', '')}) every year — your top 8 qualify.
      </p>
      {save.arcade.schedule.map((t) => (
        <div className="card sub" key={t.id}>
          <div className="row">
            <input value={t.name} style={{ minWidth: 180 }}
              onChange={(e) => patchEntry(t.id, (x) => { x.name = e.target.value })} />
            <button className="small" title="random name"
              onClick={() => patchEntry(t.id, (x) => { x.name = generateTournamentName() })}>🎲</button>
            <select value={t.type} onChange={(e) => patchEntry(t.id, (x) => {
              x.type = e.target.value
              // Switching type may make the size illegal (e.g. a 4-team bracket
              // becoming a singles bracket) — bump it up to the new floor.
              const min = minBracket(x.type)
              if ((x.size || 8) < min) x.size = min
            })}>
              <option value="singles">Singles</option>
              <option value="teams">Team battle</option>
            </select>
            {t.type === 'singles' && (
              <select value={t.format || 'single'} title="bracket format"
                onChange={(e) => patchEntry(t.id, (x) => { x.format = e.target.value })}>
                <option value="single">Single elim</option>
                <option value="doubleelim">Double elim</option>
                <option value="roundrobin">Round robin</option>
              </select>
            )}
            <select value={t.cadence || 'weekly'} onChange={(e) => patchEntry(t.id, (x) => { x.cadence = e.target.value })}>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
            </select>
            {(t.cadence || 'weekly') === 'weekly' && (
              <select value={t.weekday || 0} onChange={(e) => patchEntry(t.id, (x) => { x.weekday = Number(e.target.value) })}>
                {WEEKDAYS.map((w, i) => <option key={w} value={i}>every {w}</option>)}
              </select>
            )}
            {t.cadence === 'monthly' && (
              <label className="row small dim">
                day
                <input type="number" min={1} max={28} value={t.dayOfMonth || 1}
                  onChange={(e) => patchEntry(t.id, (x) => { x.dayOfMonth = Number(e.target.value) })} />
                of each month
              </label>
            )}
            {t.cadence === 'yearly' && (
              <label className="row small dim">
                day
                <input type="number" min={1} max={DAYS_PER_YEAR} value={t.dayOfYear}
                  onChange={(e) => patchEntry(t.id, (x) => { x.dayOfYear = Number(e.target.value) })} />
                ({formatDay(t.dayOfYear || 1, 1).replace(', Year 1', '')})
              </label>
            )}
            <label className="row small dim">
              bracket
              <select value={Math.max(t.size || 8, minBracket(t.type))}
                onChange={(e) => patchEntry(t.id, (x) => { x.size = Number(e.target.value) })}>
                {BRACKET_SIZES.filter((n) => n >= minBracket(t.type)).map((n) => (
                  <option key={n} value={n}>{n} {t.type === 'teams' ? 'teams' : 'players'}</option>
                ))}
              </select>
            </label>
            <button className="small danger" onClick={() => update((s) => {
              s.arcade.schedule = s.arcade.schedule.filter((y) => y.id !== t.id)
            })}>×</button>
          </div>
          {/* What this one event is spending, so an over-budget edit that got
              refused is self-explanatory rather than mysterious. */}
          <div className="dim small" style={{ marginTop: 4 }}>
            📡 {eventLoad(t)} matches a month
            {eventLoad(t) > bandwidthCap(save) * 0.5 && <span className="gold"> — that's most of your bandwidth</span>}
          </div>
        </div>
      ))}
      {save.arcade.schedule.length === 0 && <p className="dim">Nothing scheduled yet.</p>}
    </div>
  )
}

/**
 * The universal mechanics: the rules every character plays by. Changing one of
 * these re-tunes the whole cast at once — give everyone a burst and pressure
 * characters get worse without a single move being touched — which is exactly
 * why they're patchable.
 */
export function RulesEditor({ save, update }) {
  const rules = { ...defaultRules(), ...(save.game.rules || {}) }
  const setRule = (key, value) => update((s) => {
    s.game.rules = { ...defaultRules(), ...(s.game.rules || {}), [key]: value }
  })
  const taunt = netcodeTaunt(rules)

  return (
    <div className="card">
      <h3>Universal Mechanics</h3>
      <p className="dim small">
        The systems the whole cast shares. These change what a character IS without
        touching the character — and every one of them can be altered in a patch.
      </p>

      {RULE_FAMILIES.map((fam) => (
        <div className="card sub" key={fam.key}>
          <h4 style={{ margin: '0 0 2px' }}>{fam.label}</h4>
          <p className="dim small" style={{ margin: '0 0 8px' }}>{fam.blurb}</p>
          <div className="row" style={{ gap: 10 }}>
            {fam.rules.map((r) => (
              <label className="tierpick" key={r.key} title={r.note || r.label}>
                <span className="dim">{r.label}</span>
                <select value={rules[r.key]} onChange={(e) => setRule(r.key, e.target.value)}>
                  {r.options.map((o) => <option key={o}>{o}</option>)}
                </select>
              </label>
            ))}
          </div>
          {fam.rules.some((r) => r.note) && (
            <ul className="dim small" style={{ margin: '8px 0 0', paddingLeft: 18 }}>
              {fam.rules.filter((r) => r.note).map((r) => (
                <li key={r.key}><strong>{r.label}</strong> — {r.note}</li>
              ))}
            </ul>
          )}
        </div>
      ))}

      <NetcodeRow rules={rules} update={update} taunt={taunt} />
    </div>
  )
}

/**
 * The netcode selector does not work, and that is the feature.
 *
 * The revert is DELAYED on purpose: picking rollback has to visibly land for a
 * beat before the game quietly puts it back, because an instant snap just
 * reads as a broken dropdown. A quarter of a second is long enough to see it
 * happen to you.
 */
function NetcodeRow({ rules, update, taunt }) {
  // Shows the choice that was just made, before the game takes it back.
  const [pending, setPending] = useState(null)

  const choose = (choice) => {
    setPending(choice)
    // The revert is DELAYED on purpose: picking rollback has to visibly land
    // for a beat before the game quietly puts it back, because an instant snap
    // just reads as a broken dropdown. A quarter second is long enough to see
    // it happen to you.
    //
    // Plain setTimeout rather than an effect: `update` is rebuilt on every
    // parent render, so an effect depending on it reschedules its own timer
    // forever and the revert never lands.
    setTimeout(() => {
      update((s) => {
        const cur = { ...defaultRules(), ...(s.game.rules || {}) }
        s.game.rules = { ...cur, ...tryNetcode(cur, choice) }
      })
      setPending(null)
    }, 260)
  }

  return (
    <div className="card sub">
      <h4 style={{ margin: '0 0 2px' }}>Netcode</h4>
      <p className="dim small" style={{ margin: '0 0 8px' }}>How the game handles online play.</p>
      <div className="row" style={{ gap: 10 }}>
        <label className="tierpick">
          <span className="dim">Netcode</span>
          <select value={pending ?? rules.netcode} onChange={(e) => choose(e.target.value)}>
            {NETCODE_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </label>
      </div>
      {taunt && <p className="small" style={{ color: 'var(--red)', margin: '8px 0 0' }}>{taunt}</p>}
    </div>
  )
}

const ROLE_COLOR = {
  'keep-out': 'var(--cyan)',
  'grappler': 'var(--red)',
  'rushdown': 'var(--gold)',
  'balanced': 'var(--dim)',
}
const ROLE_BLURB = {
  'keep-out': 'holds the ground and makes you come to them',
  'grappler': 'has to get close, and ends it when they do',
  'rushdown': 'gets in fast and refuses to leave',
  'balanced': 'sits outside the wheel — no free wins, no free losses',
}

/**
 * The style triangle, made visible. Fighting-game matchups aren't a ladder —
 * they're a wheel, and the wheel is the thing a designer needs to be able to
 * see. This shows the rule, which of THIS cast sits where, and the matchup
 * percentages those styles actually produce in this game right now (rules and
 * frame data included, so it moves when you patch).
 */
export function StyleWheel({ save }) {
  const chars = selectableChars(save.game)
  const rules = save.game.rules
  const roles = ['keep-out', 'grappler', 'rushdown', 'balanced']
  const byRole = Object.fromEntries(roles.map((r) => [r, chars.filter((c) => styleRoleOf(c) === r)]))

  // What these two styles actually average against each other in this cast.
  const between = (a, b) => {
    const pairs = []
    for (const x of byRole[a]) for (const y of byRole[b]) if (x !== y) pairs.push(computeMatchup(x, y, rules, save.game))
    if (!pairs.length) return null
    return Math.round(pairs.reduce((s, v) => s + v, 0) / pairs.length)
  }

  return (
    <div className="card">
      <h3>Style Matchups</h3>
      <p className="dim small">
        Matchups aren&apos;t a ladder — they&apos;re a wheel. Each style has a style it beats and one
        that beats it, on top of whatever the frame data says. Balanced styles sit outside it.
      </p>

      <div className="row" style={{ gap: 10, alignItems: 'stretch' }}>
        {['keep-out', 'grappler', 'rushdown'].map((role) => {
          const prey = STYLE_BEATS[role]
          const measured = between(role, prey)
          return (
            <div className="card sub" key={role} style={{ flex: '1 1 220px', margin: 0, borderColor: ROLE_COLOR[role] }}>
              <div style={{ color: ROLE_COLOR[role], fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>
                {role}
              </div>
              <div className="small dim" style={{ marginBottom: 6 }}>{ROLE_BLURB[role]}</div>
              <div className="small">
                beats <strong style={{ color: ROLE_COLOR[prey] }}>{prey}</strong>
                {measured != null && <span className="gold"> · {measured}% in your game</span>}
              </div>
              <div className="small dim" style={{ fontStyle: 'italic', marginTop: 2 }}>
                {STYLE_WHY[`${role}|${prey}`]}
              </div>
              <div className="small" style={{ marginTop: 6 }}>
                {byRole[role].length
                  ? byRole[role].map((c) => c.name).join(', ')
                  : <span className="dim">nobody in your cast plays this style</span>}
              </div>
            </div>
          )
        })}
      </div>

      {byRole.balanced.length > 0 && (
        <p className="small" style={{ marginTop: 8 }}>
          <span className="dim">Outside the wheel — </span>
          {byRole.balanced.map((c) => c.name).join(', ')}
          <span className="dim"> ({ROLE_BLURB.balanced})</span>
        </p>
      )}

      {roles.every((r) => !byRole[r].length || r === 'balanced') && (
        <p className="small" style={{ color: 'var(--gold)', marginTop: 8 }}>
          ⚠ Your whole cast sits outside the wheel. Nothing counters anything — every matchup
          comes down to raw numbers.
        </p>
      )}

      <details style={{ marginTop: 10 }}>
        <summary className="small dim" style={{ cursor: 'pointer' }}>▸ which archetype is which style</summary>
        <div className="row" style={{ gap: 6, marginTop: 6 }}>
          {Object.entries(STYLE_ROLES).map(([arch, role]) => (
            <span className="pill small" key={arch} style={{ borderColor: ROLE_COLOR[role] }}>
              {arch} <span style={{ color: ROLE_COLOR[role] }}>· {role}</span>
            </span>
          ))}
        </div>
      </details>
    </div>
  )
}
