// NO DOMINANT STRATEGY. Three genuinely different ways to run the place,
// same difficulty, same horizon. The bar is VIABILITY: one being best is fine,
// a gap that makes the others feel like self-kneecapping is not.
import { makeRun, playRun, DEFAULT_POLICY, mean } from './policy.mjs'
const N = Number(process.argv[2] || 12), DAYS = Number(process.argv[3] || 1008), DIFF = process.argv[4] || 'normal'

// Prices are costPerPlay = tokenPrice × playTokens since the 2026-07-28
// overhaul. The old specs predate it: economy- and competition-first charged
// $2.00 a match, which now measures as a closed arcade (100% deaths), and
// community-first hardcoded a $1 token because a cheap token at several
// tokens a match was unbuildable. Each style now states its price in the
// terms the game judges.
// Every number here earned its place in the 2026-07-28 right-sizing lab
// (n=16, 336d, normal). What the lab killed: dear food ($4 lines measured
// 56–63% dead vs 6% at $3 — the wallet model closes the counter to poor
// players), a third plain cabinet (seats cap at 6/night; it never pays its
// upkeep), a third employee + manager on a ~17-head room, and $2 bargain food
// (56% dead — the counter can't fund cheap play at $2 a serving). Extraction
// lives in SPREAD (four stocked lines), the marquee monthly, and earned
// attractions — not in gouging the door or papering a wall with cabinets.
const STYLES = {
  'economy-first': { ...DEFAULT_POLICY,
    // The arcade is the business. An honest ticket, a well-spread counter, a
    // tight crew, attractions as the lineage earns them, and one marquee
    // monthly. BENEFIT: banks the most per year-one dollar of risk.
    // SACRIFICE: no weekly scene — skill and EVO qualification lag.
    // RISK: relevance — a room nobody talks about fades (interest pit).
    tokenPrice: 0.5, playTokens: 3, foodPrice: 3, foods: 4, cabinets: 2, maxEmployees: 2, manager: false,
    attractions: true,
    ads: ['flyers', 'radio'], weekly: 0, monthly: 16, patchEvery: 100 },
  'community-first': { ...DEFAULT_POLICY,
    // The room is the product. Three quarters a match, the money made at the
    // concession counter, one friendly weekly. BENEFIT: the fullest, warmest
    // room — teams and regulars. SACRIFICE: margin — cheap play caps revenue.
    // RISK: the economy pit; the thinnest buffer of the three (the
    // cheap-needs-floor venue tip is aimed at exactly this run).
    tokenPrice: 0.25, playTokens: 3, foodPrice: 3, foods: 5, cabinets: 2, maxEmployees: 2, manager: false,
    ads: ['flyers'], weekly: 8, monthly: 0, patchEvery: 100 },
  'competition-first': { ...DEFAULT_POLICY,
    // The scene is the product. An honest price, two brackets, a lean floor,
    // and a designer who keeps the meta moving. BENEFIT: relevance, skill,
    // EVO. SACRIFICE: pots and a lean room — every event is a line item now.
    // RISK: the patch gamble, which grows teeth with franchise age.
    tokenPrice: 0.5, playTokens: 3, foodPrice: 3, foods: 2, cabinets: 1, maxEmployees: 2, manager: false,
    ads: ['flyers'], weekly: 8, monthly: 16, patchEvery: 70 },
}

console.log(`${DIFF}, n=${N}, ${DAYS}d (${(DAYS/336).toFixed(1)} years)`)
console.log('style               died  lasted   att  skill  top  $end  regs  evo  rel  teams  inno')
for (const [name, p] of Object.entries(STYLES)) {
  const rs = []
  for (let i = 0; i < N; i++) rs.push(playRun(makeRun({ difficulty: DIFF, policy: p }), DAYS, p))
  console.log(name.padEnd(19),
    String(Math.round(mean(rs.map(r => r.died ? 1 : 0)) * 100)).padStart(4),
    String(Math.round(mean(rs.map(r => r.lastedDays)))).padStart(7),
    mean(rs.map(r => r.attendance)).toFixed(1).padStart(5),
    mean(rs.map(r => r.skill)).toFixed(0).padStart(6),
    mean(rs.map(r => r.topSkill)).toFixed(0).padStart(5),
    String(Math.round(mean(rs.map(r => r.money)))).padStart(6),
    mean(rs.map(r => r.regulars)).toFixed(0).padStart(5),
    mean(rs.map(r => r.evoQualified)).toFixed(1).padStart(5),
    mean(rs.map(r => r.relevance)).toFixed(0).padStart(4),
    mean(rs.map(r => r.teams)).toFixed(1).padStart(6),
    mean(rs.map(r => r.innovations)).toFixed(0).padStart(6))
}
