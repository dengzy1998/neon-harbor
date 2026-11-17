// config.js — every shared constant for Neon Harbor: the city grid, the
// palette, the tuning numbers for driving / heat / police, and the original
// names and story text the missions speak. One place to tune the whole game.

// --- City grid -------------------------------------------------------------
// Streets run along these world coordinates on both axes; the blocks between
// them hold the buildings. The harbour (boardwalk, docks, beach, sea) lies
// south of the last street, past PROMENADE_Z.
export const ROAD_LINES = [-160, -120, -80, -40, 0, 40, 80, 120, 160];
export const ROAD_HALF = 7; // asphalt half-width; sidewalks sit just outside
export const SIDEWALK = 4;
export const CITY_EDGE = 186; // streets end here; buildings never pass it
export const PROMENADE_Z = 176; // boardwalk strip south of the last street
export const BEACH_Z = 196; // sand from here to the waterline
export const WATER_Z = 210; // open sea beyond this line
export const WORLD_SEED = 20261117;

// --- Palette ---------------------------------------------------------------
export const COLORS = {
  sky: 0x9fd9f2,
  fog: 0xbfe3f2,
  sun: 0xfff1d6,
  asphalt: 0x35393f,
  asphaltLine: 0xf5d76e,
  sidewalk: 0xbdb6a6,
  boardwalk: 0x9a6b4f,
  sand: 0xeed9a4,
  sea: 0x14919b,
  seaDeep: 0x0d6e7d,
  grass: 0x77b255,
  facade: [0xf6c390, 0xf2f0eb, 0xa8d8ea, 0xf7a8b8, 0xb5e7a0, 0xf9e076, 0xffc09f, 0xd5aaff],
  roofTrim: [0x22d3ee, 0xf471b5, 0xfbbf24, 0x34d399, 0x818cf8],
  policeBody: 0xf2f4f6,
  policeTrim: 0x1d4ed8,
};

// --- Player / driving tuning ------------------------------------------------
export const PLAYER = {
  walkSpeed: 5.2,
  runSpeed: 8.6,
  radius: 0.55,
  maxHealth: 100,
  punchRange: 1.9,
  enterRange: 3.4,
};
export const CAR = {
  accel: 15,
  brake: 26,
  drag: 0.55,
  maxReverse: 9,
  radius: 1.75,
  crashSpeed: 21, // hitting a building faster than this hurts
};

// --- Wanted / police tuning ---------------------------------------------------
export const HEAT = {
  max: 500,
  perStar: 100,
  stealCar: 70,
  stealWitnessedBonus: 30,
  hitPed: 85,
  hitCar: 30,
  punchPed: 55,
  scrapeBuilding: 12,
  decayPerSecond: 5, // while no officer can see the player
  sightRange: 72,
};
export const POLICE = {
  maxUnits: 6,
  topSpeed: 31,
  accel: 17,
  shootStars: 3,
  shootRange: 27,
  shootDamage: 4,
  shootInterval: 1.15,
  bustFillSeconds: 2.6, // standing close and slow this long gets you busted
  bustRange: 6.5,
};

// --- Places (world positions the story uses) ---------------------------------
export const PLACES = {
  spawn: { x: -18, z: 168 }, // on the boardwalk, facing the marina
  docks: { x: -128, z: 182 }, // freight docks, south-west waterfront
  club: { x: 84, z: -46 }, // Club Velvetine, east side
  garage: { x: 128, z: 116 }, // Otto's Garage, south-east
  policeStation: { x: -52, z: -148 },
  hospital: { x: 46, z: -148 },
  hideout: { x: 132, z: 124 }, // the garage back lot, mission 3 destination
};

// --- Names and story -----------------------------------------------------------
export const NAMES = {
  city: 'Neon Harbor',
  hero: 'Reyes Solano',
  fixer: 'Mara Voss',
  mechanic: 'Otto Lindqvist',
  clubOwner: 'Dario Fenn',
  club: 'Club Velvetine',
  garage: "Otto's Garage",
  hospital: 'St. Coral General',
  police: 'Neon Harbor Police',
};

export const STORY = {
  intro: {
    who: NAMES.fixer,
    text: 'Reyes. You owe me two favours and I am done waiting. Start small: a package is sitting on the freight docks, and Dario at Club Velvetine wants it before sunset. Bring it to him clean and we talk money.',
  },
  afterFirst: {
    who: NAMES.fixer,
    text: 'Clean work. Now something louder. The Neon Circuit is an unsanctioned sprint the harbour kids run at dusk — six lights, one clock. Win it and the whole waterfront learns your name.',
  },
  afterSecond: {
    who: NAMES.mechanic,
    text: 'Otto here. A gold Komodo GT just rolled off a transporter at the docks and its owner is... let us say fictional. Drive it to my back lot. The police will object. That is the job.',
  },
  afterThird: {
    who: NAMES.fixer,
    text: 'You are officially a harbour legend, Reyes. Debts cleared. The city is yours now — Mara will keep sending delivery work your way whenever you want it.',
  },
};

export const MISSIONS = [
  {
    id: 'package',
    title: 'First Errand',
    giver: NAMES.fixer,
    brief: 'Pick up the package at the freight docks.',
    reward: 600,
  },
  {
    id: 'circuit',
    title: 'Neon Circuit',
    giver: NAMES.fixer,
    brief: 'Run the six circuit lights against the clock.',
    reward: 900,
    timeLimit: 105,
  },
  {
    id: 'hotcar',
    title: 'Hot Property',
    giver: NAMES.mechanic,
    brief: 'Steal the gold Komodo GT at the docks and deliver it to Otto\u2019s back lot.',
    reward: 1500,
  },
];

export const SAVE_KEY = 'neon-harbor-save-v1';
