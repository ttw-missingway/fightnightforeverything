// NO ARCHETYPE SUPERFLUOUS. Remove one temperament row from the world entirely
// — cast and filler — and see what the scene loses.
import { makeRun, playRun, DEFAULT_POLICY, mean } from './policy.mjs'
const SRC = new URL('../../src/game', import.meta.url).pathname
const C = await import(`${SRC}/constants.js`)

const N = Number(process.argv[2] || 12)
const DAYS = Number(process.argv[3] || 672)
const DIFF = process.argv[4] || 'normal'

const P0 = [...C.TEMPERAMENTS], S0 = [...C.SOCIAL_TEMPERAMENTS]

function withRows(removeKey, fn) {
  C.TEMPERAMENTS.length = 0
  C.SOCIAL_TEMPERAMENTS.length = 0
  C.TEMPERAMENTS.push(...P0.filter((t) => t.key !== removeKey))
  C.SOCIAL_TEMPERAMENTS.push(...S0.filter((t) => t.key !== removeKey))
  try { return fn() } finally {
    C.TEMPERAMENTS.length = 0; C.SOCIAL_TEMPERAMENTS.length = 0
    C.TEMPERAMENTS.push(...P0); C.SOCIAL_TEMPERAMENTS.push(...S0)
  }
}

function arm(removeKey) {
  return withRows(removeKey, () => {
    const rs = []
    for (let i = 0; i < N; i++) {
      const policy = { ...DEFAULT_POLICY,
        rows: { personal: C.TEMPERAMENTS.map(t => t.key), social: C.SOCIAL_TEMPERAMENTS.map(t => t.key) } }
      rs.push(playRun(makeRun({ difficulty: DIFF, policy }), DAYS, policy))
    }
    return {
      died: Math.round(mean(rs.map(r => r.died ? 1 : 0)) * 100),
      lasted: Math.round(mean(rs.map(r => r.lastedDays))),
      att: mean(rs.map(r => r.attendance)),
      skill: mean(rs.map(r => r.skill)),
      top: mean(rs.map(r => r.topSkill)),
      rival: mean(rs.map(r => r.rivalry)),
      tox: mean(rs.map(r => r.toxicity)),
      ment: mean(rs.map(r => r.mentorships)),
      teams: mean(rs.map(r => r.teams)),
      inno: mean(rs.map(r => r.innovations)),
      guides: mean(rs.map(r => r.guides)),
      ret: mean(rs.map(r => r.retirements)),
      regs: mean(rs.map(r => r.regulars)),
      rel: mean(rs.map(r => r.relevance)),
    }
  })
}

const arms = [null, 'killer', 'scholar', 'natural', 'stoic', 'warm', 'gracious', 'dramatic', 'puttogether']
const out = {}
for (const a of arms) { out[a || 'control'] = arm(a); process.stderr.write('.') }
process.stderr.write('\n')
const ctl = out.control
const f = (v, d = 1) => v.toFixed(d)
console.log(`${DIFF}, n=${N}, ${DAYS}d — every column is the SCENE without that row`)
console.log('arm           died lasted   att  skill  top  rival   tox  ment teams inno guide  ret  regs  rel')
for (const k of Object.keys(out)) {
  const o = out[k]
  console.log(k.padEnd(12),
    String(o.died).padStart(4), String(o.lasted).padStart(6),
    f(o.att).padStart(6), f(o.skill).padStart(6), f(o.top).padStart(5),
    f(o.rival, 2).padStart(6), f(o.tox, 2).padStart(5),
    f(o.ment).padStart(5), f(o.teams).padStart(5), f(o.inno).padStart(5),
    f(o.guides).padStart(5), f(o.ret).padStart(5), f(o.regs).padStart(5), f(o.rel, 0).padStart(4))
}
console.log('\nDELTA vs control (negative = the scene is WORSE without them):')
console.log('arm           died lasted   att  skill  top  rival   tox  ment teams inno guide  ret  regs  rel')
for (const k of Object.keys(out).filter(x => x !== 'control')) {
  const o = out[k]
  const d = (a, b, dg = 1) => { const v = a - b; return (v >= 0 ? '+' : '') + v.toFixed(dg) }
  console.log(k.padEnd(12),
    d(o.died, ctl.died, 0).padStart(4), d(o.lasted, ctl.lasted, 0).padStart(6),
    d(o.att, ctl.att).padStart(6), d(o.skill, ctl.skill).padStart(6), d(o.top, ctl.top).padStart(5),
    d(o.rival, ctl.rival, 2).padStart(6), d(o.tox, ctl.tox, 2).padStart(5),
    d(o.ment, ctl.ment).padStart(5), d(o.teams, ctl.teams).padStart(5), d(o.inno, ctl.inno).padStart(5),
    d(o.guides, ctl.guides).padStart(5), d(o.ret, ctl.ret).padStart(5), d(o.regs, ctl.regs).padStart(5), d(o.rel, ctl.rel, 0).padStart(4))
}
