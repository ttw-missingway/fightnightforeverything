// Stand-in pixel artwork (CC0 — see src/assets/pixel/CREDITS.md).
// Characters and players get a deterministic sprite from their id, so the
// same fighter always looks the same across screens and sessions.
//
// Lives in components/ (not game/) because import.meta.glob is a Vite
// feature — the game engine must stay runnable in plain node.

const charFiles = import.meta.glob('../assets/pixel/chars/*.png', { eager: true, import: 'default' })
const faceFiles = import.meta.glob('../assets/pixel/faces/*.png', { eager: true, import: 'default' })
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
const FACE_SPRITES = byName(faceFiles) // GB-camera-style mugshots — the arcade regulars
const ALL_CHAR_NAMES = Object.keys(CHAR_SPRITES).sort()
const ALL_FACE_NAMES = Object.keys(FACE_SPRITES).sort()

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
export function charArt(char) {
  if (!char) return null
  return charSpriteUrl(char.spriteKey) || charArtFor(char.id, char.archetype)
}

/** Deterministic player mugshot from any stable key (EVO elites, old events). */
export function playerArtFor(key) {
  if (key == null) return null
  const name = ALL_FACE_NAMES[hash(key) % ALL_FACE_NAMES.length]
  return FACE_SPRITES[name]
}

/** Mugshot URL for a player. Accepts a player object (honors spriteKey) or a key. */
export function playerArt(player) {
  if (player == null) return null
  if (typeof player === 'object') {
    if (player.spriteKey && FACE_SPRITES[player.spriteKey]) return FACE_SPRITES[player.spriteKey]
    // Back-compat: spriteKeys picked when players used the full-body catalog.
    if (player.spriteKey && CHAR_SPRITES[player.spriteKey]) return CHAR_SPRITES[player.spriteKey]
    return playerArtFor(player.id)
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
export const PLAYER_SPRITE_CATALOG = ALL_FACE_NAMES.map((n) => ({ key: n, url: FACE_SPRITES[n] }))

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
