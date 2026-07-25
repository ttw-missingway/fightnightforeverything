// The universal mechanics: the rules EVERY character in the game plays by.
//
// Characters are described in design.js; this is the layer above them — the
// systems the whole cast shares. A round timer, how hard combos scale, whether
// chip damage can finish someone, what defensive escape everyone owns. These
// are the levers that change what a character IS without touching the
// character: give everyone a burst and pressure characters get worse; turn on
// chip KO and every zoner gets better.
//
// Every rule is stored as the plain-language option the designer picked, so
// patch notes read themselves ("chip damage: chip cannot finish → chip can
// finish"). Numbers are derived here, same contract as move descriptors.
//
// This file imports nothing — fight.js, balance.js and the editors all read it.

export const RULE_FAMILIES = [
  {
    key: 'round',
    label: 'Round structure',
    blurb: 'How a round is won when nobody gets knocked out.',
    rules: [
      {
        key: 'timer', label: 'Round timer',
        options: ['30 seconds', '60 seconds', '99 seconds', 'no timer'],
        note: 'a shorter clock means more rounds decided on the health lead',
      },
      {
        key: 'timeoutRule', label: 'When time runs out',
        options: ['health lead wins', 'sudden death', 'draw'],
        note: 'health-lead decisions are where the one-pixel wins come from',
      },
    ],
  },
  {
    key: 'damage',
    label: 'Damage rules',
    blurb: 'How much a single opening is allowed to be worth.',
    rules: [
      {
        key: 'comboScaling', label: 'Combo scaling',
        options: ['none', 'light', 'normal', 'harsh'],
        note: 'how fast later hits in a route stop counting',
      },
      {
        key: 'chipKO', label: 'Chip damage',
        options: ['chip cannot finish', 'chip can finish'],
        note: 'can a blocked attack take the last of someone’s health?',
      },
      {
        key: 'guts', label: 'Guts',
        options: ['none', 'light', 'normal', 'heavy'],
        note: 'damage resistance as health runs low — makes the last sliver stubborn',
      },
      {
        key: 'stun', label: 'Stun / dizzy',
        options: ['off', 'lenient', 'normal', 'quick'],
        note: 'take too much without a breather and you get dizzied — a free punish for them',
      },
      {
        key: 'comeback', label: 'Comeback mechanic',
        options: ['none', 'rage damage', 'install trigger', 'x-factor'],
        note: 'something the losing player gets to turn on',
      },
    ],
  },
  {
    key: 'defense',
    label: 'Universal defense',
    blurb: 'What everyone can do when they are the one being pressured.',
    rules: [
      { key: 'burst', label: 'Burst', options: ['none', 'once per round', 'costs meter'], note: 'escape a combo outright' },
      { key: 'guardCancel', label: 'Guard cancel', options: ['off', 'costs meter'], note: 'hit back out of blockstun' },
      { key: 'pushblock', label: 'Pushblock', options: ['off', 'on'], note: 'shove them out of pressure range' },
      { key: 'throwTech', label: 'Throw teching', options: ['on', 'off'], note: 'break a throw on reaction' },
      { key: 'instantBlock', label: 'Instant block', options: ['off', 'on'], note: 'reward precise blocking' },
    ],
  },
  {
    key: 'offense',
    label: 'Universal offense',
    blurb: 'What everyone can do when they have the turn.',
    rules: [
      { key: 'cancelSystem', label: 'Cancel system', options: ['none', 'roman cancel', 'drive rush'], note: 'spend meter to make anything safe' },
      { key: 'universalOverhead', label: 'Universal overhead', options: ['off', 'on'], note: 'everyone gets a high hit, not just the mix-up cast' },
      { key: 'dashType', label: 'Dashing', options: ['step dash', 'run', 'none'] },
      { key: 'airMovement', label: 'Air movement', options: ['none', 'double jump', 'air dash'] },
      { key: 'guardGauge', label: 'Guard gauge', options: ['off', 'guard crush', 'burnout'], note: 'blocking forever stops being free' },
    ],
  },
]

// The joke lives on its own — see `tryNetcode` below.
export const NETCODE_OPTIONS = ['delay-based', 'rollback']
export const NETCODE_TAUNT = 'not happening, kid.'
const NETCODE_PATIENCE = 3

export function defaultRules() {
  return {
    timer: '99 seconds',
    timeoutRule: 'health lead wins',
    comboScaling: 'normal',
    chipKO: 'chip cannot finish',
    guts: 'light',
    stun: 'normal',
    comeback: 'none',
    burst: 'none',
    guardCancel: 'off',
    pushblock: 'off',
    throwTech: 'on',
    instantBlock: 'off',
    cancelSystem: 'none',
    universalOverhead: 'off',
    dashType: 'step dash',
    airMovement: 'double jump',
    guardGauge: 'off',
    netcode: 'delay-based',
    netcodeAttempts: 0,
  }
}

/** Fill in any rule a save predates, without disturbing the ones it has. */
export function migrateRules(rules) {
  return { ...defaultRules(), ...(rules || {}) }
}

export const ALL_RULE_KEYS = RULE_FAMILIES.flatMap((f) => f.rules.map((r) => r.key))

export function ruleLabel(key) {
  for (const f of RULE_FAMILIES) {
    const r = f.rules.find((x) => x.key === key)
    if (r) return r.label
  }
  return key
}

// ---------- derived numbers ----------

// Later hits in a route count for less. 'none' makes one touch lethal;
// 'harsh' means you need several openings to close a round.
export const COMBO_SCALING_BY_RULE = {
  none: [1, 1, 1, 1, 1, 1],
  light: [1, 0.9, 0.8, 0.7, 0.62, 0.55],
  normal: [1, 0.8, 0.65, 0.5, 0.4, 0.3],
  harsh: [1, 0.68, 0.48, 0.34, 0.24, 0.16],
}

export function comboScalingOf(rules) {
  return COMBO_SCALING_BY_RULE[rules?.comboScaling ?? 'normal'] || COMBO_SCALING_BY_RULE.normal
}

// How much damage is shrugged off once health gets low, and where "low"
// starts. This is what makes a nearly-dead fighter hard to finish.
const GUTS_STRENGTH = { none: 0, light: 0.14, normal: 0.26, heavy: 0.4 }
export const GUTS_THRESHOLD = 0.3 // guts start applying below 30% health

export function gutsFactor(rules, hpFraction) {
  const strength = GUTS_STRENGTH[rules?.guts ?? 'light'] ?? 0
  if (!strength || hpFraction >= GUTS_THRESHOLD) return 1
  // Ramps in smoothly: barely there at 30%, full strength at 0.
  const depth = 1 - hpFraction / GUTS_THRESHOLD
  return 1 - strength * depth
}

const TIMER_SECONDS = { '30 seconds': 30, '60 seconds': 60, '99 seconds': 99, 'no timer': 0 }
export function timerSecondsOf(rules) {
  return TIMER_SECONDS[rules?.timer ?? '99 seconds'] ?? 99
}

/**
 * How often a round should run out of clock. A short timer with a health-lead
 * decision is the single richest source of a one-pixel win, so it earns a real
 * share of endings; 'no timer' or a draw rule means never.
 */
export function timeOverChance(rules) {
  const secs = timerSecondsOf(rules)
  if (!secs) return 0
  if ((rules?.timeoutRule ?? 'health lead wins') === 'draw') return 0
  if (secs <= 30) return 0.3
  if (secs <= 60) return 0.16
  return 0.07
}

// How fast the stun gauge fills. Roughly: 'normal' dizzies after about three
// clean conversions with no break in between, which is what makes it a
// punishment for sitting in pressure rather than a random event.
// Kept close together on purpose: the gauge fills in discrete hits, so widely
// spaced rates just flip between "never" and "every round". These map to
// roughly a four-hit, three-hit and two-hit streak.
const STUN_RATE = { off: 0, lenient: 0.92, normal: 1.0, quick: 1.32 }

export function stunEnabled(rules) {
  return (rules?.stun ?? 'normal') !== 'off'
}

export function stunRateOf(rules) {
  return STUN_RATE[rules?.stun ?? 'normal'] ?? 1
}

export function chipCanKill(rules) {
  return (rules?.chipKO ?? 'chip cannot finish') === 'chip can finish'
}

export function burstEnabled(rules) {
  return (rules?.burst ?? 'none') !== 'none'
}

export function guardCrushEnabled(rules) {
  return (rules?.guardGauge ?? 'off') !== 'off'
}

export function cancelsEnabled(rules) {
  return (rules?.cancelSystem ?? 'none') !== 'none'
}

/**
 * The netcode selector does not work, and that is the feature. Every attempt
 * to pick rollback bounces straight back to delay-based; keep trying and the
 * game finally says something.
 */
export function tryNetcode(rules, choice) {
  if (choice !== 'rollback') return { netcode: choice, netcodeAttempts: rules.netcodeAttempts || 0 }
  return { netcode: 'delay-based', netcodeAttempts: (rules.netcodeAttempts || 0) + 1 }
}

export function netcodeTaunt(rules) {
  return (rules?.netcodeAttempts || 0) >= NETCODE_PATIENCE ? NETCODE_TAUNT : null
}
