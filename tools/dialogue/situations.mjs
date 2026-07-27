// The 120 situations, with cast conditions.
//
// SITUATIONS.md is the human-readable list Dylan edits; this is the machine
// form the generator and the casting layer both read. Keep them in step.
//
// THE RULE THAT GOVERNS THIS FILE: every requirement below must be evaluable
// inside makeBeats from state the sim already holds. A requirement the engine
// cannot check is a scene that can never be cast, which is worse than a scene
// that does not exist — it costs money to generate and then sits dead.

// ---------- Requirement vocabulary ----------
// ROLE requirements describe one person (or their relationship to the other).
// WORLD requirements describe the day, the arcade, or the game.

export const ROLE_REQS = {
  // Today's set — results[p.id] in makeBeats
  won: 'won the set that just happened',
  lost: 'lost the set that just happened',

  // familiarity(a, b) — how the SPEAKER sees the other role
  'rel:stranger': 'has never really spoken to the other',
  'rel:acquaintance': 'knows the other by name, has played them a bit',
  'rel:familiar': 'a regular around the other, comfortable',
  'rel:close': 'genuinely close to the other',
  'rel:hostile': 'real bad blood with the other',

  // p.voice
  'energy:fiery': 'runs hot', 'energy:chill': 'low-key',
  'humor:dry': 'deadpan', 'humor:earnest': 'sincere', 'humor:clowning': 'goes for the bit',

  // p.mood (0-10)
  'mood:low': 'in a bad mood', 'mood:high': 'in a good mood',

  // p.h2h[other.id]
  'h2h:even': 'lifetime record against the other is level',
  'h2h:dominant': 'wins most sets against the other',
  'h2h:losing': 'loses most sets against the other',
  'h2h:never-won': 'has never once beaten the other',

  // tenure and trajectory
  newcomer: 'new to the arcade', veteran: 'has been coming a long time',
  exploring: 'still trying characters, no main yet',
  settled: 'has committed to a main',
  'streak:winning': 'on a win streak', 'streak:losing': 'on a losing streak',
  'passion:low': 'losing interest in the game',
  retiring: 'close to walking away for good',
  warned: 'has been disciplined by the staff',

  // character situation
  'main:nerfed': 'their main was nerfed in the last patch',
  'main:buffed': 'their main was buffed in the last patch',
  'main:toptier': 'their main is considered strong',
  'main:lowtier': 'their main is considered weak',
  'same-main': 'mains the same character as the other',
  'pocket-used': 'pulled out a secondary character today',
  'fav-food-stocked': 'their own favourite concession item is in stock',
  mentor: 'mentors the other', student: 'is mentored by the other',
  teammate: 'on a team with the other',
}

export const WORLD_REQS = {
  'arcade:new': 'the arcade opened recently',
  'arcade:established': 'the arcade has been running a long time',
  'arcade:dirty': 'the place needs cleaning badly',
  'arcade:packed': 'busy, queue for the setups',
  'arcade:dead': 'almost nobody here',
  'arcade:reopened': 'just came back from a shutdown',
  'setup:broken': 'one of the setups is faulty',
  'concession:stocked': 'the concession stand has food in',
  'game:new': 'a side cabinet was recently added',
  'price:raised': 'token prices went up recently',
  'staff:new': 'a new employee started recently',
  'patch:fresh': 'a balance patch landed recently',
  'patch:system': 'the last patch changed a universal mechanic',
  'char:new': 'a new character was added recently',
  'tierlist:new': 'the community tier list was just updated',
  'meta:stale': 'nothing has changed in the game for a long time',
  'bracket:up': 'a tournament bracket has been posted',
  'tournament:today': 'a tournament is running today',
  'evo:soon': 'EVO is close',
  'stream:growing': 'the channel is picking up viewers',
  'relevance:falling': 'the game is losing national interest',
  'money:tight': 'the arcade is financially struggling',
}

// ---------- The situations ----------
// `roles` maps role name -> requirements. `world` is scene-level.
// Defaults: 3-4 turns, 12 exchanges per situation.

const S = (id, cat, when, roles, world) => ({ id, cat, when, roles, world: world || [] })

export const SITUATIONS = [
  // A — after a set, asymmetric
  S('runback-denied', 'A', 'Loser wants the runback immediately; winner is done for the night', { A: ['lost'], B: ['won'] }),
  S('winner-apologetic', 'A', 'Winner is apologetic about how it went — loser hates that more than losing', { A: ['lost'], B: ['won', 'humor:earnest'] }),
  S('blames-hardware', 'A', 'Loser blames hardware; winner offers to swap sides', { A: ['lost'], B: ['won'] }),
  S('whitewash-unspoken', 'A', 'It was a whitewash and neither of them wants to say so', { A: ['lost'], B: ['won'] }),
  S('threw-it-late', 'A', 'Loser was winning and threw it late', { A: ['lost'], B: ['won'] }),
  S('what-was-that', 'A', 'Winner used something new; loser wants to know what it was', { A: ['lost'], B: ['won'] }),
  S('bad-advice', 'A', 'Loser asks for advice; winner is bad at giving it', { A: ['lost'], B: ['won'] }),
  S('one-dumb-thing', 'A', 'Winner won by doing one simple thing repeatedly and knows it', { A: ['lost'], B: ['won'] }),
  S('good-sport-cost', 'A', 'Loser is being a good sport and it is visibly costing them', { A: ['lost', 'humor:earnest'], B: ['won'] }),
  S('first-ever-win', 'A', 'First time A has ever beaten B', { A: ['won', 'h2h:losing'], B: ['lost', 'h2h:dominant'] }, ['arcade:established']),
  S('wont-discuss', 'A', 'Loser wants to talk about the set; winner wants to talk about anything else', { A: ['lost'], B: ['won'] }),
  S('streak-not-fun', 'A', 'Winner is on a long streak against this person and it has stopped being fun', { A: ['lost', 'h2h:losing'], B: ['won', 'h2h:dominant'] }),
  S('deflect-to-food', 'A', 'Loser deflects into food, the vending machine, the room, anything', { A: ['lost'], B: ['won'] }),
  S('lowball-the-win', 'A', 'Winner lowballs their own win to keep the peace', { A: ['lost', 'mood:low'], B: ['won'] }),
  S('furious-nonsense', 'A', 'Loser is furious and not making sense', { A: ['lost', 'mood:low'], B: ['won'] }),

  // B — after a set, mutual
  S('long-close-set', 'B', 'Long close set, both wrung out, neither moving yet', { A: ['rel:familiar'], B: ['rel:familiar'] }),
  S('both-playing-badly', 'B', 'Both playing badly and both know it', { A: ['rel:familiar'], B: ['rel:familiar'] }),
  S('the-adjustment', 'B', 'They discuss an actual adjustment one of them made mid-set', { A: ['rel:familiar'], B: ['rel:familiar'] }),
  S('stop-before-bad', 'B', 'Agreeing to stop before it gets bad-tempered', { A: ['mood:low'], B: [] }),
  S('one-has-to-leave', 'B', 'Both want to run it back but one has to leave', { A: [], B: [] }),
  S('forgot-the-score', 'B', 'A set so good they forgot the score', { A: ['rel:familiar'], B: ['rel:familiar'] }),
  S('cabinet-glitched', 'B', 'Something went wrong on the cabinet mid-match', { A: [], B: [] }, ['setup:broken']),

  // C — rivalry and history
  S('dead-even', 'C', 'They are dead even lifetime and both track it', { A: ['h2h:even'], B: ['h2h:even'] }),
  S('never-beaten-them', 'C', 'One has never beaten the other and it is becoming a thing', { A: ['h2h:never-won'], B: ['h2h:dominant'] }, ['arcade:established']),
  S('rivals-fond', 'C', 'Rivals who genuinely like each other', { A: ['rel:close', 'h2h:even'], B: ['rel:close'] }),
  S('rivals-cold', 'C', 'Rivals who genuinely do not like each other', { A: ['rel:hostile'], B: ['rel:hostile'] }),
  S('rivalry-cooling', 'C', 'A rivalry cooling off; neither has said so', { A: ['rel:familiar'], B: ['rel:familiar'] }, ['arcade:established']),
  S('old-set-dredged', 'C', 'Someone brings up an old set the other has tried to forget', { A: ['rel:close'], B: ['rel:close'] }, ['arcade:established']),
  S('separated-both-here', 'C', 'Two people who were separated for feuding, both here, both aware', { A: ['rel:hostile'], B: ['rel:hostile'] }),
  S('called-out-ducking', 'C', 'One is ducking the other and gets called on it', { A: ['h2h:losing'], B: ['h2h:dominant'] }),
  S('rivals-plus-audience', 'C', 'Two rivals plus somebody enjoying it far too much', { A: ['rel:hostile'], B: ['rel:hostile'], C: ['humor:clowning'] }),
  S('grudge-nobody-recalls', 'C', 'A grudge everybody else has forgotten and these two have not', { A: ['rel:hostile'], B: ['rel:hostile'] }, ['arcade:established']),

  // D — meeting and newcomers
  S('first-meeting', 'D', 'First time they have ever spoken', { A: ['rel:stranger'], B: ['rel:stranger'] }),
  S('welcomed-well', 'D', "A newcomer's first night; a regular decides to be decent about it", { A: ['newcomer'], B: ['veteran', 'humor:earnest'] }),
  S('welcomed-badly', 'D', "A newcomer's first night; a regular does not", { A: ['newcomer'], B: ['veteran', 'rel:stranger'] }),
  S('nameless-regular', 'D', 'Someone has been coming for weeks and nobody has learned their name', { A: ['newcomer'], B: ['veteran'] }),
  S('known-from-stream', 'D', 'Recognising each other from the stream rather than the room', { A: ['rel:stranger'], B: ['rel:stranger'] }, ['stream:growing']),
  S('newcomer-is-good', 'D', 'A newcomer is much better than they look', { A: ['newcomer', 'won'], B: ['veteran', 'lost'] }),
  S('what-are-the-rules', 'D', 'A newcomer asks what the etiquette is', { A: ['newcomer'], B: ['veteran'] }),
  S('introducing-two', 'D', 'Somebody introducing two people who should know each other', { A: ['veteran'], B: ['rel:stranger'], C: ['rel:stranger'] }),
  S('returning-after-long', 'D', 'A regular returning after a long absence', { A: ['veteran'], B: ['veteran'] }, ['arcade:established']),
  S('unwanted-return', 'D', 'Someone the room quietly does not want back', { A: ['warned'], B: ['rel:hostile'] }),

  // E — characters, mains, picks
  S('dropping-my-main', 'E', 'Someone is dropping their main and saying it out loud', { A: ['settled', 'streak:losing'], B: [] }),
  S('defending-lowtier', 'E', 'Defending a low-tier pick to somebody who thinks it is a bug', { A: ['main:lowtier'], B: [] }),
  S('same-character', 'E', 'Two people who main the same character', { A: ['same-main'], B: ['same-main'] }),
  S('pocket-worked', 'E', 'Someone pulls a pocket pick and it works', { A: ['pocket-used', 'won'], B: ['lost'] }),
  S('pocket-failed', 'E', 'Someone pulls a pocket pick and it does not work', { A: ['pocket-used', 'lost'], B: ['won'] }),
  S('hate-your-character', 'E', 'One player mains the character the other cannot stand', { A: ['settled'], B: [] }),
  S('cannot-settle', 'E', 'Someone is still exploring and cannot settle', { A: ['exploring'], B: ['settled'] }),
  S('sleeper-defender', 'E', 'A character everyone sleeps on gets a defender', { A: ['main:lowtier'], B: [] }),
  S('new-skin-opinions', 'E', "Somebody's main got a new skin and they have opinions", { A: ['settled'], B: [] }),
  S('who-is-it-for', 'E', 'Two people arguing about who a character is actually for', { A: ['settled'], B: ['settled'] }),
  S('finally-committed', 'E', 'A player finally commits after months of flip-flopping', { A: ['settled'], B: ['veteran'] }, ['arcade:established']),
  S('tired-of-hearing-it', 'E', "Someone's main is considered broken and they are tired of hearing it", { A: ['main:toptier'], B: [] }),

  // F — meta, balance, patches
  S('nobody-read-notes', 'F', 'A patch just dropped and neither has read the notes properly', { A: [], B: [] }, ['patch:fresh']),
  S('my-main-got-nerfed', 'F', 'Their main got nerfed', { A: ['main:nerfed'], B: [] }, ['patch:fresh']),
  S('quietly-buffed', 'F', 'Their main got buffed and they are pretending to be modest', { A: ['main:buffed'], B: [] }, ['patch:fresh']),
  S('suddenly-everywhere', 'F', 'A character nobody expected is suddenly everywhere', { A: [], B: [] }, ['tierlist:new']),
  S('low-on-the-list', 'F', 'The new tier list is up and somebody is low', { A: ['main:lowtier'], B: [] }, ['tierlist:new']),
  S('genuinely-bad-matchup', 'F', 'Complaining about a matchup that is genuinely just bad', { A: ['settled'], B: ['settled'] }),
  S('actually-a-skill-issue', 'F', 'Complaining about a matchup that is actually a skill problem', { A: ['settled', 'streak:losing'], B: ['veteran'] }),
  S('system-change', 'F', 'A system change rewrote everything', { A: ['veteran'], B: ['veteran'] }, ['patch:system']),
  S('patch-aimed-at-me', 'F', 'Someone thinks the balance patch was aimed at them personally', { A: ['main:nerfed', 'humor:clowning'], B: [] }, ['patch:fresh']),
  S('meta-gone-stale', 'F', 'The meta has gone stale and everybody feels it', { A: ['veteran'], B: ['veteran'] }, ['meta:stale']),
  S('brand-new-character', 'F', 'A brand-new character just got added', { A: [], B: [] }, ['char:new']),
  S('is-the-game-good', 'F', 'Arguing about whether the game is in a good state at all', { A: ['veteran'], B: ['veteran'] }),

  // G — tournaments and stakes
  S('bracket-posted', 'G', 'A bracket just went up; who is in it', { A: [], B: [] }, ['bracket:up']),
  S('waiting-to-be-called', 'G', 'Waiting to be called for a match', { A: [], B: [] }, ['tournament:today']),
  S('out-early-still-here', 'G', 'Knocked out early and hanging around anyway', { A: ['lost', 'mood:low'], B: [] }, ['tournament:today']),
  S('friends-in-bracket', 'G', 'Two friends about to play each other in bracket', { A: ['rel:close'], B: ['rel:close'] }, ['tournament:today']),
  S('before-money-match', 'G', 'Before a money match — the real thing, with a crowd', { A: [], B: [] }),
  S('after-money-match', 'G', 'After losing a money match and the money changing hands', { A: ['lost'], B: ['won'] }),
  S('choked-on-stream', 'G', 'Someone chokes on stream and everyone saw it', { A: ['lost', 'mood:low'], B: ['rel:familiar'] }, ['tournament:today']),
  S('first-bracket-win', 'G', 'Somebody wins their first bracket', { A: ['won'], B: ['rel:familiar'] }, ['tournament:today']),
  S('veteran-upset', 'G', 'A veteran loses to a newcomer in bracket', { A: ['veteran', 'lost'], B: ['newcomer', 'won'] }, ['tournament:today']),
  S('should-i-enter', 'G', 'Deciding whether to enter at all', { A: ['newcomer'], B: ['veteran'] }, ['bracket:up']),
  S('railbirds', 'G', 'Railbirds calling a match they are watching on the projector', { A: [], B: [], C: [] }, ['tournament:today']),
  S('evo-is-close', 'G', 'EVO is close and somebody is actually going', { A: ['veteran'], B: [] }, ['evo:soon']),

  // H — the room itself
  S('broken-setup', 'H', 'One of the setups is broken and nobody has reported it', { A: [], B: [] }, ['setup:broken']),
  S('this-place-is-filthy', 'H', 'It is filthy in here and somebody finally says it', { A: [], B: [] }, ['arcade:dirty']),
  S('queue-for-cabinets', 'H', 'The place is packed and there is a queue for the cabinets', { A: [], B: [] }, ['arcade:packed']),
  S('dead-night', 'H', 'It is dead — three people on a night that should be busy', { A: [], B: [] }, ['arcade:dead']),
  S('food-smell', 'H', "Somebody's food is stinking out the room behind the curtain", { A: [], B: [] }, ['concession:stocked']),
  S('projector-playing-up', 'H', 'The projector or the stream is playing up', { A: [], B: [] }),
  S('new-cabinet-outside', 'H', 'A new cabinet or side game has appeared on the main floor', { A: [], B: [] }, ['game:new']),
  S('finally-stocked', 'H', 'Their favourite thing finally got stocked at concession', { A: ['fav-food-stocked'], B: [] }, ['concession:stocked']),
  S('the-good-chair', 'H', 'The good chair, and who is in it', { A: ['rel:familiar'], B: ['rel:familiar'] }),
  S('wandered-in', 'H', 'Somebody wandered in from the family arcade and is watching', { A: [], B: [] }),
  S('birthday-party-outside', 'H', 'A birthday party is happening on the other side of the curtain', { A: [], B: [] }),
  S('token-prices-up', 'H', 'Token prices went up', { A: [], B: [] }, ['price:raised']),
  S('new-staff', 'H', 'New staff who does not know anybody yet', { A: [], B: [] }, ['staff:new']),
  S('just-reopened', 'H', 'The place got shut down for a few days and just reopened', { A: [], B: [] }, ['arcade:reopened']),

  // I — money and the business
  S('do-they-make-money', 'I', 'Speculating about whether the arcade is actually making money', { A: ['veteran'], B: ['veteran'] }),
  S('spending-too-much', 'I', 'Somebody has been spending more here than they should', { A: ['humor:clowning'], B: [] }),
  S('costly-decision', 'I', 'The owner made a decision that visibly cost money', { A: ['veteran'], B: ['veteran'] }),
  S('compared-to-elsewhere', 'I', 'Comparing this place to wherever they played before', { A: ['newcomer'], B: ['veteran'] }),
  S('offering-to-help', 'I', 'Somebody offers to help out and means it', { A: ['humor:earnest', 'veteran'], B: [] }, ['money:tight']),
  S('might-close', 'I', 'Worrying out loud that the place might close', { A: ['veteran'], B: ['veteran'] }, ['money:tight']),

  // J — bonds, teams, mentorship
  S('mentor-going-well', 'J', 'A mentor and their student, going well', { A: ['mentor'], B: ['student'] }),
  S('mentor-going-badly', 'J', 'A mentor and their student, going badly', { A: ['mentor'], B: ['student', 'mood:low'] }),
  S('student-beats-mentor', 'J', 'The student beats the mentor for the first time', { A: ['student', 'won'], B: ['mentor', 'lost'] }, ['arcade:established']),
  S('recruiting', 'J', 'Recruiting somebody for a team', { A: ['teammate'], B: [] }),
  S('team-losing', 'J', 'A team losing together', { A: ['teammate', 'lost'], B: ['teammate', 'lost'] }, ['tournament:today']),
  S('not-about-the-game', 'J', 'Two people who have become genuinely close, not talking about the game at all', { A: ['rel:close'], B: ['rel:close'] }),
  S('bad-week-outside', 'J', 'Somebody having a bad week outside the arcade', { A: ['mood:low', 'rel:close'], B: ['rel:close'] }),
  S('bad-apology', 'J', 'An apology, badly delivered', { A: ['warned'], B: ['rel:hostile'] }),
  S('quiet-wing-taking', 'J', 'Someone taking a newer player under their wing without announcing it', { A: ['veteran'], B: ['newcomer'] }),
  S('long-night-settling-in', 'J', 'A group settling in for a long night', { A: [], B: [], C: [] }),

  // K — decline, burnout, leaving
  S('passion-bottoming-out', 'K', "Somebody's passion is bottoming out and it shows", { A: ['passion:low'], B: ['rel:familiar'] }),
  S('might-stop-coming', 'K', 'A regular says out loud that they might stop coming', { A: ['retiring'], B: ['rel:close'] }),
  S('discussed-in-absence', 'K', 'A regular has actually stopped coming and is discussed in absence', { A: ['veteran'], B: ['veteran'] }, ['arcade:established']),
  S('proper-goodbye', 'K', 'Someone retires and says goodbye properly', { A: ['retiring'], B: ['rel:close'] }, ['arcade:established']),
  S('just-stopped-turning-up', 'K', 'Someone retires and just stops turning up', { A: ['veteran'], B: ['veteran'] }, ['arcade:established']),
  S('visibly-past-it', 'K', 'A player who was great is visibly past it', { A: ['veteran', 'streak:losing'], B: ['veteran'] }, ['arcade:established']),
  S('warned-or-banned', 'K', 'Somebody got warned or banned and the room is talking about it', { A: [], B: [] }),
  S('newer-players-better', 'K', 'A veteran realising the newer players are just better now', { A: ['veteran', 'lost'], B: ['veteran'] }, ['arcade:established']),

  // L — recognition and the wider world
  S('name-on-the-wall', 'L', "Somebody's name is in the record books now", { A: ['won'], B: ['rel:familiar'] }, ['arcade:established']),
  S('people-are-watching', 'L', 'The stream is growing and people outside the room are watching', { A: [], B: [] }, ['stream:growing']),
  S('game-is-fading', 'L', 'The game is losing relevance nationally and they can feel it', { A: ['veteran'], B: ['veteran'] }, ['relevance:falling']),
  S('outsider-turns-up', 'L', 'Somebody from outside the scene turns up because of the stream', { A: ['newcomer', 'rel:stranger'], B: ['rel:stranger'] }, ['stream:growing']),
]

// Sanity: every requirement used must exist in the vocabulary, or the casting
// layer will silently never match it.
for (const s of SITUATIONS) {
  for (const [role, reqs] of Object.entries(s.roles)) {
    for (const r of reqs) {
      if (!ROLE_REQS[r]) throw new Error(`${s.id}: role ${role} uses unknown requirement "${r}"`)
    }
  }
  for (const w of s.world) {
    if (!WORLD_REQS[w]) throw new Error(`${s.id}: unknown world requirement "${w}"`)
  }
}
