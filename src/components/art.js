// Stand-in pixel artwork (CC0 — see src/assets/pixel/CREDITS.md).
// Characters and players get a deterministic sprite from their id, so the
// same fighter always looks the same across screens and sessions.
//
// Lives in components/ (not game/) because import.meta.glob is a Vite
// feature — the game engine must stay runnable in plain node.

const charFiles = import.meta.glob('../assets/pixel/chars/*.png', { eager: true, import: 'default' })
const faceFiles = import.meta.glob('../assets/pixel/faces/*.png', { eager: true, import: 'default' })
const stageFiles = import.meta.glob('../assets/pixel/stages/*.png', { eager: true, import: 'default' })

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
  if (char.spriteKey && CHAR_SPRITES[char.spriteKey]) return CHAR_SPRITES[char.spriteKey]
  return charArtFor(char.id, char.archetype)
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
export const CHAR_SPRITE_CATALOG = ALL_CHAR_NAMES.map((n) => ({ key: n, url: CHAR_SPRITES[n] }))
export const PLAYER_SPRITE_CATALOG = ALL_FACE_NAMES.map((n) => ({ key: n, url: FACE_SPRITES[n] }))
