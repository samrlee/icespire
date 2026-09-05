// Registry of local sub-maps, keyed by location slug (the filename in
// src/content/locations/). A sub-map page is only built — and only linked
// from the region map — once its location's status is `visited`, so maps
// for undiscovered places can live here without appearing on the site.
//
// These maps are player-facing, so they carry only what the party could see
// standing in the place: terrain, structures, visible damage. What stays off
// them — off the drawing, the tooltips, the legend, and the source comments,
// which ship to the browser — is anything only the DM knows:
//
//   * secret doors (marked `s`), hidden passages, concealed entrances;
//   * traps, and rooms nobody has reached;
//   * creatures, lairs, and hints that something is denned in, watching, or
//     about to come through the floor;
//   * the `danger` class on a point of interest, which paints it ember.
//
// A secret or a threat earns its place on the map on the day the party finds
// it in play, and not before — the maps for undiscovered places publish the
// moment their status flips, so they have to be safe to read now.
//
// Interiors work the same way, and the gate is the location's `interiorSeen`.
// A sub-map for a place the party has only stood outside of draws its
// approach — terrain, walls, the shell of a building, the mouth of a mine —
// and withholds what is behind the door. Points of interest inside are
// flagged `interior` below and are dropped from the drawing and from the Key
// together; the Key numbers its lines explicitly, so a dropped one does not
// renumber the rest.

import Phandalin from './Phandalin.astro';
import Gnomengarde from './Gnomengarde.astro';
import DwarvenExcavation from './DwarvenExcavation.astro';
import UmbrageHill from './UmbrageHill.astro';
import Axeholm from './Axeholm.astro';
import ButterskullRanch from './ButterskullRanch.astro';
import CircleOfThunder from './CircleOfThunder.astro';
import DragonBarrow from './DragonBarrow.astro';
import FalconsHuntingLodge from './FalconsHuntingLodge.astro';
import IcespireHold from './IcespireHold.astro';
import LoggersCamp from './LoggersCamp.astro';
import MountainsToeGoldMine from './MountainsToeGoldMine.astro';
import ShrineOfSavras from './ShrineOfSavras.astro';
import TowerOfStorms from './TowerOfStorms.astro';
import WoodlandManse from './WoodlandManse.astro';

export interface SubmapLegendItem {
  label: string;
  note?: string;
  // Marks a point of interest that sits inside the place. It is drawn, and
  // listed here, only for a location whose `interiorSeen` is true; otherwise
  // both the marker and this line are withheld. The Key numbers its entries
  // explicitly, so dropping one does not renumber the rest.
  interior?: boolean;
}

export interface SubmapEntry {
  Component: any;
  width: number;
  height: number;
  scaleNote?: string;
  legend: SubmapLegendItem[];
  // Set where the place has no outside worth drawing — a hold cut into a
  // mountain is a shut gate and nothing else until someone is through it.
  // Such a map waits for `interiorSeen` rather than publishing as a blank.
  interiorOnly?: boolean;
}

// Does this location publish a local map page? Visited, drawn, and — for a
// map that is all interior — actually entered. The region map, the map page
// and its sibling links all ask this, so they can never disagree.
export function hasSubmapPage(loc: {
  id: string;
  data: { status: string; interiorSeen?: boolean };
}): boolean {
  if (loc.data.status !== 'visited') return false;
  const entry = submaps[loc.id];
  if (!entry) return false;
  return !entry.interiorOnly || loc.data.interiorSeen === true;
}

export const submaps: Record<string, SubmapEntry> = {
  phandalin: {
    Component: Phandalin,
    width: 900,
    height: 650,
    scaleNote: 'The town spans about a third of a mile',
    legend: [
      { label: 'Stonehill Inn', note: 'rooms, stew, and the stranger who watched the party in Session 1' },
      { label: "Barthen's Provisions", note: 'general goods' },
      { label: 'Lionshield Coster', note: 'arms and armor; never open when the party has time to shop' },
      { label: "Phandalin Miner's Exchange", note: 'Guildmaster Thornton. A trap door in the floor, and stairs under the town.' },
      { label: "Townmaster's Hall", note: "Harbin's office, behind several bolts" },
      { label: "Harbin Wester's home", note: "site of Bean's unauthorized visit" },
      { label: 'Shrine of Luck', note: "Tymora's small shrine on the square" },
    ],
  },
  gnomengarde: {
    Component: Gnomengarde,
    width: 900,
    height: 580,
    scaleNote: 'The warren spans about 350 feet',
    legend: [
      { label: 'The grotto pool', note: 'mushroom farm on the isles' },
      { label: 'Rope bridge & waterfall', note: 'goop-covered; crossed anyway' },
      { label: 'Throne room', note: 'hidden passage, peephole, paranoid king' },
      { label: 'Royal chambers', note: 'where Queen Gnerkli was found tied up' },
      { label: 'The ballista workshop', note: 'Facktoré field-tested it on Thom' },
      { label: 'Storage room', note: 'two mimics, both dealt with' },
      { label: 'The wheel room', note: 'a gnomish contraption, purpose unclear' },
    ],
  },
  'dwarven-excavation': {
    Component: DwarvenExcavation,
    width: 900,
    height: 560,
    scaleNote: 'The site spans about 400 feet',
    legend: [
      { label: "The dwarves' camp", note: 'Norbus & Dazlyn — stripped bare and abandoned in Session 6' },
      { label: 'Buried settlement', note: "ruins under Abbathor's avalanche" },
      { label: 'The broken gate', note: 'black stone, long since shattered' },
      { label: 'Entrance hall', note: 'the funnel — seven orcs came through it one and two at a time' },
      { label: 'Main chamber', note: 'the jelly fight; a pillar base hid the gemstone coffer' },
      { label: 'Rubble hallway', note: 'behind the north secret door — the last jelly, and a third secret door beyond it' },
      { label: 'South passage', note: 'ends in rubble, beside a dead dwarf and the temple ledger' },
      { label: 'The crypt', note: "a skeleton wearing Abbathor's holy symbol — “Greed is good”" },
      { label: 'The vestry', note: 'two dwarves in red vestments, a font dry for centuries, and a fourth secret door' },
      { label: 'Sleeping chamber', note: 'three bed frames, a crushed body, and a longsword that never rotted' },
      { label: 'The cave-in', note: 'floor to ceiling, packed tight — an hour of digging barely dented it' },
    ],
  },
  'umbrage-hill': {
    Component: UmbrageHill,
    width: 900,
    height: 570,
    scaleNote: 'The hilltop spans about 350 feet',
    legend: [
      { label: "Adabra Gwynn's windmill", note: 'the potions brew here and nowhere else' },
      { label: 'Ruined outbuilding', note: 'old garden walls; cover during the manticore fight' },
      { label: 'The boulder field', note: 'manticore country' },
    ],
  },

  // ---- Not yet discovered: these render nowhere until their location's
  // status flips to `visited` in src/content/locations/.
  axeholm: {
    Component: Axeholm,
    width: 900,
    height: 560,
    scaleNote: 'Two levels carved into the mountain',
    interiorOnly: true,
    legend: [
      { label: 'The gatehouse', note: 'murder-slits, twin bastions, one portcullis' },
      { label: 'The great hall', note: 'four pillars of dwarven stonework', interior: true },
      { label: 'The feast hall', note: 'twin thrones, long cold', interior: true },
      { label: 'Natural caverns', note: 'caves opening off the lower halls', interior: true },
      { label: 'Audience chamber', note: 'the upper seat of the hold', interior: true },
      { label: 'Dormitories', note: 'bunk rooms off the south gallery', interior: true },
    ],
  },
  'butterskull-ranch': {
    Component: ButterskullRanch,
    width: 900,
    height: 560,
    scaleNote: 'The ranch spans about a quarter mile',
    legend: [
      { label: 'The farmhouse', note: "home of Alfonse 'Big Al' Kalazorn" },
      { label: 'Destroyed barn', note: 'what is left of it' },
      { label: 'Destroyed smithy', note: 'the forge fared no better' },
      { label: 'The pasture', note: 'prize cattle — the famous butter' },
    ],
  },
  'circle-of-thunder': {
    Component: CircleOfThunder,
    width: 900,
    height: 560,
    scaleNote: 'A bald hilltop deep in the wood',
    legend: [
      { label: 'The stone ring', note: 'thunder rolls out of it on clear days' },
      { label: 'Fallen arches', note: 'older than the stones, maybe' },
      { label: 'Cave mouths', note: 'openings in the hillside' },
    ],
  },
  'dragon-barrow': {
    Component: DragonBarrow,
    width: 900,
    height: 560,
    scaleNote: 'The mound and the catacombs beneath it',
    legend: [
      { label: 'The burial mound', note: 'shaped like something with wings' },
      { label: 'The catacombs', note: 'a spiral stair at the heart of it', interior: true },
      { label: 'Tomb chambers', note: 'sarcophagi in the alcoves', interior: true },
    ],
  },
  'falcons-hunting-lodge': {
    Component: FalconsHuntingLodge,
    width: 900,
    height: 560,
    scaleNote: 'A walled lodge on the river',
    legend: [
      { label: 'Bridge & gatehouse', note: 'the only way across the river' },
      { label: 'The main lodge', note: "Falcon's hall — game on the fire" },
      { label: 'The watchtower', note: 'stone, with a spiral stair' },
      { label: 'Kennels & pens', note: 'the hounds announce visitors' },
      { label: 'The barracks', note: 'bunks for the hunting parties' },
    ],
  },
  'icespire-hold': {
    Component: IcespireHold,
    width: 900,
    height: 560,
    scaleNote: 'A fortress high beside the peak',
    legend: [
      { label: 'The gatehouse', note: 'first stop on the icy path' },
      { label: 'The bridge', note: 'a narrow span over a long drop' },
      { label: 'The great courtyard', note: 'open to the sky' },
      { label: 'The keep', note: 'halls and chambers of the old garrison', interior: true },
      { label: 'The roof', note: 'open stone above the keep', interior: true },
      { label: 'The undercroft', note: 'cold tombs beneath the keep', interior: true },
    ],
  },
  'loggers-camp': {
    Component: LoggersCamp,
    width: 900,
    height: 560,
    scaleNote: 'A timber camp on the riverbank',
    legend: [
      { label: 'The pier', note: 'timber floats downstream from here' },
      { label: 'The bunkhouse', note: 'bunks for the crew' },
      { label: 'Tent rows', note: "the loggers' camp proper" },
      { label: 'Churned earth', note: 'broken ground across the clearing' },
      { label: 'Old foundations', note: 'an earlier camp, long gone' },
    ],
  },
  'mountains-toe-gold-mine': {
    Component: MountainsToeGoldMine,
    width: 900,
    height: 560,
    scaleNote: 'Galleries with west and east entrances',
    legend: [
      { label: 'West entrance', note: "the miners' way in" },
      { label: 'The great gallery', note: 'heart of the diggings', interior: true },
      { label: 'Deep galleries', note: 'the east workings, unlit', interior: true },
      { label: 'East entrance', note: 'the far way in' },
    ],
  },
  'shrine-of-savras': {
    Component: ShrineOfSavras,
    width: 900,
    height: 560,
    scaleNote: 'A walled compound gone to ruin',
    legend: [
      { label: 'The gatehouse', note: 'the old north gate' },
      { label: 'The shrine', note: 'a cross-shaped hall to the All-Seeing' },
      { label: 'The belfry hole', note: 'a gap in the ceiling — a way up, or down', interior: true },
      { label: 'The standing tower', note: 'the only whole corner' },
    ],
  },
  'tower-of-storms': {
    Component: TowerOfStorms,
    width: 900,
    height: 560,
    scaleNote: 'A headland lighthouse ringed by wrecks',
    legend: [
      { label: 'The tower', note: 'its beacon has been dark for years' },
      { label: 'The wrecks', note: 'the reefs collect ships' },
      { label: 'Sea caves', note: 'openings in the rocks at the waterline' },
      { label: 'The causeway', note: 'a wave-swept scramble from shore' },
    ],
  },
  'woodland-manse': {
    Component: WoodlandManse,
    width: 900,
    height: 560,
    scaleNote: 'A ruin the wood is reclaiming',
    legend: [
      { label: 'The manse', note: 'a manor the wood is taking back' },
      { label: 'The courtyard', note: 'overgrown, open to the sky', interior: true },
      { label: 'The round tower', note: 'the last sound structure' },
      { label: 'Berry thickets', note: 'berries along the forest edge' },
    ],
  },
};
