// The world atlas: every country on Earth, weighted by how much of a
// fighting-game scene it actually has.
//
// The design rule (Dylan's): every country is a region. The common ones in
// real life are the common ones here — America, Japan, Korea, France, the UK,
// Brazil, Canada — but the tail carries EVERYTHING, at odds long enough that a
// player from Malawi or Palau cracking top 64 is a genuine event and short
// enough that, over a lineage, it happens. Weights are relative, not
// percentages; the roster samples from the whole table.
//
// Name clusters (see names.js NAME_POOLS) keep the veneer of reality: a
// Japanese elite gets a Japanese name, a Brazilian a Brazilian one. Countries
// without a dedicated pool borrow the nearest one — approximation beats a
// random name from the wrong continent every time.

// [code, name, weight, cluster] — cluster may be a NAME_MIX key or a pool key.
const T = [
  // ---- The powerhouses ----
  ['US', 'the United States', 20, 'US'],
  ['JP', 'Japan', 16, 'JP'],
  ['KR', 'South Korea', 10, 'KR'],
  ['FR', 'France', 7, 'FR'],
  ['BR', 'Brazil', 7, 'BR'],
  ['GB', 'the United Kingdom', 6, 'GB'],
  ['CA', 'Canada', 6, 'CA'],
  // ---- Strong scenes ----
  ['MX', 'Mexico', 4, 'ES'], ['CN', 'China', 4, 'CN'], ['PK', 'Pakistan', 3.5, 'ARB'],
  ['SA', 'Saudi Arabia', 3, 'ARB'], ['TW', 'Taiwan', 3, 'CN'], ['DE', 'Germany', 3, 'DE'],
  ['AU', 'Australia', 3, 'AU'], ['ES', 'Spain', 2.5, 'ES'], ['IT', 'Italy', 2, 'IT'],
  ['NL', 'the Netherlands', 2, 'DE'], ['DO', 'the Dominican Republic', 2, 'ES'],
  ['PH', 'the Philippines', 2, 'PH'], ['RU', 'Russia', 1.8, 'CIS'],
  ['CL', 'Chile', 1.6, 'ES'], ['SG', 'Singapore', 1.6, 'SG'], ['AE', 'the UAE', 1.6, 'ARB'],
  ['SE', 'Sweden', 1.4, 'SE'], ['PL', 'Poland', 1.4, 'PL'], ['HK', 'Hong Kong', 1.2, 'CN'],
  ['IN', 'India', 1.2, 'IN'], ['AR', 'Argentina', 1.2, 'ES'], ['UA', 'Ukraine', 1.2, 'CIS'],
  ['TH', 'Thailand', 1.2, 'TH'], ['VN', 'Vietnam', 1.2, 'VN'], ['TR', 'Turkey', 1, 'ARB'],
  ['MY', 'Malaysia', 1, 'MY'], ['ID', 'Indonesia', 1, 'ID'], ['EG', 'Egypt', 1, 'ARB'],
  ['ZA', 'South Africa', 1, 'AFR'], ['NG', 'Nigeria', 1, 'AFR'], ['CO', 'Colombia', 1, 'ES'],
  ['PE', 'Peru', 1, 'ES'], ['BE', 'Belgium', 1, 'FR'], ['CH', 'Switzerland', 1, 'DE'],
  // ---- Present ----
  ['AT', 'Austria', 0.9, 'DE'], ['NO', 'Norway', 0.9, 'SE'], ['DK', 'Denmark', 0.9, 'SE'],
  ['FI', 'Finland', 0.9, 'SE'], ['IE', 'Ireland', 0.9, 'EN'], ['PT', 'Portugal', 0.9, 'BR'],
  ['NZ', 'New Zealand', 0.9, 'EN'], ['KW', 'Kuwait', 0.9, 'ARB'], ['QA', 'Qatar', 0.8, 'ARB'],
  ['BH', 'Bahrain', 0.8, 'ARB'], ['IL', 'Israel', 0.8, 'ARB'], ['CZ', 'Czechia', 0.8, 'PL'],
  ['JO', 'Jordan', 0.7, 'ARB'], ['GR', 'Greece', 0.7, 'IT'], ['RO', 'Romania', 0.7, 'IT'],
  ['HU', 'Hungary', 0.7, 'PL'], ['MA', 'Morocco', 0.7, 'ARB'], ['CU', 'Cuba', 0.7, 'ES'],
  ['JM', 'Jamaica', 0.7, 'EN'], ['VE', 'Venezuela', 0.7, 'ES'],
  ['TN', 'Tunisia', 0.6, 'ARB'], ['DZ', 'Algeria', 0.6, 'ARB'], ['TT', 'Trinidad and Tobago', 0.6, 'EN'],
  ['EC', 'Ecuador', 0.6, 'ES'], ['UY', 'Uruguay', 0.6, 'ES'], ['CR', 'Costa Rica', 0.6, 'ES'],
  ['PA', 'Panama', 0.6, 'ES'], ['GT', 'Guatemala', 0.6, 'ES'], ['KE', 'Kenya', 0.6, 'AFR'],
  ['GH', 'Ghana', 0.6, 'AFR'], ['RS', 'Serbia', 0.6, 'PL'], ['HR', 'Croatia', 0.55, 'PL'],
  ['SK', 'Slovakia', 0.5, 'PL'], ['BG', 'Bulgaria', 0.5, 'PL'], ['LB', 'Lebanon', 0.5, 'ARB'],
  ['IR', 'Iran', 0.5, 'ARB'], ['KZ', 'Kazakhstan', 0.5, 'CIS'], ['BY', 'Belarus', 0.5, 'CIS'],
  ['BD', 'Bangladesh', 0.5, 'IN'], ['MO', 'Macao', 0.5, 'CN'], ['PY', 'Paraguay', 0.5, 'ES'],
  ['BO', 'Bolivia', 0.5, 'ES'], ['SV', 'El Salvador', 0.5, 'ES'], ['HN', 'Honduras', 0.5, 'ES'],
  ['SI', 'Slovenia', 0.45, 'PL'], ['LT', 'Lithuania', 0.45, 'PL'], ['EE', 'Estonia', 0.45, 'SE'],
  ['GE', 'Georgia', 0.45, 'CIS'], ['CY', 'Cyprus', 0.35, 'EN'], ['LK', 'Sri Lanka', 0.4, 'IN'],
  ['IQ', 'Iraq', 0.4, 'ARB'], ['OM', 'Oman', 0.4, 'ARB'], ['ET', 'Ethiopia', 0.4, 'AFR'],
  ['LV', 'Latvia', 0.4, 'PL'], ['AM', 'Armenia', 0.4, 'CIS'], ['AZ', 'Azerbaijan', 0.4, 'CIS'],
  ['NI', 'Nicaragua', 0.4, 'ES'], ['BA', 'Bosnia and Herzegovina', 0.4, 'PL'],
  ['SN', 'Senegal', 0.35, 'AFR'], ['CI', 'Ivory Coast', 0.35, 'AFR'], ['CM', 'Cameroon', 0.35, 'AFR'],
  ['TZ', 'Tanzania', 0.35, 'AFR'], ['UG', 'Uganda', 0.35, 'AFR'], ['MK', 'North Macedonia', 0.35, 'PL'],
  ['AL', 'Albania', 0.35, 'PL'], ['IS', 'Iceland', 0.35, 'SE'], ['HT', 'Haiti', 0.35, 'FR'],
  ['UZ', 'Uzbekistan', 0.35, 'CIS'], ['MN', 'Mongolia', 0.3, 'CN'], ['NP', 'Nepal', 0.3, 'IN'],
  ['MM', 'Myanmar', 0.3, 'TH'], ['KH', 'Cambodia', 0.3, 'VN'], ['SY', 'Syria', 0.3, 'ARB'],
  ['ZM', 'Zambia', 0.3, 'AFR'], ['ZW', 'Zimbabwe', 0.3, 'AFR'], ['CD', 'DR Congo', 0.3, 'AFR'],
  ['AO', 'Angola', 0.3, 'AFR'], ['ME', 'Montenegro', 0.3, 'PL'], ['XK', 'Kosovo', 0.3, 'PL'],
  ['MD', 'Moldova', 0.3, 'CIS'], ['LU', 'Luxembourg', 0.3, 'FR'], ['MT', 'Malta', 0.3, 'IT'],
  // ---- The long tail: everyone else on Earth ----
  ['LA', 'Laos', 0.2, 'VN'], ['BN', 'Brunei', 0.2, 'MY'], ['YE', 'Yemen', 0.2, 'ARB'],
  ['AF', 'Afghanistan', 0.2, 'ARB'], ['KG', 'Kyrgyzstan', 0.2, 'CIS'], ['TJ', 'Tajikistan', 0.15, 'CIS'],
  ['TM', 'Turkmenistan', 0.1, 'CIS'], ['KP', 'North Korea', 0.05, 'KR'],
  ['MW', 'Malawi', 0.07, 'AFR'], ['MZ', 'Mozambique', 0.15, 'AFR'], ['BW', 'Botswana', 0.15, 'AFR'],
  ['NA', 'Namibia', 0.15, 'AFR'], ['RW', 'Rwanda', 0.1, 'AFR'], ['BI', 'Burundi', 0.07, 'AFR'],
  ['ML', 'Mali', 0.1, 'AFR'], ['BF', 'Burkina Faso', 0.1, 'AFR'], ['NE', 'Niger', 0.07, 'AFR'],
  ['TD', 'Chad', 0.07, 'AFR'], ['SD', 'Sudan', 0.15, 'ARB'], ['SS', 'South Sudan', 0.07, 'AFR'],
  ['SL', 'Sierra Leone', 0.07, 'AFR'], ['LR', 'Liberia', 0.07, 'AFR'], ['GM', 'the Gambia', 0.07, 'AFR'],
  ['GN', 'Guinea', 0.07, 'AFR'], ['GW', 'Guinea-Bissau', 0.05, 'AFR'], ['BJ', 'Benin', 0.1, 'AFR'],
  ['TG', 'Togo', 0.07, 'AFR'], ['GA', 'Gabon', 0.1, 'AFR'], ['GQ', 'Equatorial Guinea', 0.05, 'AFR'],
  ['CF', 'the Central African Republic', 0.05, 'AFR'], ['CG', 'Congo', 0.1, 'AFR'],
  ['ER', 'Eritrea', 0.05, 'AFR'], ['DJ', 'Djibouti', 0.05, 'AFR'], ['SO', 'Somalia', 0.1, 'ARB'],
  ['LS', 'Lesotho', 0.07, 'AFR'], ['SZ', 'Eswatini', 0.07, 'AFR'], ['MG', 'Madagascar', 0.1, 'AFR'],
  ['MU', 'Mauritius', 0.15, 'AFR'], ['SC', 'the Seychelles', 0.07, 'AFR'], ['CV', 'Cape Verde', 0.1, 'AFR'],
  ['KM', 'the Comoros', 0.05, 'AFR'], ['ST', 'São Tomé and Príncipe', 0.05, 'AFR'],
  ['MR', 'Mauritania', 0.07, 'ARB'], ['LY', 'Libya', 0.15, 'ARB'], ['PS', 'Palestine', 0.2, 'ARB'],
  ['BT', 'Bhutan', 0.07, 'IN'], ['MV', 'the Maldives', 0.1, 'IN'], ['TL', 'Timor-Leste', 0.07, 'VN'],
  ['FJ', 'Fiji', 0.1, 'EN'], ['PG', 'Papua New Guinea', 0.07, 'EN'], ['SB', 'the Solomon Islands', 0.05, 'EN'],
  ['VU', 'Vanuatu', 0.05, 'EN'], ['WS', 'Samoa', 0.07, 'EN'], ['TO', 'Tonga', 0.07, 'EN'],
  ['TV', 'Tuvalu', 0.05, 'EN'], ['KI', 'Kiribati', 0.05, 'EN'], ['NR', 'Nauru', 0.05, 'EN'],
  ['PW', 'Palau', 0.05, 'EN'], ['MH', 'the Marshall Islands', 0.05, 'EN'], ['FM', 'Micronesia', 0.05, 'EN'],
  ['BZ', 'Belize', 0.1, 'ES'], ['GY', 'Guyana', 0.1, 'EN'], ['SR', 'Suriname', 0.07, 'EN'],
  ['BS', 'the Bahamas', 0.15, 'EN'], ['BB', 'Barbados', 0.15, 'EN'], ['GD', 'Grenada', 0.07, 'EN'],
  ['LC', 'Saint Lucia', 0.07, 'EN'], ['VC', 'Saint Vincent', 0.05, 'EN'], ['AG', 'Antigua', 0.07, 'EN'],
  ['KN', 'Saint Kitts and Nevis', 0.05, 'EN'], ['DM', 'Dominica', 0.05, 'EN'],
  ['AD', 'Andorra', 0.05, 'ES'], ['MC', 'Monaco', 0.05, 'FR'], ['SM', 'San Marino', 0.05, 'IT'],
  ['LI', 'Liechtenstein', 0.05, 'DE'], ['VA', 'Vatican City', 0.01, 'IT'],
]

export const WORLD_COUNTRIES = T.map(([code, name, weight, cluster]) => ({ code, name, weight, cluster }))
const BY_CODE = new Map(WORLD_COUNTRIES.map((c) => [c.code, c]))
const TOTAL_WEIGHT = WORLD_COUNTRIES.reduce((s, c) => s + c.weight, 0)

export const countryName = (code) => BY_CODE.get(code)?.name || code
export const countryCluster = (code) => BY_CODE.get(code)?.cluster || 'US'

/** Weighted roll over the whole planet. `rng` defaults to Math.random-shaped. */
export function rollCountry(rng = Math.random) {
  let r = rng() * TOTAL_WEIGHT
  for (const c of WORLD_COUNTRIES) {
    r -= c.weight
    if (r <= 0) return c.code
  }
  return 'US'
}

/**
 * Old saves carry the pre-atlas region keys. Each maps to a weighted roll
 * within what the old bloc actually meant, so a migrated CIS elite becomes
 * Russian more often than Moldovan.
 */
const LEGACY_SPLIT = {
  'US-East': [['US', 1]], 'US-West': [['US', 1]],
  EU: [['FR', 3], ['GB', 3], ['DE', 2], ['ES', 2], ['IT', 1.5], ['NL', 1], ['SE', 1], ['PL', 1]],
  CIS: [['RU', 5], ['UA', 2], ['KZ', 1], ['BY', 1]],
  AF: [['ZA', 2], ['NG', 2], ['KE', 1], ['GH', 1], ['EG', 1]],
  ME: [['SA', 3], ['AE', 2], ['KW', 1], ['BH', 1], ['QA', 1]],
}
export function migrateRegion(region, rng = Math.random, { legacy = false } = {}) {
  // ORDER MATTERS when the elite is from an old save: two legacy bloc keys
  // collide with real ISO codes — AF was "Africa" then and is Afghanistan
  // now, ME was "the Middle East" and is Montenegro. An old elite carrying
  // AF means the bloc; a new one means the country. The caller says which
  // era the row is from (old rows lack the gender field).
  const split = LEGACY_SPLIT[region]
  if (split && (legacy || !BY_CODE.has(region))) {
    const total = split.reduce((s, [, w]) => s + w, 0)
    let r = rng() * total
    for (const [code, w] of split) { r -= w; if (r <= 0) return code }
    return split[0][0]
  }
  return BY_CODE.has(region) ? region : 'US'
}
