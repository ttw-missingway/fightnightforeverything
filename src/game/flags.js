// Flags, for the one place in the game where somebody's nationality matters:
// the world rankings and the tournament that decides them.
//
// Every two-letter ISO code maps onto a flag emoji arithmetically — the
// regional-indicator block sits a fixed distance above ASCII 'A' — so the only
// thing that needs a lookup table is turning what a player TYPED into the
// arcade's country field into a code.

const OFFSET = 0x1f1e6 - 'A'.charCodeAt(0)

/** 'BR' → 🇧🇷. Anything that isn't two letters comes back blank. */
export function flagOf(code) {
  const c = String(code || '').trim().toUpperCase()
  if (!/^[A-Z]{2}$/.test(c)) return ''
  return String.fromCodePoint(...[...c].map((ch) => ch.charCodeAt(0) + OFFSET))
}

/**
 * Elite regions are competitive scenes rather than countries — the US fields
 * two of them, and "EU" is a region people genuinely say.
 */
const REGION_CODE = {
  'US-East': 'US', 'US-West': 'US', EU: 'EU', JP: 'JP', KR: 'KR',
  BR: 'BR', MX: 'MX', SG: 'SG', CA: 'CA', AU: 'AU', CN: 'CN', IN: 'IN',
  // Blocs get a representative flag, because emoji has no flag for a bloc:
  // the CIS scene flies Russian colors, Africa flies South Africa's (its
  // biggest FGC hub), the Middle East flies Saudi's (the region's majors).
  CIS: 'RU', AF: 'ZA', ME: 'SA',
}

export const regionFlag = (region) => flagOf(REGION_CODE[region] || region)

// What people actually type. Names, common short forms, and codes.
const COUNTRY_CODE = {
  usa: 'US', us: 'US', 'united states': 'US', 'united states of america': 'US', america: 'US',
  uk: 'GB', gb: 'GB', 'united kingdom': 'GB', britain: 'GB', 'great britain': 'GB', england: 'GB',
  scotland: 'GB', wales: 'GB', 'northern ireland': 'GB',
  japan: 'JP', nippon: 'JP', 'south korea': 'KR', korea: 'KR', 'republic of korea': 'KR',
  brazil: 'BR', brasil: 'BR', mexico: 'MX', méxico: 'MX', singapore: 'SG',
  canada: 'CA', australia: 'AU', 'new zealand': 'NZ', france: 'FR', germany: 'DE',
  deutschland: 'DE', spain: 'ES', españa: 'ES', italy: 'IT', italia: 'IT',
  portugal: 'PT', netherlands: 'NL', holland: 'NL', belgium: 'BE', sweden: 'SE',
  norway: 'NO', denmark: 'DK', finland: 'FI', poland: 'PL', ireland: 'IE',
  china: 'CN', taiwan: 'TW', 'hong kong': 'HK', india: 'IN', philippines: 'PH',
  thailand: 'TH', vietnam: 'VN', malaysia: 'MY', indonesia: 'ID',
  chile: 'CL', argentina: 'AR', colombia: 'CO', peru: 'PE',
  'south africa': 'ZA', nigeria: 'NG', egypt: 'EG', morocco: 'MA', kenya: 'KE',
  turkey: 'TR', greece: 'GR', switzerland: 'CH', austria: 'AT', czechia: 'CZ',
  'czech republic': 'CZ', hungary: 'HU', romania: 'RO', ukraine: 'UA', russia: 'RU',
  israel: 'IL', 'saudi arabia': 'SA', uae: 'AE', 'united arab emirates': 'AE',
}

/** Every spelling the country field will recognise — feeds the autocomplete. */
export const KNOWN_COUNTRIES = [...new Set(Object.keys(COUNTRY_CODE))]
  .map((k) => k.replace(/\b\w/g, (c) => c.toUpperCase()))
  .sort()

/**
 * A free-text country field → a flag. Falls back to a plain white flag rather
 * than to nothing, so an arcade whose owner typed something unrecognisable
 * still gets a marker instead of a hole in the layout.
 */
export function countryFlag(country) {
  const raw = String(country || '').trim()
  if (!raw) return '🏳️'
  const direct = flagOf(raw)
  if (direct) return direct
  const code = COUNTRY_CODE[raw.toLowerCase()]
  return code ? flagOf(code) : '🏳️'
}

/** Your arcade's flag — the one your whole cast competes under. */
export const arcadeFlag = (save) => countryFlag(save?.arcade?.location?.country)

/** The two-letter code a typed country resolves to, or null. Exported for the
 * name generator: an arcade in Japan should produce Japanese walk-ins. */
export function countryCode(country) {
  const raw = String(country || '').trim()
  if (!raw) return null
  const hit = COUNTRY_CODE[raw.toLowerCase()]
  if (hit) return hit
  return /^[A-Za-z]{2}$/.test(raw) ? raw.toUpperCase() : null
}

/**
 * Which NAME CLUSTER a country's walk-ins draw from (see names.js). Countries
 * without a dedicated pool borrow the nearest one; unknown countries get the
 * diverse-America treatment rather than a single ethnicity guessed wrong.
 */
const CODE_CLUSTER = {
  JP: 'JP', KR: 'KR', CN: 'CN', TW: 'CN', HK: 'CN', SG: 'SG',
  IN: 'IN', SA: 'ME', AE: 'ME', IL: 'ME', TR: 'ME', EG: 'ME', MA: 'ME',
  ZA: 'AF', NG: 'AF', KE: 'AF', RU: 'CIS', UA: 'CIS',
  BR: 'BR', PT: 'BR', MX: 'ES', ES: 'ES', CL: 'ES', AR: 'ES', CO: 'ES', PE: 'ES',
  FR: 'FR', BE: 'FR', DE: 'DE', AT: 'DE', CH: 'DE',
  SE: 'SE', NO: 'SE', DK: 'SE', FI: 'SE', IS: 'SE',
  GB: 'EN', IE: 'EN', US: 'EN', CA: 'CA', AU: 'AU', NZ: 'AU',
  IT: 'EU', NL: 'EU', PL: 'EU', CZ: 'EU', HU: 'EU', RO: 'EU', GR: 'EU',
}
export function countryNameRegion(country) {
  const code = countryCode(country)
  const cluster = code && CODE_CLUSTER[code]
  // Clusters that are themselves regions (CA/AU/SG/EU…) pass through to the
  // REGION_NAME_MIX table; raw pools (JP/EN/…) are handled there too.
  return cluster || 'US-East'
}
