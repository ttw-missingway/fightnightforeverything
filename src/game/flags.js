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
  BR: 'BR', MX: 'MX', SG: 'SG',
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
