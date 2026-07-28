// NO DOMINANT STRATEGY. Three genuinely different ways to run the place,
// same difficulty, same horizon. The bar is VIABILITY: one being best is fine,
// a gap that makes the others feel like self-kneecapping is not.
import { makeRun, playRun, DEFAULT_POLICY, mean } from './policy.mjs'
const N = Number(process.argv[2] || 12), DAYS = Number(process.argv[3] || 1008), DIFF = process.argv[4] || 'normal'

const STYLES = {
  'economy-first': { ...DEFAULT_POLICY,
    // The arcade is the business. A big floor, heavy advertising, a full crew,
    // and only one marquee event a month to keep the lights on cheaply.
    tokenPrice: 2, foodPrice: 3, foods: 4, cabinets: 4, maxEmployees: 3, manager: true,
    ads: ['flyers', 'radio', 'social'], weekly: 0, monthly: 16, patchEvery: 140 },
  'community-first': { ...DEFAULT_POLICY,
    // The room is the product. Cheap food and cheap play, a well-staffed floor,
    // one friendly weekly bracket, and a light touch on the game itself.
    tokenPrice: 1, foodPrice: 2, foods: 5, cabinets: 2, maxEmployees: 3, manager: true,
    ads: ['flyers'], weekly: 8, monthly: 0, patchEvery: 120 },
  'competition-first': { ...DEFAULT_POLICY,
    // The scene is the product. Two brackets, a lean floor, and a designer who
    // keeps the meta moving.
    tokenPrice: 2, foodPrice: 3, foods: 2, cabinets: 1, maxEmployees: 2, manager: false,
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
