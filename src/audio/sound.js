// SOUND — REVISION §5-P7. "The most-requested item on the list, and every
// landmark this revision builds is weaker without it."
//
// SYNTHESIZED, not sampled. Three reasons, in order of how much they matter:
//
//  1. The cues can be PROCEDURAL. A hit scales with the damage that caused it,
//     a breakthrough arpeggio is built from the stat that broke through, and
//     EVO does not sound like a Tuesday weekly. A sample library gives you one
//     recording of a punch; an oscillator gives you the punch that actually
//     landed. Everything this revision built is about consequences being
//     legible, and that argument does not stop at the speaker.
//  2. It is a fighting game in an arcade. Square waves and filtered noise are
//     the native voice of the thing being simulated, not a compromise.
//  3. Zero bytes in the bundle, zero licensing, zero loading, and it works
//     offline forever.
//
// THE RULES THIS FILE OBEYS, both load-bearing:
//
//  · **Sound never touches the save and never draws from the seeded rng.** It
//    reads state and makes noise. Determinism is the property the entire
//    balance harness rests on (see rng.js and the two leaks P3 and P4 found),
//    and a presentation layer must not be able to break it. Any randomness in
//    here uses Math.random deliberately, because it must NOT be reproducible
//    or accounted for.
//  · **Sound never throws.** Every entry point is wrapped. A browser with no
//    Web Audio, a suspended context, an autoplay policy we guessed wrong
//    about — none of it may ever interrupt a game that is otherwise fine.

const STORAGE_KEY = 'fightnight:sound'

let ctx = null
let master = null
let settings = { on: true, volume: 0.5 }

// ---------- settings (a DEVICE preference, not world state) ----------
//
// Deliberately localStorage rather than the save: how loud someone's laptop
// is has nothing to do with their arcade, and it must not ride along inside
// an exported world and change the volume on whoever imports it.

export function loadSoundSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) settings = { ...settings, ...JSON.parse(raw) }
  } catch { /* a corrupt preference is not worth a crash */ }
  return { ...settings }
}

export function getSoundSettings() {
  return { ...settings }
}

export function setSoundSettings(next) {
  settings = { ...settings, ...next }
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(settings)) } catch { /* private mode */ }
  if (master && ctx) master.gain.setTargetAtTime(gainNow(), ctx.currentTime, 0.01)
  return { ...settings }
}

const gainNow = () => (settings.on ? Math.max(0, Math.min(1, settings.volume)) * 0.5 : 0)

// ---------- the context ----------
//
// Browsers refuse to start audio until the user has interacted with the page,
// so the context is created lazily on the first cue and resumed on every
// gesture until it takes. Calling this before a gesture is harmless — it just
// stays suspended and every cue silently does nothing.

function audio() {
  if (ctx) return ctx
  try {
    const AC = window.AudioContext || window.webkitAudioContext
    if (!AC) return null
    ctx = new AC()
    master = ctx.createGain()
    master.gain.value = gainNow()
    master.connect(ctx.destination)
  } catch {
    ctx = null
  }
  return ctx
}

/** Call from any real user gesture. Safe to call as often as you like. */
export function unlockAudio() {
  const c = audio()
  if (c && c.state === 'suspended') c.resume().catch(() => {})
}

// ---------- primitives ----------

const NOTE = { C: 261.63, D: 293.66, E: 329.63, F: 349.23, G: 392.0, A: 440.0, B: 493.88 }
/** Scientific-pitch helper: n('E', 5) is E in the fifth octave. */
const n = (name, octave = 4) => NOTE[name] * Math.pow(2, octave - 4)

/**
 * One voice: an oscillator with an attack/decay envelope. `slide` bends the
 * pitch over the life of the note, which is most of what makes a synthesized
 * cue read as an event rather than a beep.
 */
function tone(c, { freq, dur = 0.12, type = 'square', gain = 0.3, delay = 0, slide = 0, detune = 0 }) {
  const t0 = c.currentTime + delay
  const osc = c.createOscillator()
  const env = c.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, t0)
  if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), t0 + dur)
  if (detune) osc.detune.setValueAtTime(detune, t0)
  // A tiny attack instead of an instant one: a hard edge on a square wave
  // clicks, and a click on every note is what makes chiptune sound cheap.
  env.gain.setValueAtTime(0.0001, t0)
  env.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t0 + 0.008)
  env.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
  osc.connect(env).connect(master)
  osc.start(t0)
  osc.stop(t0 + dur + 0.02)
}

/** Filtered noise — impacts, crowds, and anything with grit in it. */
function noise(c, { dur = 0.12, gain = 0.25, delay = 0, freq = 1200, q = 1, type = 'bandpass', sweepTo = 0 }) {
  const t0 = c.currentTime + delay
  const frames = Math.max(1, Math.floor(c.sampleRate * dur))
  const buf = c.createBuffer(1, frames, c.sampleRate)
  const data = buf.getChannelData(0)
  // Math.random ON PURPOSE — see the header. Noise must never touch the
  // seeded stream the simulation replays from.
  for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1
  const src = c.createBufferSource()
  src.buffer = buf
  const filter = c.createBiquadFilter()
  filter.type = type
  filter.frequency.setValueAtTime(freq, t0)
  if (sweepTo) filter.frequency.exponentialRampToValueAtTime(Math.max(40, sweepTo), t0 + dur)
  filter.Q.value = q
  const env = c.createGain()
  env.gain.setValueAtTime(gain, t0)
  env.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
  src.connect(filter).connect(env).connect(master)
  src.start(t0)
  src.stop(t0 + dur + 0.02)
}

/** A run of notes. The workhorse behind every landmark cue. */
function arp(c, freqs, { step = 0.075, dur = 0.13, type = 'square', gain = 0.26, delay = 0 } = {}) {
  freqs.forEach((f, i) => tone(c, { freq: f, dur, type, gain, delay: delay + i * step }))
}

// ---------- the cues ----------
//
// Each is a function so it can take a shape argument (how hard the hit was,
// how big the title is). The table is the enumeration §5-P7 asks for: every
// landmark this revision built has a voice here.

const CUES = {
  // --- the room, the day, the chrome ---
  click: (c) => tone(c, { freq: n('E', 5), dur: 0.045, type: 'square', gain: 0.1, slide: 0.9 }),
  nav: (c) => tone(c, { freq: n('A', 5), dur: 0.05, type: 'triangle', gain: 0.09 }),
  toast: (c) => arp(c, [n('E', 5), n('A', 5)], { step: 0.06, dur: 0.08, type: 'triangle', gain: 0.12 }),
  dismiss: (c) => tone(c, { freq: n('C', 5), dur: 0.05, type: 'triangle', gain: 0.07, slide: 0.75 }),
  dayOpen: (c) => arp(c, [n('C', 4), n('G', 4), n('C', 5)], { step: 0.085, dur: 0.16, type: 'triangle', gain: 0.16 }),
  dayClose: (c) => arp(c, [n('G', 4), n('E', 4), n('C', 4)], { step: 0.1, dur: 0.2, type: 'sine', gain: 0.14 }),

  // --- the fight ---
  // Impact scales with the damage that landed: `power` is 0..1, and it moves
  // the body of the hit as well as its volume, so a chip hit and a super do
  // not differ only in loudness.
  hit: (c, power = 0.4) => {
    const p = Math.max(0.05, Math.min(1, power))
    noise(c, { dur: 0.05 + p * 0.07, gain: 0.12 + p * 0.22, freq: 900 + p * 1400, sweepTo: 220, q: 0.8 })
    tone(c, { freq: 150 - p * 40, dur: 0.06 + p * 0.06, type: 'square', gain: 0.1 + p * 0.16, slide: 0.5 })
  },
  block: (c) => noise(c, { dur: 0.05, gain: 0.14, freq: 2600, q: 3, sweepTo: 1400 }),
  ko: (c) => {
    noise(c, { dur: 0.5, gain: 0.4, freq: 1800, sweepTo: 90, q: 0.6 })
    tone(c, { freq: n('A', 3), dur: 0.5, type: 'sawtooth', gain: 0.3, slide: 0.35 })
    arp(c, [n('A', 4), n('E', 4), n('A', 3)], { step: 0.11, dur: 0.3, type: 'square', gain: 0.2, delay: 0.06 })
  },
  roundEnd: (c) => arp(c, [n('G', 4), n('C', 5)], { step: 0.09, dur: 0.18, type: 'square', gain: 0.2 }),

  // --- THE LANDMARKS ---

  // The verge: something is coming and it is yours to answer. Deliberately
  // unresolved — it asks a question rather than announcing a result.
  verge: (c) => arp(c, [n('C', 5), n('E', 5), n('G', 5), n('B', 5)],
    { step: 0.085, dur: 0.22, type: 'triangle', gain: 0.16 }),

  // The breakthrough — the signature sound of the whole game. A rising major
  // arpeggio that RESOLVES, because §1 is about a person becoming more than
  // they were and the ear should be told so.
  breakthrough: (c) => {
    arp(c, [n('C', 5), n('E', 5), n('G', 5), n('C', 6)], { step: 0.075, dur: 0.26, type: 'square', gain: 0.22 })
    arp(c, [n('C', 4), n('C', 5)], { step: 0.3, dur: 0.5, type: 'triangle', gain: 0.14, delay: 0.05 })
  },

  // "A name off the world list." The impossible moment (metric 2) — the one
  // the whole calendar exists to make possible, so it gets fanfare.
  eliteWin: (c) => {
    arp(c, [n('G', 4), n('C', 5), n('E', 5), n('G', 5), n('C', 6)],
      { step: 0.07, dur: 0.3, type: 'square', gain: 0.24 })
    noise(c, { dur: 0.7, gain: 0.1, freq: 5000, q: 0.5, delay: 0.1 }) // the room reacting
  },

  title: (c) => {
    arp(c, [n('C', 5), n('G', 5), n('C', 6)], { step: 0.1, dur: 0.34, type: 'square', gain: 0.26 })
    arp(c, [n('E', 5), n('B', 5)], { step: 0.1, dur: 0.34, type: 'triangle', gain: 0.16, delay: 0.05 })
  },

  // EVO. The biggest thing that can happen, and it should be unmistakably
  // larger than a title — longer, wider, with the crowd in it.
  evo: (c) => {
    arp(c, [n('C', 4), n('E', 4), n('G', 4), n('C', 5), n('E', 5), n('G', 5), n('C', 6)],
      { step: 0.095, dur: 0.42, type: 'square', gain: 0.26 })
    arp(c, [n('C', 3), n('G', 3), n('C', 4)], { step: 0.28, dur: 0.8, type: 'sawtooth', gain: 0.12, delay: 0.1 })
    noise(c, { dur: 1.6, gain: 0.13, freq: 4200, q: 0.4, delay: 0.2 })
  },

  // The sequel (P5). Not a victory and not a defeat — a transformation. Falls
  // away and then climbs back out somewhere new, which is exactly what the
  // era transition does to a save.
  era: (c) => {
    arp(c, [n('C', 5), n('A', 4), n('F', 4), n('C', 4)], { step: 0.13, dur: 0.34, type: 'triangle', gain: 0.18 })
    arp(c, [n('D', 4), n('G', 4), n('B', 4), n('D', 5), n('G', 5)],
      { step: 0.1, dur: 0.36, type: 'square', gain: 0.22, delay: 0.6 })
  },

  // A prodigy walks in. Bright, small, and hopeful — the sound of somebody
  // nobody has noticed yet.
  prodigy: (c) => arp(c, [n('E', 5), n('G', 5), n('B', 5), n('E', 6)],
    { step: 0.065, dur: 0.2, type: 'triangle', gain: 0.2 }),

  // The coaching handoff — two voices, the second answering the first.
  handoff: (c) => {
    arp(c, [n('C', 4), n('E', 4), n('G', 4)], { step: 0.08, dur: 0.24, type: 'triangle', gain: 0.16 })
    arp(c, [n('G', 4), n('B', 4), n('D', 5)], { step: 0.08, dur: 0.24, type: 'square', gain: 0.16, delay: 0.26 })
  },

  // Veteran-tier output: they are not getting better, they are making everyone
  // else better. Warm, low, settled.
  veteran: (c) => arp(c, [n('F', 4), n('A', 4), n('C', 5), n('F', 5)],
    { step: 0.11, dur: 0.4, type: 'sine', gain: 0.2 }),

  // A career ending. Descending, unhurried, and not sad — they got here.
  retire: (c) => arp(c, [n('C', 5), n('A', 4), n('F', 4), n('C', 4)],
    { step: 0.19, dur: 0.55, type: 'sine', gain: 0.18 }),

  // --- trouble ---
  danger: (c) => arp(c, [n('E', 4), n('C', 4)], { step: 0.14, dur: 0.26, type: 'sawtooth', gain: 0.16 }),
  crisis: (c) => {
    arp(c, [n('F', 4), n('E', 4), n('D', 4), n('C', 4)], { step: 0.13, dur: 0.3, type: 'sawtooth', gain: 0.2 })
    noise(c, { dur: 0.5, gain: 0.1, freq: 400, q: 1.2, sweepTo: 120, delay: 0.1 })
  },
  gameOver: (c) => {
    arp(c, [n('C', 4), n('B', 3), n('A', 3), n('G', 3), n('C', 3)],
      { step: 0.26, dur: 0.7, type: 'sawtooth', gain: 0.22 })
    noise(c, { dur: 2, gain: 0.09, freq: 700, q: 0.5, sweepTo: 80, delay: 0.3 })
  },
}

/**
 * Fire a cue by name. Never throws, never blocks, and does nothing at all
 * when sound is off or the context has not been unlocked by a gesture yet.
 */
export function play(name, shape) {
  if (!settings.on) return
  try {
    const c = audio()
    if (!c || c.state !== 'running') return
    CUES[name]?.(c, shape)
  } catch { /* audio is never worth interrupting a game for */ }
}

export const CUE_NAMES = Object.keys(CUES)
