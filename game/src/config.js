// Neon Harbor — shared tuning: the city grid, the palette, the people and the story.
// Everything in the game reads its numbers from here so the world stays coherent.

export const CITY = {
  blocks: 8,          // building pads per axis
  pitch: 58,          // metres between street centrelines
  roadWidth: 15,      // asphalt width of every street
  sidewalk: 3.2,      // pavement border around each pad
  get half() { return (this.blocks * this.pitch) / 2; },  // streets run -half..+half
  beachX: 268,        // sand starts east of here
  waterX: 300,        // open water starts east of here
  worldEdge: 520,     // playable clamp for the player
};

export const COLORS = {
  sky: 0x8ecfe8,
  fog: 0xa8d4e6,
  sun: 0xffe3b3,
  asphalt: 0x3d454e,
  asphaltLine: 0xf5d76e,
  sidewalk: 0xb9c0bd,
  pad: 0x9db08f,
  sand: 0xeed9a4,
  water: 0x1e7f9e,
  waterDeep: 0x14607e,
  palmTrunk: 0x8a6844,
  palmLeaf: 0x3f9e4d,
  playerShirt: 0xff6b5e,
  policeBody: 0xf2f4f6,
  policeTrim: 0x1c2f4a,
};

export const TUNING = {
  walkSpeed: 6.2,
  runSpeed: 10.5,
  playerRadius: 0.55,
  carRadius: 2.3,
  trafficCount: 20,
  parkedCount: 26,
  pedCount: 42,
  policePerStar: 1.6,   // squad cars scale with the wanted level
  bustSeconds: 2.6,     // standing still beside police this long ends the chase
  wantedDecaySeconds: 14,
  hideoutClearRadius: 7,
};

export const PLACES = {
  // Named spots the story and the systems use. x east, z south, y up.
  marina: { x: 238, z: 150, name: 'Coral Marina' },
  docks: { x: 246, z: -140, name: 'Ferris Freight Docks' },
  club: { x: -196, z: 58, name: 'Club Sable' },
  hideout: { x: -232, z: -204, name: 'Breakwater Garage' },
  hospital: { x: -58, z: -232, name: 'Harbor General Hospital' },
  policeStation: { x: 58, z: 232, name: 'Neon Harbor Police — Central' },
  goldCarSpot: { x: 116, z: -58, name: 'Palm Court' },
};

export const STORY = {
  intro: {
    name: 'SABLE — CLUB SABLE, ON THE PHONE',
    text: 'Jett. You made it to Neon Harbor. I run the jobs in this town and you drive like nobody else, ' +
      'so here is the deal: do the work, bank the cash, and the city is yours. First run is simple — ' +
      'Old Ferris left a package at his freight docks. Fetch it, bring it to my club. Try not to scratch the paint.',
  },
  missions: [
    {
      id: 'first-run',
      title: 'FIRST RUN',
      giver: 'SABLE',
      brief: 'Ferris swears the package is legal. Ferris also swears he invented the moon. Pick it up at the docks, bring it home to Club Sable.',
      reward: 500,
    },
    {
      id: 'neon-circuit',
      title: 'NEON CIRCUIT',
      giver: 'SABLE',
      brief: 'A collector named Ivo is timing drivers tonight. Hit every checkpoint before the clock dies and he pays in cash, no questions. Show him what a Harbor driver looks like.',
      reward: 800,
    },
    {
      id: 'hot-property',
      title: 'HOT PROPERTY',
      giver: 'SABLE',
      brief: 'There is a gold Komodo GT sitting at Palm Court with someone else\'s name on the papers. Bring it to the Breakwater Garage. The owner will call it in, so expect company — three stars of it.',
      reward: 1500,
    },
  ],
  outro: {
    name: 'SABLE — CLUB SABLE',
    text: 'That is the Harbor way, Jett. The crew eats tonight because of you. The city is open now: ' +
      'delivery boards pop up all over town, and they pay by the mile. Stay fast, stay free.',
  },
  jobGivers: ['Sable', 'Ferris', 'Ivo the Collector', 'Marisol at the Marina', 'Big Tuna', 'The Night Clerk'],
};

export const CAR_MODELS = [
  { name: 'Komodo GT', topSpeed: 46, accel: 26, grip: 3.4, colors: [0xd94848, 0x2e6fd8, 0xf2b13d, 0x37b06f, 0xe8e8ec, 0x30343c] },
  { name: 'Pelican Wagon', topSpeed: 36, accel: 20, grip: 3.0, colors: [0x7fb3d5, 0xc0c6cc, 0x8e6fc8, 0xd97b29] },
  { name: 'Sunset Cabrio', topSpeed: 42, accel: 24, grip: 3.2, colors: [0xff7e47, 0xffd23d, 0x47c2ff, 0xff5e8a] },
  { name: 'Harbor Hauler', topSpeed: 32, accel: 17, grip: 2.6, colors: [0x9aa5ad, 0x5d737e, 0xb5533c] },
];

export const SAVE_KEY = 'neon-harbor-save-v1';
