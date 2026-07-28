import { makeRun, playRun, DEFAULT_POLICY, mean } from './policy.mjs'
const N = Number(process.argv[2] || 24), DAYS = Number(process.argv[3] || 336)
for (const diff of ['easy', 'normal', 'difficult', 'master']) {
  const rs = []
  for (let i = 0; i < N; i++) rs.push(playRun(makeRun({ difficulty: diff }), DAYS))
  const f = {}
  for (const r of rs.filter(x => x.died)) f[r.funnel] = (f[r.funnel] || 0) + 1
  const surv = rs.filter(x => !x.died)
  console.log(`${diff.padEnd(10)} died ${String(Math.round(mean(rs.map(r=>r.died?1:0))*100)).padStart(3)}%`,
    `| lasted ${String(Math.round(mean(rs.map(r=>r.lastedDays)))).padStart(3)}d`,
    `| att ${mean(rs.map(r=>r.attendance)).toFixed(1).padStart(4)}`,
    `| skill ${String(Math.round(mean(rs.map(r=>r.skill)))).padStart(2)}/${Math.round(mean(rs.map(r=>r.topSkill)))}`,
    `| $${String(Math.round(mean(rs.map(r=>r.money)))).padStart(5)}`,
    `| surv $${surv.length ? Math.round(mean(surv.map(r=>r.money))) : '—'}`,
    `| ${JSON.stringify(f)}`)
}
