// Name pools for randomly generated players, characters and flavor.

export const FIRST_NAMES = [
  'Marcus', 'Aisha', 'Kenji', 'Sofia', 'Dante', 'Priya', 'Leo', 'Mina', 'Omar', 'Jade',
  'Ravi', 'Elena', 'Theo', 'Naomi', 'Carlos', 'Yuki', 'Andre', 'Bianca', 'Felix', 'Rosa',
  'Ibrahim', 'Chloe', 'Diego', 'Hana', 'Victor', 'Amara', 'Jin', 'Lucia', 'Malik', 'Erin',
  'Sam', 'Nadia', 'Kofi', 'Iris', 'Mateo', 'Zoe', 'Hassan', 'Freya', 'Tobias', 'Renee',
]

export const LAST_NAMES = [
  'Reyes', 'Tanaka', 'Okafor', 'Novak', 'Silva', 'Kim', 'Petrov', 'Alvarez', 'Nguyen', 'Haddad',
  'Kowalski', 'Mbeki', 'Rossi', 'Larsen', 'Sato', 'Iqbal', 'Moreau', 'Castillo', 'Dvorak', 'Umeh',
  'Fischer', 'Vargas', 'Lindgren', 'Osei', 'Takahashi', 'Weiss', 'Delgado', 'Yamada', 'Brooks', 'Farah',
]


/**
 * Cluster-based, gendered name pools. A world roster stops feeling generated
 * the moment a player named Hiroshi turns out to be from Brazil — so names
 * come from CLUSTERS, every country in the atlas (geo.js) points at one, and
 * gender picks the right list. Cluster keys are deliberately NOT ISO codes
 * where they would collide (AFR not AF — Afghanistan; ARB not ME — Montenegro).
 * The old flat FIRST_NAMES/LAST_NAMES stay as the anything-goes spice pool.
 */
export const NAME_POOLS = {
  JP: {
    m: ['Kenji', 'Hiroshi', 'Takeshi', 'Daichi', 'Ryo', 'Sota', 'Haruto', 'Yuto', 'Kazuki', 'Ren', 'Shinji', 'Takumi', 'Riku', 'Itsuki'],
    f: ['Hana', 'Aoi', 'Sakura', 'Mei', 'Rin', 'Miyu', 'Akari', 'Kaede', 'Hinata', 'Saki', 'Nanami', 'Yui'],
    last: ['Tanaka', 'Sato', 'Takahashi', 'Yamada', 'Suzuki', 'Watanabe', 'Ito', 'Nakamura', 'Kobayashi', 'Kato', 'Yoshida', 'Matsumoto', 'Ogawa', 'Fujita'],
  },
  KR: {
    m: ['Minjun', 'Seojun', 'Dohyun', 'Jiho', 'Junseo', 'Hyunwoo', 'Jisung', 'Taeyang', 'Woojin', 'Seungmin'],
    f: ['Seoyeon', 'Jiwoo', 'Minseo', 'Hayoon', 'Chaewon', 'Yuna', 'Eunji', 'Soomin', 'Dahye', 'Nayeon'],
    last: ['Kim', 'Lee', 'Park', 'Choi', 'Jung', 'Kang', 'Cho', 'Yoon', 'Jang', 'Lim', 'Han', 'Oh', 'Shin', 'Kwon'],
  },
  CN: {
    m: ['Wei', 'Jun', 'Hao', 'Ming', 'Lei', 'Feng', 'Yichen', 'Zihan', 'Bo', 'Cheng'],
    f: ['Meiling', 'Lin', 'Xiu', 'Yan', 'Jing', 'Hui', 'Yuxi', 'Qian', 'Xinyi', 'Lan'],
    last: ['Wang', 'Li', 'Zhang', 'Liu', 'Chen', 'Yang', 'Huang', 'Zhao', 'Wu', 'Zhou', 'Xu', 'Sun'],
  },
  VN: {
    m: ['Minh', 'Duc', 'Huy', 'Khoa', 'Tuan', 'Long', 'Nam', 'Phuc', 'Quang', 'Bao'],
    f: ['Linh', 'Trang', 'Huong', 'Mai', 'Ngoc', 'Thao', 'Anh', 'Vy', 'Chi', 'Nhi'],
    last: ['Nguyen', 'Tran', 'Le', 'Pham', 'Hoang', 'Vu', 'Dang', 'Bui', 'Do', 'Ngo'],
  },
  TH: {
    m: ['Somchai', 'Krit', 'Anan', 'Tanawat', 'Nattapong', 'Chai', 'Prem', 'Kittisak', 'Arthit', 'Tee'],
    f: ['Nok', 'Ploy', 'Fah', 'Mint', 'Kanya', 'Siriporn', 'Achara', 'Malee', 'Dao', 'Bua'],
    last: ['Srisawat', 'Chaiyasit', 'Wongsa', 'Rattanakorn', 'Suksawat', 'Thongchai', 'Phromma', 'Kittikun', 'Saelim', 'Bunmee'],
  },
  IN: {
    m: ['Arjun', 'Rahul', 'Vikram', 'Rohan', 'Aditya', 'Karan', 'Nikhil', 'Sanjay', 'Dev', 'Ishaan'],
    f: ['Priya', 'Ananya', 'Divya', 'Kavya', 'Riya', 'Sneha', 'Pooja', 'Meera', 'Nisha', 'Tara'],
    last: ['Sharma', 'Patel', 'Singh', 'Kumar', 'Gupta', 'Reddy', 'Nair', 'Iyer', 'Mehta', 'Chopra', 'Rao', 'Das'],
  },
  ARB: {
    m: ['Omar', 'Hassan', 'Karim', 'Tariq', 'Youssef', 'Ali', 'Faisal', 'Rashid', 'Samir', 'Ziad', 'Arslan', 'Imran'],
    f: ['Layla', 'Amira', 'Fatima', 'Noor', 'Yasmin', 'Rania', 'Dalia', 'Hala', 'Salma', 'Mariam'],
    last: ['Haddad', 'Al-Farsi', 'Nasser', 'Khalil', 'Aziz', 'Mansour', 'Hamdan', 'Saleh', 'Amin', 'Barakat', 'Khan', 'Malik'],
  },
  AFR: {
    m: ['Kofi', 'Kwame', 'Chinedu', 'Emeka', 'Sipho', 'Thabo', 'Ade', 'Femi', 'Juma', 'Baraka', 'Oumar', 'Sekou'],
    f: ['Amara', 'Chiamaka', 'Ngozi', 'Zanele', 'Thandi', 'Adaeze', 'Abena', 'Fanta', 'Amina', 'Wanjiru'],
    last: ['Okafor', 'Mbeki', 'Umeh', 'Osei', 'Adeyemi', 'Okonkwo', 'Nkosi', 'Dlamini', 'Mensah', 'Diallo', 'Kamau', 'Abara'],
  },
  CIS: {
    m: ['Dmitri', 'Alexei', 'Sergei', 'Nikolai', 'Ivan', 'Mikhail', 'Andrei', 'Pavel', 'Viktor', 'Yuri', 'Artem', 'Denis'],
    f: ['Anastasia', 'Natalia', 'Irina', 'Olga', 'Svetlana', 'Ekaterina', 'Daria', 'Alina', 'Vera', 'Polina'],
    last: ['Petrov', 'Ivanov', 'Smirnov', 'Volkov', 'Kuznetsov', 'Sokolov', 'Popov', 'Lebedev', 'Kozlov', 'Morozov', 'Shevchenko', 'Bondarenko'],
  },
  PL: {
    m: ['Jakub', 'Mateusz', 'Kacper', 'Piotr', 'Tomasz', 'Marcin', 'Krzysztof', 'Pawel', 'Adam', 'Bartek'],
    f: ['Zuzanna', 'Julia', 'Maja', 'Aleksandra', 'Wiktoria', 'Karolina', 'Magdalena', 'Agata', 'Ewa', 'Kasia'],
    last: ['Kowalski', 'Nowak', 'Wisniewski', 'Wojcik', 'Kaminski', 'Zielinski', 'Szymanski', 'Dabrowski', 'Mazur', 'Krawczyk'],
  },
  IT: {
    m: ['Marco', 'Luca', 'Alessandro', 'Matteo', 'Davide', 'Francesco', 'Lorenzo', 'Simone', 'Andrea', 'Riccardo'],
    f: ['Giulia', 'Martina', 'Chiara', 'Alessia', 'Francesca', 'Elisa', 'Valentina', 'Sara', 'Ilaria', 'Beatrice'],
    last: ['Rossi', 'Ferrari', 'Romano', 'Colombo', 'Ricci', 'Marino', 'Greco', 'Gallo', 'Conti', 'Esposito'],
  },
  BR: {
    m: ['João', 'Pedro', 'Lucas', 'Gabriel', 'Rafael', 'Thiago', 'Felipe', 'Bruno', 'Caio', 'Matheus', 'Vinicius'],
    f: ['Ana', 'Beatriz', 'Camila', 'Juliana', 'Larissa', 'Mariana', 'Fernanda', 'Gabriela', 'Leticia', 'Isabela'],
    last: ['Silva', 'Santos', 'Oliveira', 'Souza', 'Costa', 'Pereira', 'Almeida', 'Nascimento', 'Lima', 'Araujo', 'Ribeiro', 'Carvalho'],
  },
  ES: {
    m: ['Carlos', 'Diego', 'Miguel', 'Javier', 'Alejandro', 'Luis', 'Fernando', 'Ricardo', 'Andrés', 'Pablo', 'Santiago', 'Emilio'],
    f: ['Sofia', 'Lucia', 'Valeria', 'Elena', 'Isabella', 'Ximena', 'Daniela', 'Carmen', 'Rosa', 'Marisol'],
    last: ['Reyes', 'Alvarez', 'Castillo', 'Vargas', 'Delgado', 'Hernandez', 'Garcia', 'Martinez', 'Lopez', 'Ramirez', 'Torres', 'Mendoza'],
  },
  FR: {
    m: ['Antoine', 'Julien', 'Théo', 'Hugo', 'Louis', 'Maxime', 'Nicolas', 'Baptiste', 'Romain', 'Clément'],
    f: ['Chloé', 'Camille', 'Manon', 'Léa', 'Juliette', 'Margaux', 'Elise', 'Amélie', 'Inès', 'Océane'],
    last: ['Moreau', 'Dubois', 'Lefevre', 'Girard', 'Fontaine', 'Rousseau', 'Bernard', 'Lambert', 'Chevalier', 'Marchand'],
  },
  DE: {
    m: ['Felix', 'Lukas', 'Maximilian', 'Jonas', 'Leon', 'Niklas', 'Tobias', 'Florian', 'Moritz', 'Jan'],
    f: ['Lena', 'Hannah', 'Marie', 'Sophie', 'Anna', 'Johanna', 'Katrin', 'Nina', 'Clara', 'Franziska'],
    last: ['Fischer', 'Weiss', 'Müller', 'Schmidt', 'Wagner', 'Becker', 'Hoffmann', 'Schulz', 'Keller', 'Braun'],
  },
  SE: {
    m: ['Erik', 'Oskar', 'Axel', 'Elias', 'Emil', 'Anton', 'Nils', 'Gustav', 'Henrik', 'Viggo'],
    f: ['Freya', 'Astrid', 'Elsa', 'Maja', 'Ingrid', 'Saga', 'Linnea', 'Ebba', 'Sigrid', 'Tove'],
    last: ['Larsen', 'Lindgren', 'Johansson', 'Andersson', 'Nilsson', 'Eriksson', 'Berg', 'Lund', 'Dahl', 'Holm'],
  },
  EN: {
    m: ['Marcus', 'Leo', 'Sam', 'Theo', 'Jake', 'Tyler', 'Brandon', 'Chris', 'Austin', 'Cole', 'Ethan', 'Mason', 'Logan', 'Owen', 'Blake', 'Danny'],
    f: ['Jade', 'Chloe', 'Erin', 'Zoe', 'Iris', 'Naomi', 'Renee', 'Ashley', 'Megan', 'Paige', 'Brooke', 'Hailey', 'Sarah', 'Katie'],
    last: ['Brooks', 'Carter', 'Hayes', 'Bennett', 'Parker', 'Morgan', 'Reed', 'Cooper', 'Bailey', 'Foster', 'Murphy', 'Sullivan', 'Walker', 'Turner', 'Hughes', 'Mitchell'],
  },
}

/**
 * Melting-pot countries draw from several clusters. `ANY` is the diversity
 * card — any cluster at all — and it is deliberately biggest in America.
 * A country whose atlas cluster is a plain pool key just uses that pool.
 */
export const NAME_MIX = {
  US: { EN: 0.62, ANY: 0.38 },
  GB: { EN: 0.78, ANY: 0.22 },
  CA: { EN: 0.72, FR: 0.18, ANY: 0.1 },
  AU: { EN: 0.85, ANY: 0.15 },
  SG: { CN: 0.6, IN: 0.2, EN: 0.2 },
  MY: { ARB: 0.5, CN: 0.3, IN: 0.2 },
  ID: { ARB: 0.75, CN: 0.25 },
  PH: { ES: 0.6, EN: 0.4 },
}

/**
 * Gamer tags. There need to be MORE of these than the arcade can ever hold —
 * a roster now runs to seventy-odd people, and when this list ran dry the
 * generator fell back to sticking a random number on the end, so a scene ended
 * up full of PixelPunisher87 and TiltProof63 and ResetRat59.
 */
export const ALIASES = [
  'PixelPunisher', 'WaveDash', 'SaltMine', 'FrameTrap', 'OkiMaster', 'TechChase', 'LowTierHero',
  'GodFist', 'ComboQueen', 'ClutchGene', 'PopOff', 'DownBack', 'MashPro', 'NeutralKing', 'ResetRat',
  'HitConfirm', 'CrossUp', 'MeterBurn', 'TiltProof', 'LabMonster', 'PocketPick', 'RoundStart',
  'AntiAirForce', 'FuzzyGuard', 'PlinkGod', 'SafeJump', 'WhiffPunish', 'HypeTrain', 'LastStock', 'RageQuit',
  'ThrowLoop', 'BurstBait', 'ParryKing', 'DashBack', 'KaraThrow', 'InstantAir', 'DragonPunch',
  'Footsies', 'Spacing', 'BlockString', 'MixupCity', 'HardRead', 'OptionSelect', 'ChipDamage',
  'CornerCarry', 'FrameOne', 'PerfectRun', 'NoContest', 'PixelHealth', 'ClutchTime', 'RunItBack',
  'FirstToFive', 'JohnnySalt', 'TheReads', 'CounterHit', 'PunishGod', 'ZonerLife', 'GrappleFan',
  'ShotoStan', 'PuppetMain', 'CharacterLoyal', 'TierWhore', 'PatchNotes', 'LabRat', 'MatchupChart',
  'NeutralSkip', 'DelayTech', 'BufferKing', 'PianoInput', 'NegativeEdge', 'PlinkDaddy', 'MicroDash',
  'EmptyJump', 'StaggerP', 'ShimmyKing', 'WalkSpeed', 'TheSetplay', 'VortexMain', 'MeterMiser',
  'BurstSafe', 'RawSuper', 'ArcadeStick', 'Hitboxer', 'PadWarrior', 'ButtonCheck', 'TrainingMode',
  'CasualsOnly', 'BracketDemon', 'PoolsExit', 'TopEight', 'GrandFinal', 'LosersRun', 'WinnersSide',
  'SaltyRunback', 'MoneyMatch', 'SideBet', 'TheHotSeat', 'FreeWins', 'NotFree', 'HonestPlayer',
]

export const CHARACTER_NAMES = [
  'Ryunosuke', 'Valkyra', 'Bruteus', 'Sable', 'Kagemaru', 'Duchess', 'Volt', 'Mireille',
  'Grimjaw', 'Anansi', 'Tempest', 'Old Ho-Jin', 'Nyx', 'Colossus Rex', 'Piper', 'Zenith',
]

export const MOVE_NAME_PARTS = {
  prefix: ['Rising', 'Crimson', 'Shadow', 'Thunder', 'Iron', 'Phantom', 'Burning', 'Frozen', 'Savage', 'Divine', 'Twin', 'Hyper'],
  suffix: ['Fang', 'Palm', 'Cyclone', 'Breaker', 'Lance', 'Verdict', 'Talon', 'Requiem', 'Driver', 'Edge', 'Howl', 'Bloom'],
}

export const TECHNIQUE_NAME_PARTS = {
  prefix: ['Kara', 'Option-Select', 'Micro', 'Delayed', 'Instant', 'Reverse', 'Corner', 'Meterless', 'Blind', 'Double'],
  suffix: ['Cancel', 'Step', 'Loop', 'Shift', 'Feint', 'Pivot', 'Storage', 'Skip', 'Glide', 'Stall'],
}

export const TEAM_WORDS = [
  ['Basement', 'Arcade', 'Quarter', 'Neon', 'Midnight', 'Corner', 'Salt', 'Frame', 'Pixel', 'Combo'],
  ['Dwellers', 'Kings', 'Circuit', 'Syndicate', 'Society', 'Legion', 'Lab', 'Mafia', 'Order', 'Crew'],
]

/**
 * The world's ranked competitors. There must be comfortably more of these than
 * EVO_ROSTER_SIZE (64) or the roster fills with "Miracle 4" and "Eclipse 7",
 * which is what a twenty-name list did to a sixty-four-player world.
 */
export const ELITE_ALIASES = [
  'The Emperor', 'Cold Steel', 'Miracle', 'Prodigy', 'The Wall', 'Executioner', 'Daigo Jr',
  'Machine', 'The Professor', 'Untouchable', 'Zero Suit', 'The Oracle', 'Final Boss',
  'Heartbreaker', 'The Standard', 'Apex', 'Nightmare', 'The Gatekeeper', 'Sovereign', 'Eclipse',
  'Tempest', 'The Surgeon', 'Ghost', 'Verdict', 'Iron Lotus', 'Nova', 'The Alchemist',
  'Blackout', 'Kingmaker', 'The Archivist', 'Meridian', 'Halcyon', 'The Undertaker', 'Vertigo',
  'Sandstorm', 'The Cartographer', 'Onyx', 'Requiem', 'The Diplomat', 'Zenith', 'Riptide',
  'The Watchmaker', 'Cinder', 'Paragon', 'The Understudy', 'Solstice', 'Warden', 'The Deadline',
  'Quicksilver', 'The Metronome', 'Basilisk', 'Overture', 'The Rival', 'Lodestar', 'Fracture',
  'The Hourglass', 'Tundra', 'Sable Knight', 'The Auditor', 'Kestrel', 'Monolith', 'The Prospect',
  'Afterimage', 'Tessellate', 'The Closer', 'Vandal', 'Perihelion', 'The Understatement',
  'Crown', 'Bellwether', 'The Last Word', 'Ozone', 'Grandmaster', 'The Quiet One',
  // The roster is eighty now and it TURNS OVER — retirements pull fresh names
  // in every year, so the pool has to run well past the roster size or a long
  // lineage starts meeting Miracle 4 again.
  'The Anthem', 'Whiteout', 'Catalyst', 'The Curator', 'Foxglove', 'Ironclad', 'The Sentence',
  'Downpour', 'Vesper', 'The Aqueduct', 'Snakebite', 'Polaris', 'The Fine Print', 'Rook',
  'Avalanche', 'The Chandelier', 'Sirocco', 'Judgement', 'The Locksmith', 'Ember Queen',
  'Palisade', 'The Encore', 'Nightjar', 'Crescendo', 'The Abacus', 'Stormglass', 'Vantage',
  'The Petition', 'Karakuri', 'Longitude', 'The Furnace', 'Silvertongue', 'Undertow',
  'The Appraiser', 'Comet', 'Thornfield', 'The Interval', 'Magnitude', 'Wolfsbane', 'The Debut',
]

/**
 * What a brand-new counter can carry. Five things, and they are the five
 * nobody has ever been excited about.
 *
 * People's tastes span the WHOLE catalogue from day one — see randomPreferences
 * — so a regular whose favourite is katsu curry will keep wanting katsu curry
 * in an arcade that can only sell them a pretzel. That gap is the point: the
 * counter is supposed to feel thin until you have earned it out.
 */
export const STARTER_FOODS = [
  'nachos', 'pretzels', 'hot dogs', 'slushies', 'energy drinks',
]

/**
 * The four packs, each earned by an achievement (see achievements.js — the
 * `unlock` keys match). A theme apiece, because "five more foods" is inventory
 * and "the fryer" is a decision about what kind of counter you run.
 */
export const FOOD_PACKS = [
  {
    key: 'food-fryer', label: 'The Fryer', icon: '🍟',
    blurb: 'Hot, salty and fast. Nobody plans to buy it; everybody buys it.',
    foods: ['chicken tenders', 'curly fries', 'mozzarella sticks', 'corn dogs', 'onion rings'],
  },
  {
    key: 'food-sweets', label: 'The Sweet Counter', icon: '🍬',
    blurb: 'Sugar and cold hands. What the youngest half of the room actually comes for.',
    foods: ['churros', 'cotton candy', 'soft serve', 'candy bars', 'milkshakes'],
  },
  {
    key: 'food-hotline', label: 'The Hot Line', icon: '🍜',
    blurb: 'Food people sit down for — and people who sit down stay for another set.',
    foods: ['pizza slices', 'ramen cups', 'takoyaki', 'onigiri', 'katsu curry'],
  },
  {
    key: 'food-latenight', label: 'Late Night', icon: '🌙',
    blurb: "What a closing-time crowd eats when they've decided not to go home yet.",
    foods: ['cold brew', 'energy shots', 'beef jerky', 'pork buns', 'breakfast sandwiches'],
  },
]

// Every food in the game. Prices are hashed from the name (economy.js), so a
// food must never be renamed once it exists — old saves hold these as strings.
export const FOODS = [...STARTER_FOODS, ...FOOD_PACKS.flatMap((p) => p.foods)]

/** The cabinets any arcade can install from day one. */
export const STARTER_GAMES = [
  'Puzzle Blitz', 'Rhythm Storm', 'Metal Racer GT', 'House of Zombies', 'Air Hockey',
  'Star Shooter EX', 'Dance Cascade', 'Crane Game', 'Pinball: Dragon Lair', 'Time Crisis Delta',
]

/**
 * Attractions. Not cabinets — ROOMS, and they behave differently: each draws a
 * crowd that isn't your fighting-game roster, so it earns whether or not any
 * simulated player walks over to it. See attractionIncome in economy.js.
 *
 * THREE FIELDS DECIDE WHETHER A PACK IS WORTH BUYING, and they are meant to be
 * read together — the whole point is that the same purchase is shrewd for one
 * arcade and idiotic for another.
 *
 * `audience` — WHO it brings in. This is the real currency. An audience you do
 *   not already serve is a whole new crowd through the door; a second pack
 *   aimed at people you already have is mostly just more rent. Buying the
 *   pinball collection when the classics wall already owns the old heads is
 *   the mistake this field exists to let you make.
 * `footprint` — what the landlord charges a month for the SPACE. Lanes and
 *   courts are enormous; a row of pin tables is not.
 * `pull` — how hard it draws its audience once installed.
 *
 * `demographic` is the same fact as `audience`, written for a human to read.
 * Each pack is earned by an achievement (`key` matches `unlock`).
 */
export const ATTRACTION_PACKS = [
  {
    key: 'attr-pinball', label: 'The Pinball Collection', icon: '🎱',
    demographic: 'the old heads',
    audience: 'oldheads', footprint: 26, pull: 1.0,
    blurb: 'A row of real tables along the back wall. Quiet money, and it never breaks a sweat.',
    items: ['Silverball Row', 'Gothic Manor Pin', 'Cosmic Drift Pin', 'Diner Deluxe Pin'],
  },
  {
    key: 'attr-bowling', label: 'The Bowling Alley', icon: '🎳',
    demographic: 'families',
    audience: 'families', footprint: 95, pull: 1.35,
    blurb: 'Four lanes and a shoe counter. Turns an afternoon into an outing.',
    items: ['Lanes 1–2', 'Lanes 3–4', 'The Shoe Counter'],
  },
  {
    key: 'attr-classics', label: 'Classic Cabinets', icon: '👾',
    demographic: 'everyone',
    audience: 'oldheads', footprint: 30, pull: 1.0,
    blurb: 'The wall of originals. Half nostalgia, half the reason anyone calls this an arcade.',
    items: ['Asteroid Field', 'Ladder Kong', 'Maze Muncher', 'Tank Battalion', 'Frog Crossing'],
  },
  {
    key: 'attr-lasertag', label: 'Laser Tag Arena', icon: '🔫',
    demographic: 'groups and birthdays',
    audience: 'groups', footprint: 85, pull: 1.3,
    blurb: 'Nobody plays this alone. Books out for parties and empties your counter of food.',
    items: ['The Arena', 'Vest Rack', 'Briefing Room'],
  },
  {
    key: 'attr-vr', label: 'VR Bay', icon: '🥽',
    demographic: 'the curious',
    audience: 'curious', footprint: 40, pull: 1.15,
    blurb: 'Expensive, temperamental, and the thing every first-timer asks about.',
    items: ['VR Rig A', 'VR Rig B', 'The Treadmill'],
  },
  {
    key: 'attr-touchscreen', label: 'Touch-Screen Bar Games', icon: '📱',
    demographic: 'the after-work crowd',
    audience: 'afterwork', footprint: 20, pull: 0.9,
    blurb: 'Trivia, photo hunt, quick-fire quizzes. Nobody comes for these and everybody plays them.',
    items: ['Quiz Countertop', 'Photo Hunt Deluxe', 'Trivia Tower'],
  },
  {
    key: 'attr-pickleball', label: 'Pickleball Courts', icon: '🥒',
    demographic: 'the neighbourhood',
    audience: 'locals', footprint: 90, pull: 1.2,
    blurb: "Two courts out back. Nothing to do with fighting games, and that's the point.",
    items: ['Court 1', 'Court 2'],
  },
]

// Everything installable on the floor.
export const OTHER_GAMES = [...STARTER_GAMES, ...ATTRACTION_PACKS.flatMap((p) => p.items)]

export const GAME_TITLE_PARTS = {
  a: ['Savage', 'Eternal', 'Hyper', 'Crimson', 'Final', 'Ultra', 'Neon', 'Iron', 'Astral', 'Burning'],
  b: ['Fist', 'Clash', 'Duel', 'Rivals', 'Impact', 'Fury', 'Brawlers', 'Vanguard', 'Combat', 'Reckoning'],
  c: ['II', 'III', 'EX', 'Turbo', 'Zero', 'Unlimited', 'Rebirth', 'Prime', "Champion Edition", 'X'],
}

export const ARCADE_NAME_PARTS = {
  a: ['Neon', 'Quarter', 'Pixel', 'Midnight', 'Golden', 'Electric', 'Downtown', 'Galaxy', 'Retro', 'Lucky'],
  b: ['Palace', 'Alley', 'Dungeon', 'Station', 'Vault', 'Corner', 'Grid', 'Den', 'Coliseum', 'Basement'],
}

export const STAGE_IDEAS = [
  ['Rooftop Rumble', 'A windy skyscraper rooftop at dusk, neon signs buzzing below.'],
  ['Temple of the Old Masters', 'Crumbling stone, incense smoke, and watching statues.'],
  ['Dockside Brawl', 'Shipping containers, seagulls, and one very unlucky forklift.'],
  ['Neon Alley', 'Rain-slick pavement reflecting a wall of holographic ads.'],
  ['The Foundry', 'Molten metal pours behind the fighters. OSHA has given up.'],
  ['Cherry Blossom Bridge', 'Petals drift across a wooden bridge at golden hour.'],
  ['Underground Parking Lot B4', 'Flickering fluorescents and infinite echo.'],
  ['Grand Arena', 'A packed stadium with pyrotechnics on every knockdown.'],
  ['Frozen Summit', 'A mountain peak above the clouds, wind howling.'],
  ['Night Market', 'Fighters weave between food stalls; nobody stops eating.'],
]

export const TAG_SUGGESTIONS = [
  'edgy', 'cute', 'honest', 'cheap', 'big damage', 'technical', 'flashy', 'creepy',
  'cool', 'goofy', 'classic', 'anime', 'monster', 'military', 'royal', 'underdog',
]

export const PLAYER_TAG_SUGGESTIONS = [
  'loud', 'chill', 'tryhard', 'meme lord', 'old head', 'salty', 'wholesome', 'cocky',
  'quiet', 'hype beast', 'theory crafter', 'masher', 'grinder', 'clown', 'stoic', 'dramatic',
]

export const TOURNAMENT_NAME_PARTS = {
  a: ['Friday Night', 'Sunday', 'Weekly', 'Monthly', 'Midnight', 'Basement', 'Neon', 'King of the', 'Quarter Circle', 'Last Stock'],
  b: ['Throwdown', 'Rumble', 'Clash', 'Showdown', 'Brawl', 'Gauntlet', 'Classic', 'Open', 'Invitational', 'Wars'],
}

export const LIFE_EVENTS = [
  'their car broke down on the highway', 'they got called into a double shift',
  'they came down with a nasty cold', 'a family dinner ran way too long',
  'their controller gave up the ghost this morning', 'they slept through three alarms',
  'their landlord scheduled an "emergency" inspection', 'they had a final exam tomorrow',
  'their dog ate something it absolutely should not have', 'a friend needed help moving a couch',
  'they got stuck babysitting their cousins', 'their bus simply never came',
]

// How each archetype fights when they're NOT landing a named special —
// jabs, movement, and gameplan are standard kit, so the narrator supplies
// them from the archetype instead of making the user define "jab".
// {o} = the opponent's name.
export const ARCHETYPE_FLAVOR = {
  'Shoto': [
    'walks {o} into the corner with textbook footsies',
    'checks {o} with a crisp low jab',
    'anti-airs {o} clean — pure fundamentals',
    'converts a stray poke into real damage',
  ],
  'Weapon Master': [
    'catches {o} at the very tip of the blade',
    'holds {o} at arm\'s length and simply will not let them in',
    'sweeps a wide arc that {o} has no answer for',
    'punishes {o} for existing three feet too close',
  ],
  'Aerial': [
    'comes down on {o} from an angle nobody blocks first try',
    'crosses {o} up in the air and lands behind them',
    'refuses to stay on the ground long enough to be hit',
    'turns a jump-in into a full health bar of trouble for {o}',
  ],
  'Stance Switch': [
    'swaps stance mid-blockstring and {o} guesses wrong',
    'shows {o} one form and beats them with the other',
    'changes the entire matchup between one hit and the next',
    'makes {o} fight two characters in a single round',
  ],
  'Counter-Puncher': [
    'does absolutely nothing until {o} commits, then collects',
    'parries {o} clean and takes a full round\'s worth of damage back',
    'waits. and waits. and then {o} presses a button.',
    'turns {o}\'s best read into their worst decision',
  ],
  'Grappler': [
    'armors through a hit and snatches the grab anyway',
    'closes in on {o} like a slow tide',
    'makes {o} terrified to press a single button',
    'turns one knockdown into a coin-flip {o} keeps losing',
  ],
  'Zoner': [
    'keeps {o} locked out at full screen',
    'walls {o} out with relentless space control',
    'makes {o} walk through a minefield just to get in',
    'resets to full screen the moment {o} gets close',
  ],
  'Rushdown': [
    'swarms {o} with nonstop pressure',
    'opens {o} up with a lightning-fast mixup',
    'never lets {o} breathe for a full round',
    'dashes in before {o} can even finish blocking',
  ],
  'Charge': [
    'sits on down-back and dares {o} to come in',
    'releases a stored punish the instant {o} blinks',
    'flash-kicks {o} out of a jump they regret instantly',
    'turtles until {o} cracks first',
  ],
  'Puppet': [
    'splits the screen in two with the puppet',
    'sandwiches {o} between body and shadow',
    'runs a two-front war {o} cannot track',
    'blocks with one character and attacks with the other',
  ],
  'Setplay': [
    'gets one knockdown and starts the blender',
    'layers safejump after safejump on {o}',
    'has {o} guessing on wakeup for the third time running',
    'sets the trap two moves before {o} sees it',
  ],
  'Footsies': [
    'wins the walk-forward war inch by inch',
    'whiff-punishes {o} at absolute max range',
    'makes {o} pay for every twitch of a button',
    'controls the mid-range like a metronome',
  ],
  'Mix-up': [
    'makes {o} guess wrong three times in a row',
    'goes left, right, low — {o} has no idea',
    'turns every touch into another coin flip',
    'crosses {o} up so hard the crowd gasps',
  ],
  'Glass Cannon': [
    'melts half a health bar in one touch',
    'goes all in — no defense, only violence',
    'is one clean hit from winning and one from losing',
    'converts a graze into an obscene combo',
  ],
  'All-Rounder': [
    'has an answer for every option {o} tries',
    'plays the matchup like a textbook',
    'switches gameplans mid-round without blinking',
    'quietly wins every small exchange',
  ],
  'Big Body': [
    'shrugs off the chip damage and lumbers in',
    'turns one touch into a wall splat',
    'covers half the screen with a single normal',
    'takes three hits to land one — and it is worth it',
  ],
}

// Verbs for user-authored SPECIAL moves, by move type. {m} = move name, {o} = opponent.
export const MOVE_VERBS = {
  'projectile': ['controls space with {m}', 'chips {o} down from behind {m}'],
  'melee': ['connects {m} in the scramble', 'stuffs {o} with a perfectly timed {m}'],
  'light': ['opens {o} up with a blistering {m} string', 'pecks away with {m} until something lands'],
  'heavy': ['lands a monstrous {m} — the crowd winces', 'swings {m} like a wrecking ball'],
  'set up': ['sets the stage with {m}; {o} is stuck guessing', 'plants {m} and herds {o} straight into it'],
  'trap': ['lures {o} straight into {m}', 'springs {m} the moment {o} takes a step'],
  'anti-air': ['swats {o} out of the sky with {m}', 'answers the jump with {m} on reaction'],
  'command grab': ['spins {o} down with {m}', 'reads the block and rips {o} up with {m}'],
  'counter': ['baits the button and triggers {m}', 'catches {o} clean with {m}'],
  'install': ['activates {m} — the whole tempo doubles', 'pops {m} and becomes a different character'],
  'movement': ['ghosts through the pressure with {m}', 'repositions with {m} before {o} can react'],
  'super': ['cashes out the entire meter with {m}!', 'closes the round with a cinematic {m}!'],
}

/**
 * Verbs keyed by the move's FORM, not just its type. This is what the
 * descriptor overhaul bought: a burrowing projectile and a screen-filling beam
 * are both "projectiles", and they should never describe themselves the same
 * way. Falls back to MOVE_VERBS by type for anything not listed.
 * {m} = move name, {o} = opponent.
 */
export const FORM_VERBS = {
  // --- projectiles ---
  'fireball': ['throws {m} and walks in right behind it', 'puts {m} between them and {o} and takes the ground for free'],
  'arcing lob': ['lobs {m} over the top and makes {o} look up at exactly the wrong moment', 'floats {m} in an arc {o} has to walk under'],
  'rolling': ['rolls {m} along the floor — {o} can\'t crouch under that one', 'sends {m} skidding low and {o} has to deal with it standing'],
  'burrowing': ['sinks {m} into the ground and it comes up under {o}', 'buries {m} and {o} finds out where it went the hard way'],
  'beam': ['fires {m} and the beam takes up half the screen', 'washes the screen with {m} and {o} has nowhere that isn\'t it'],
  'boomerang': ['throws {m} out — and {o} forgets it has to come back', 'sends {m} past {o}, who blocks the wrong side of it on the return'],
  'homing': ['releases {m} and it simply follows {o} wherever they go', 'lets {m} chase {o} into the corner all by itself'],
  'multi-hit': ['strings {m} into a wall of hits {o} has to sit through', 'buries {o} under {m} one pellet at a time'],
  // --- melee ---
  'straight': ['drives {m} straight down the middle', 'sticks {m} out and {o} runs into it'],
  'hooking': ['curls {m} around {o}\'s guard', 'hooks {m} in from an angle {o} isn\'t holding'],
  'spinning': ['spins into {m} and catches {o} on the way round', 'whirls {m} through the space {o} was standing in'],
  'lunging': ['closes the gap with {m} before {o} can react', 'lunges in with {m} from further out than {o} expected'],
  'rekka': ['starts {m} and just keeps going', 'runs {m} into its follow-up, then the one after that'],
  // --- lights ---
  'jab': ['pops {m} out and takes the turn back', 'checks {o} with {m}'],
  'poke': ['pecks at {o} with {m}', 'keeps {o} honest with {m}'],
  'flurry': ['buries {o} under a flurry of {m}', 'rattles off {m} until something sticks'],
  'stiff-arm': ['stiff-arms {o} away with {m}', 'shoves {m} into {o}\'s chest to make room'],
  // --- heavies ---
  'overhead smash': ['brings {m} down over the top of {o}\'s guard', 'drops {m} on {o} from above'],
  'wind-up swing': ['winds up {m} and everyone in the room sees it coming — it lands anyway', 'loads up {m} and {o} still can\'t get out of the way'],
  'body check': ['runs {m} straight through {o}', 'body-checks {o} with {m} like a door'],
  'ground pound': ['slams {m} into the floor and the shockwave gets {o}', 'pounds {m} down and {o} eats the whole thing'],
  // --- anti-airs ---
  'rising uppercut': ['rises into {m} and takes {o} out of the air', 'answers the jump with {m} on pure reaction'],
  'flip kick': ['flips into {m} and swats {o} down', 'kicks up into {m} the instant {o} leaves the ground'],
  'shoulder charge': ['drives a shoulder up into {o} with {m}', 'meets {o} in the air with {m}'],
  'air throw': ['plucks {o} out of the sky with {m}', 'catches {o} mid-jump with {m} and puts them down hard'],
  // --- command grabs ---
  'spinning piledriver': ['spins {o} into the floor with {m}', 'takes {o} up and drives them down with {m}'],
  'chokeslam': ['lifts {o} by the throat and plants them with {m}', 'chokeslams {o} through the stage with {m}'],
  'run-up snatch': ['runs {o} down and snatches them into {m}', 'closes half the screen and {m} does the rest'],
  'air grab': ['catches {o} coming down and turns it into {m}', 'snatches {o} out of the air with {m}'],
  // The universal throw is literally named "Throw", so its verbs must never
  // insert the move name — "plants them with Throw" reads like a bug.
  'basic throw': ['grabs {o} and puts them straight on the floor', 'throws {o} across the screen', 'snatches {o} up and slams them down', 'walks {o} into the corner and dumps them there'],
  // --- counters ---
  'parry': ['parries clean and answers with {m}', 'catches {o}\'s button on {m} and gives it straight back'],
  'armour absorb': ['eats the hit on {m} and keeps walking', 'armours through with {m} like it never happened'],
  'reversal throw': ['turns {o}\'s own momentum into {m}', 'reverses {o} into {m} before they finish the swing'],
  'reflect': ['sends it straight back with {m}', 'reflects {o}\'s own attack into their face with {m}'],
  // --- set ups ---
  'minion summon': ['calls something in with {m} and now {o} is fighting two of them', 'summons help with {m}'],
  'ground rune': ['burns {m} into the floor and dares {o} to step on it', 'marks the ground with {m}'],
  'lingering orb': ['leaves {m} hanging in the air over {o}', 'parks {m} on screen and lets it work'],
  'clone': ['leaves a copy behind with {m} and {o} blocks the wrong one', 'splits into {m} and {o} guesses'],
  // --- traps ---
  'bear trap': ['sets {m} and waits for {o} to forget about it', 'lays {m} exactly where {o} likes to stand'],
  'landmine': ['plants {m} in {o}\'s escape route', 'buries {m} and lets {o} find it'],
  'tripwire': ['strings {m} across the gap {o} needs', 'runs {m} through the one lane {o} had left'],
  'delayed bomb': ['sticks {m} on and starts counting', 'tags {o} with {m} and lets the clock do the work'],
  'web': ['tangles {o} up in {m}', 'webs the floor with {m} and {o} slows to a crawl'],
  // --- installs ---
  'power aura': ['lights up with {m} and the whole tempo changes', 'burns meter on {m} and becomes a problem'],
  'weapon draw': ['draws with {m} — different character from here', 'pulls out {m} and the range doubles'],
  'transformation': ['transforms with {m} and {o} is now fighting something else', 'triggers {m} and stops being the same fighter'],
  'stance change': ['switches into {m} and every answer {o} had is wrong now', 'shifts stance with {m} mid-string'],
  // --- movement ---
  'dash': ['dashes through with {m}', 'steps in behind {m} before {o} can set'],
  'teleport': ['blinks out with {m} and reappears behind {o}', 'teleports with {m} and {o} blocks empty air'],
  'air dash': ['air-dashes in with {m} from an angle nobody blocks first try', 'crosses the screen with {m} without touching the ground'],
  'roll': ['rolls through with {m} and comes up on the other side', 'rolls {m} straight past {o}\'s pressure'],
  'wall jump': ['kicks off the wall with {m} and comes down somewhere else', 'uses {m} to leave and re-enter from the wrong side'],
  // --- supers ---
  'cinematic grab': ['grabs {o} and the screen goes dark for {m}!', 'catches {o} clean and {m} takes over the whole screen!'],
  'screen-filling beam': ['fills the entire screen with {m}!', 'lets {m} go and there is nowhere on screen to be!'],
  'rushdown barrage': ['unloads {m} in one long unbroken barrage!', 'runs {o} down and cashes the bar with {m}!'],
  'unblockable slam': ['brings {m} down through the guard — blocking was never an option!', 'slams {m} home and {o} never had a button for it!'],
}

/**
 * What a rider LOOKS like when it goes off. Appended to a beat when the move
 * carries an effect clause, so a designer's choice shows up in the footage.
 */
export const EFFECT_CLAUSES = {
  'explode': ['It goes off a beat later, right where {o} landed.', 'The delayed blast catches {o} getting up.'],
  'stun the opponent': ['{o} is stood there stunned stiff — everything after that is free.', '{o}\'s eyes glaze and the next few seconds belong to somebody else.'],
  'steal meter': ['Half of {o}\'s bar goes with it.', 'And the meter {o} spent all round building changes hands.'],
  'launch into the air': ['{o} goes straight up, and the juggle starts.', 'That launches, and {o} isn\'t landing for a while.'],
  'wall bounce': ['{o} comes off the wall and straight back into it.', 'The wall bounce gives them another whole route.'],
  'break armour': ['The armour goes with it — {o} has nothing to hide behind now.', 'Armour broken. {o} is standing there open.'],
  'drain health': ['And some of that comes straight back the other way.', 'The drain tops them right back up.'],
  'teleport behind them': ['And they\'re behind {o} before the animation finishes.', '{o} turns around to find nobody there.'],
  'summon a minion': ['The help arrives, and now {o} is blocking two things at once.', 'And it brought a friend.'],
  'poison': ['{o} keeps ticking down long after the hit is over.', 'The poison sets in and {o}\'s bar keeps sliding.'],
  'freeze them in place': ['{o} is frozen where they stand.', '{o} locks up solid, and there is nothing they can do about it.'],
  'hard knockdown': ['{o} goes down hard — no quick rise from that.', 'Hard knockdown. {o} is getting up exactly when they\'re allowed to.'],
  'build extra meter': ['And the bar jumps a full stock for it.', 'That paid for itself in meter alone.'],
  'become invincible': ['They stroll through the counterattack untouched.', 'Whatever {o} threw back went straight through them.'],
}

// Stream chat: throwaway account names, assembled at random.
export const CHAT_NAME_PARTS = {
  a: ['salt', 'frame', 'plink', 'wave', 'tech', 'oki', 'combo', 'fuzzy', 'mash', 'neutral', 'pixel', 'clutch', 'downback', 'crossup', 'meaty'],
  b: ['lord', 'gamer', 'fan', 'enjoyer', 'watcher', 'demon', 'goblin', 'sensei', 'main', 'truther', 'zone', 'god'],
  c: ['', '', '99', '420', '_ttv', '2k', '_fgc', 'xx', '_vods', '77'],
}

export const CHAT_LINES = {
  // `hype` is venue-neutral on purpose: it plays under EVO too, where "this
  // arcade always delivers" would be chat congratulating the wrong building.
  // The channel-flavored lines live in `hypeArcade` and only air on YOUR
  // streams.
  hype: [
    'LETS GOOOO', 'CLIP IT. CLIP IT NOW', 'no way lol',
    'chat is this real', 'I was here', '🔥🔥🔥',
    'the FOOTSIES', 'my popoff radar is going crazy',
    'good pace this set', 'both playing smart honestly',
  ],
  hypeArcade: [
    'this arcade always delivers', 'W stream', 'this is why I follow this channel',
    'best channel on the platform and it is not close', 'the cabinet cam is so cozy',
  ],
  // The comeback arc: somebody was one hit from dead and started COOKING.
  // These get spammed in a burst, because that is what chat actually does.
  comeback: [
    'oh my god', 'no way', 'is this really happening?', 'IS THIS REAL',
    'THEY HAVE NO HEALTH AND THEY DONT CARE', 'do not go to the fridge. do NOT go to the fridge',
    'im shaking', 'HOW', 'one pixel and cooking', 'the comeback is ON',
    'nobody breathe', 'WE ARE SO BACK', 'I called it (I did not call it)',
  ],
  // A super or a huge conversion just landed.
  bigHit: [
    'THE DAMAGE', 'HALF THE BAR???', 'that was disrespectful', 'they just DELETED them',
    'ok that one hurt ME', 'the whole cabinet shook', 'somebody clip that RIGHT NOW',
  ],
  blockedOut: [
    'the DEFENSE', 'blocking everything like it owes them money', 'that guard is a wall',
    'how do you block all that', 'patience of a monk',
  ],
  close: [
    'either one of them takes this, seriously', 'my HEART', 'I cannot watch',
    'both of them are locked in', 'last hit vibes already', 'this set is a movie',
    'whoever loses this is gonna be sick about it',
  ],
  playerRef: [
    '{p} is cracked', '{p} has them fully downloaded', '{p} woke up and chose violence',
    'how does {p} keep getting away with this', '{p} is different today',
    '{p} looking comfortable', 'been watching {p} improve for weeks now',
  ],
  moveReact: [
    'that {m} looked ILLEGAL', 'the {m}!! again!!', 'how do you even block {m}',
    '{m} is such a stylish call', 'clip the {m} please', 'they had the {m} loaded the whole time',
  ],
  gameWin: [
    '{p} takes it', 'okay, we have a set on our hands', 'answer back time',
    'adjustments incoming, watch', 'momentum check',
  ],
  winnerBurst: [
    '{w} TOO CLEAN', 'ggs', '{w} run it back', 'never a doubt ({w} fan since today)',
    '{w} clears', 'good set honestly', 'that closeout was cold',
  ],
  upsetSevere: [
    'HUGE UPSET', 'BRACKET DEMON SPOTTED', 'they were NOT supposed to win that',
    'somebody check the odds on that one', 'I need a minute. what did I just watch',
  ],
  upsetMild: [
    "didn't see that coming honestly", 'huh. respect though', 'quiet little upset there',
    'odds said otherwise but ok', 'underdog stuff, love to see it',
  ],
  evo: [
    'the whole world is watching rn', 'EVO MOMENT???', 'crowd is SHAKING',
    'imagine being there live', 'this is the biggest stage in the game',
  ],
  newViewer: [
    'found this stream from a clip lol', 'what game is this? looks sick',
    'how long has this arcade been streaming?', 'cozy stream tbh', '!uptime',
    'small stream but the games are good??', 'algorithm brought me here, staying for this',
  ],
}

export const CATCHPHRASES = [
  'Too easy!', 'Run it back.', "That's the gap.", 'Study the tape!', "Don't blink.",
  'Absolutely free.', 'On my screen, you lose.', 'Lab hours pay off.', 'Respect the process.',
  'GGs only.', 'Call an ambulance — but not for me.', 'Downloaded.', 'Read like a book.',
  'Who else?', 'The king stays the king.', 'Another day at the office.',
]

export const APPEARANCES = [
  'always wears a faded esports hoodie', 'has dyed hair that changes color monthly',
  'never takes off their headphones', 'wears fingerless gloves unironically',
  'tall and lanky with a permanent slouch', 'short with incredible posture',
  'brings their own arcade stick everywhere', 'covered in fighting game pins',
  'wears prescription glasses taped at the hinge', 'has a lucky bandana',
  'dresses sharp like they came from an office', 'wears the same tournament tee every day',
]
