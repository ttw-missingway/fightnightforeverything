// Stand-in pixel artwork (CC0 — see src/assets/pixel/CREDITS.md).
// Characters and players get a deterministic sprite from their id, so the
// same fighter always looks the same across screens and sessions.
//
// Lives in components/ (not game/) because import.meta.glob is a Vite
// feature — the game engine must stay runnable in plain node.

import { preferredSkin } from '../game/skins.js'
import { FACE_PALETTES as PALETTE_LIST, DEFAULT_PALETTE } from '../game/palettes.js'

const charFiles = import.meta.glob('../assets/pixel/chars/*.png', { eager: true, import: 'default' })
const faceFiles = import.meta.glob('../assets/pixel/faces/*.png', { eager: true, import: 'default' })
// Photo-derived mugshots: 30 heads x 12 palettes, each a 26px three-value
// image (see docs/FINAL-PUSH.md — sourced from StyleGAN faces, so no real
// person's likeness ships with the game).
const face2Files = import.meta.glob('../assets/pixel/faces2/*/*.png', { eager: true, import: 'default' })
const stageFiles = import.meta.glob('../assets/pixel/stages/*.png', { eager: true, import: 'default' })
// FIGHTER PACKS: drop a folder of PNGs in src/assets/packs/<pack-name>/ and it
// shows up in the sprite picker as its own section. No registry to update —
// the folder name IS the pack, which is the whole point of a pack.
const packFiles = import.meta.glob('../assets/packs/*/*.png', { eager: true, import: 'default' })

const byName = (files) => {
  const map = {}
  for (const [path, url] of Object.entries(files)) {
    map[path.split('/').pop().replace('.png', '')] = url
  }
  return map
}
const CHAR_SPRITES = byName(charFiles) // full-body sprites — the fighting game's cast
const FACE_SPRITES = byName(faceFiles) // the old pixel-art mugshots — legacy spriteKeys only
const ALL_CHAR_NAMES = Object.keys(CHAR_SPRITES).sort()

// ---------- The face pool: photo mugshots, palette-swappable ----------
// FACES2[palette][name] -> url. Names are shared across palettes (p01..p30),
// so switching palette re-skins every portrait in the arcade at once.
const FACES2 = {}
for (const [path, url] of Object.entries(face2Files)) {
  const parts = path.split('/')
  const pal = parts[parts.length - 2]
  const name = parts[parts.length - 1].replace('.png', '')
  FACES2[pal] ??= {}
  FACES2[pal][name] = url
}
// The catalogue, minus anything that isn't actually on disk.
export const FACE_PALETTES = PALETTE_LIST.filter((p) => FACES2[p.key])

/**
 * THE FORCED PALETTE. Null — the default — means every portrait uses its OWN
 * palette, which is what makes a roster read as a room full of people rather
 * than a themed set. Setting it to a specific key overrides everybody at once,
 * for players who want the uniform look.
 *
 * Module-level because art.js can't reach the store (the store imports art
 * consumers), and threading the save through every playerArt call site is
 * fifty edits for a theme. App sets it from save.settings before first render.
 */
let forcedPalette = null
export function setFacePalette(key) {
  forcedPalette = FACES2[key] ? key : null
}

/**
 * Which palette a given person's portrait is in: the global override if one is
 * set, else the palette they carry, else one derived from their id — so a save
 * written before palettes were per-person still opens as a varied room rather
 * than a wall of Game Boy green.
 */
function paletteFor(player, key = null) {
  if (forcedPalette) return forcedPalette
  const own = typeof player === 'object' ? player?.facePalette : null
  if (own && FACES2[own]) return own
  const seed = (typeof player === 'object' ? player?.id : player) ?? key
  const avail = FACE_PALETTES.length ? FACE_PALETTES : PALETTE_LIST
  if (seed == null) return DEFAULT_PALETTE
  return avail[hash(`pal:${seed}`) % avail.length].key
}

const faceSet = (pal) => FACES2[pal] || FACES2[DEFAULT_PALETTE] || {}
const ALL_FACE_NAMES = Object.keys(FACES2[DEFAULT_PALETTE] || {}).sort()

/**
 * THE FACE GUIDE. Every head is tagged with a read gender and the broad
 * ethnic looks it can pass for (many pass for several — tagging is generous
 * on purpose, since a 26px three-value mugshot abstracts a lot).
 *
 * Selection follows the player's `heritage` — the name cluster their identity
 * rolled from — so the ONE roll that named them also faces them: a Kenji
 * Tanaka in Los Angeles reads East Asian on the card, an arcade in Osaka
 * never hands its regulars mismatched mugshots, and a melting-pot country is
 * exactly as mixed as its NAME_MIX says. Non-binary players draw from the
 * whole gender range of their heritage.
 */
const FACE_GUIDE = {
  p01: { g: 'f', eth: ['white'] },
  p02: { g: 'f', eth: ['latin', 'white'] },
  p03: { g: 'm', eth: ['white', 'latin'] },
  p04: { g: 'm', eth: ['white'] },
  p05: { g: 'f', eth: ['white'] },
  p06: { g: 'm', eth: ['easia', 'latin'] },
  p07: { g: 'm', eth: ['white'] },
  p08: { g: 'f', eth: ['white'] },
  p09: { g: 'm', eth: ['mena', 'white', 'latin'] },
  p10: { g: 'f', eth: ['white', 'latin'] },
  p11: { g: 'f', eth: ['white'] },
  p12: { g: 'f', eth: ['sasia'] },
  p13: { g: 'f', eth: ['latin', 'sasia'] },
  p14: { g: 'f', eth: ['white'] },
  p15: { g: 'f', eth: ['white'] },
  p16: { g: 'm', eth: ['white', 'latin', 'mena'] },
  p17: { g: 'f', eth: ['white'] },
  p18: { g: 'm', eth: ['black', 'latin', 'mena'] },
  p19: { g: 'm', eth: ['white'] },
  p20: { g: 'f', eth: ['white', 'latin'] },
  p21: { g: 'f', eth: ['white'] },
  p22: { g: 'f', eth: ['white'] },
  p23: { g: 'm', eth: ['white'] },
  p24: { g: 'm', eth: ['white', 'latin', 'mena'] },
  p25: { g: 'm', eth: ['white'] },
  p26: { g: 'm', eth: ['black'] },
  p27: { g: 'f', eth: ['white'] },
  p28: { g: 'm', eth: ['white'] },
  p29: { g: 'f', eth: ['white'] },
  p30: { g: 'f', eth: ['latin', 'white', 'mena'] },
  // The second batch, curated specifically to fill the pools the first one
  // left thin — TPDN skews white, so East Asian, Black, MENA and South Asian
  // heads had to be fished for.
  p31: { g: 'm', eth: ['easia'] },
  p32: { g: 'm', eth: ['easia'] },
  p33: { g: 'm', eth: ['mena', 'white'] },
  p34: { g: 'f', eth: ['easia'] },
  p35: { g: 'f', eth: ['black'] },
  p36: { g: 'm', eth: ['latin', 'white'] },
  p37: { g: 'm', eth: ['mena', 'latin'] },
  p38: { g: 'f', eth: ['black', 'sasia', 'latin'] },
  p39: { g: 'm', eth: ['latin', 'sasia', 'easia'] },
  p40: { g: 'f', eth: ['easia'] },
  p41: { g: 'f', eth: ['easia'] },
  p42: { g: 'm', eth: ['easia'] },
  p43: { g: 'm', eth: ['sasia', 'black'] },
  p44: { g: 'f', eth: ['easia', 'sasia'] },
  p45: { g: 'f', eth: ['mena', 'latin'] },
}

/**
 * What each NAME CLUSTER looks like, broadly. Homogeneous places list one
 * look; genuinely mixed ones list several; null means anyone (the EN cluster
 * covers the US, the UK, Jamaica and Fiji — there is no one look to have).
 */
const CLUSTER_ETH = {
  JP: ['easia'], KR: ['easia'], CN: ['easia'], VN: ['easia'], TH: ['easia'],
  IN: ['sasia'], ARB: ['mena'], AFR: ['black'],
  CIS: ['white'], PL: ['white'], IT: ['white'], DE: ['white'], SE: ['white'],
  FR: ['white'],
  ES: ['latin'],
  BR: ['latin', 'black', 'white'],
  EN: null,
}

const FACE_NAMES_ALL = Object.keys(FACE_GUIDE)
function facePool(gender, heritage) {
  const want = heritage ? CLUSTER_ETH[heritage] ?? null : null
  const gOk = (t) => (gender === 'man' ? t.g === 'm' : gender === 'woman' ? t.g === 'f' : true)
  let names = FACE_NAMES_ALL.filter((n) => {
    const t = FACE_GUIDE[n]
    return gOk(t) && (!want || t.eth.some((e) => want.includes(e)))
  })
  // Never strand a pick: fall back to the gender pool, then to everyone.
  if (!names.length) names = FACE_NAMES_ALL.filter((n) => gOk(FACE_GUIDE[n]))
  if (!names.length) names = FACE_NAMES_ALL
  return names
}

// ---------- Fighter packs ----------
//
// Pack sprite keys are NAMESPACED (`snes-showdown/sprite-1-3`) while the
// built-in stand-ins stay bare (`gnoll`). Two reasons, and both are about not
// breaking things later: a save written before packs existed keeps resolving
// its bare keys unchanged, and two packs can ship a `ryu.png` each without
// silently stealing each other's characters.

const titleCase = (s) => s.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')

const PACK_SPRITES = {}   // "pack/name" -> url
const PACK_GROUPS = {}    // pack -> { key, name, sprites: [{key, url, label}] }
for (const [path, url] of Object.entries(packFiles)) {
  const parts = path.split('/')
  const pack = parts[parts.length - 2]
  const name = parts[parts.length - 1].replace('.png', '')
  const key = `${pack}/${name}`
  PACK_SPRITES[key] = url
  PACK_GROUPS[pack] ??= { key: pack, name: titleCase(pack), sprites: [] }
  PACK_GROUPS[pack].sprites.push({ key, url, label: name })
}
for (const g of Object.values(PACK_GROUPS)) g.sprites.sort((a, b) => a.label.localeCompare(b.label))

/**
 * Resolve any stored spriteKey to a URL — pack-namespaced or bare — or null if
 * it names art that isn't here anymore (a pack folder that got deleted). Null
 * is deliberate: callers fall back to the deterministic auto pick, so a missing
 * pack degrades to a stand-in rather than a broken image.
 */
function charSpriteUrl(key) {
  if (!key) return null
  return PACK_SPRITES[key] || CHAR_SPRITES[key] || null
}

// Each archetype draws from a themed pool, so a Grappler looks like a
// grappler even as a stand-in.
const CHAR_POOLS = {
  'Shoto': ['human', 'deep_elf_blademaster', 'merfolk_fighter', 'gnoll'],
  'Grappler': ['ogre', 'troll', 'minotaur', 'two_headed_ogre'],
  'Zoner': ['deep_elf_mage', 'orc_sorcerer', 'naga_mage', 'wizard'],
  'Rushdown': ['harpy', 'spriggan', 'big_kobold', 'blink_frog'],
  'Charge': ['yaktaur_captain', 'orc_knight', 'hell_knight', 'vault_guard'],
  'Puppet': ['deep_elf_summoner', 'kobold_demonologist', 'necromancer', 'deep_elf_demonologist'],
  'Setplay': ['deep_elf_conjurer', 'orc_wizard', 'boggart', 'oklob_plant'],
  'Footsies': ['merfolk_impaler', 'deep_elf_soldier', 'orc_warrior', 'dwarf'],
  'Mix-up': ['killer_klown', 'shapeshifter', 'glowing_shapeshifter', 'deformed_elf'],
  'Glass Cannon': ['insubstantial_wisp', 'fire_elemental', 'ball_lightning', 'efreet'],
  'All-Rounder': ['elf', 'halfling', 'demonspawn', 'centaur'],
  'Big Body': ['stone_giant', 'iron_troll', 'frost_giant', 'titan', 'cyclops', 'ettin', 'fire_giant'],
}

// Small stable string hash (djb2) — NOT Math.random: art must never reroll.
function hash(str) {
  let h = 5381
  for (let i = 0; i < String(str).length; i++) h = ((h << 5) + h + String(str).charCodeAt(i)) >>> 0
  return h
}

/** Sprite URL for a game character, themed by archetype. `key` seeds the pick. */
export function charArtFor(key, archetype) {
  const pool = CHAR_POOLS[archetype] || ALL_CHAR_NAMES
  const name = pool[hash(key ?? 'random') % pool.length]
  return CHAR_SPRITES[name] || CHAR_SPRITES[ALL_CHAR_NAMES[0]]
}

// A user-picked spriteKey wins; otherwise the deterministic archetype pick.
// This is the character's OWN look — use it wherever the subject is the
// character (tier list, codex, balance). For a PERSON playing them, see
// `lookArt`.
export function charArt(char) {
  if (!char) return null
  return charSpriteUrl(char.spriteKey) || charArtFor(char.id, char.archetype)
}

/**
 * The sprite a particular player wears on this character — their preferred
 * skin, or the base look if the character has no skins (or the skin's art has
 * gone missing). Use anywhere a person is shown WITH their character.
 */
export function lookArt(char, playerId) {
  if (!char) return null
  const skin = preferredSkin(playerId, char)
  return (skin && charSpriteUrl(skin.spriteKey)) || charArt(char)
}

/** Deterministic player mugshot from any stable key (EVO elites, old events). */
export function playerArtFor(key, gender = null, heritage = null, palette = null) {
  if (key == null) return null
  const pool = facePool(gender, heritage)
  const name = pool.length ? pool[hash(key) % pool.length] : null
  if (!name) return null
  return faceSet(forcedPalette || (palette && FACES2[palette] ? palette : paletteFor(null, key)))[name]
}

/** Mugshot URL for a player. Accepts a player object (honors spriteKey) or a key. */
export function playerArt(player) {
  if (player == null) return null
  if (typeof player === 'object') {
    const pal = paletteFor(player)
    // A hand-picked face from the new pool rides that person's palette.
    if (player.spriteKey && faceSet(pal)[player.spriteKey]) return faceSet(pal)[player.spriteKey]
    if (player.spriteKey && FACE_SPRITES[player.spriteKey]) return FACE_SPRITES[player.spriteKey]
    // Back-compat: spriteKeys picked when players used the full-body catalog.
    if (player.spriteKey && CHAR_SPRITES[player.spriteKey]) return CHAR_SPRITES[player.spriteKey]
    return playerArtFor(player.id, player.gender, player.heritage, pal)
  }
  return playerArtFor(player)
}

// ---------- Stage backgrounds ----------
//
// Each stage backdrop is a stack of transparent parallax layers, listed
// bottom-first. The fight screen composites them with CSS multiple
// background-images (which wants topmost-first — reverse there).

const STAGE_BACKDROPS = [
  { key: 'street', name: 'City Street', layers: ['street'] },
  { key: 'dusk', name: 'Mountain Dusk', layers: ['dusk_bg', 'dusk_far', 'dusk_mountains', 'dusk_trees', 'dusk_fg_trees'] },
  { key: 'jungle', name: 'Sunny Coast', layers: ['jungle_back'] },
  { key: 'space', name: 'Deep Space', layers: ['space_bg', 'space_stars', 'space_planets'] },
]

const stageUrl = (name) => stageFiles[`../assets/pixel/stages/${name}.png`]

/** Picker catalog: [{key, name, layers: [url, ...]}], layers bottom-first. */
export const STAGE_CATALOG = STAGE_BACKDROPS.map((s) => ({
  key: s.key, name: s.name, layers: s.layers.map(stageUrl).filter(Boolean),
}))

export function stageArtFor(key) {
  return STAGE_CATALOG.find((s) => s.key === key) || null
}

// A user-picked bgKey wins; otherwise deterministic from the stage id.
// Works with no stage at all (`key` fallback) so every match gets a backdrop.
export function stageArt(stage, fallbackKey = 'stage') {
  if (stage?.bgKey) {
    const picked = stageArtFor(stage.bgKey)
    if (picked) return picked
  }
  return STAGE_CATALOG[hash(stage?.id ?? fallbackKey) % STAGE_CATALOG.length]
}

// Picker catalogs for the editors: every sprite with its key.
export const CHAR_SPRITE_CATALOG = [
  ...ALL_CHAR_NAMES.map((n) => ({ key: n, url: CHAR_SPRITES[n] })),
  ...Object.values(PACK_GROUPS).flatMap((g) => g.sprites),
]
// A FUNCTION, not a constant: the urls change when the palette does.
export const playerSpriteCatalog = (palette = null) => {
  const pal = forcedPalette || (palette && FACES2[palette] ? palette : DEFAULT_PALETTE)
  return ALL_FACE_NAMES.map((n) => ({ key: n, url: faceSet(pal)[n] }))
}

/**
 * The same catalog, split into sections. The picker uses this so a pack reads
 * as a pack instead of 67 unlabelled thumbnails appended to the stand-ins —
 * with two sources the flat grid stopped being browsable.
 */
export const CHAR_SPRITE_GROUPS = [
  {
    key: 'base',
    name: 'Stand-ins',
    note: 'CC0 pixel art — the default cast',
    sprites: ALL_CHAR_NAMES.map((n) => ({ key: n, url: CHAR_SPRITES[n], label: n })),
  },
  ...Object.values(PACK_GROUPS)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((g) => ({ ...g, note: `${g.sprites.length} sprites` })),
]
