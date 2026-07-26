// Registry of local sub-maps, keyed by location slug (the filename in
// src/content/locations/). A sub-map page is only built — and only linked
// from the region map — once its location's status is `visited`, so maps
// for undiscovered places can live here without appearing on the site.

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
}

export interface SubmapEntry {
  Component: any;
  width: number;
  height: number;
  scaleNote?: string;
  legend: SubmapLegendItem[];
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
      { label: 'Lionshield Coster', note: 'arms and armor' },
      { label: "Phandalin Miner's Exchange", note: 'Guildmaster Thornton. Mind the crossbows.' },
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
      { label: 'The sacrifice chamber', note: 'described in the ledger: dark, flanked by two statues. Unreached.' },
    ],
  },
  'umbrage-hill': {
    Component: UmbrageHill,
    width: 900,
    height: 573,
    scaleNote: 'The map spans about 400 feet across',
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
    legend: [
      { label: 'The gatehouse', note: 'murder-slits, twin bastions, one portcullis' },
      { label: 'The great hall', note: 'four pillars of dwarven stonework' },
      { label: 'The feast hall', note: 'twin thrones, long cold' },
      { label: 'Natural caverns', note: 'something has moved in below' },
      { label: 'Audience chamber', note: 'the upper seat of the hold' },
      { label: 'Dormitories', note: 'bunk rooms off the south gallery' },
    ],
  },
  'butterskull-ranch': {
    Component: ButterskullRanch,
    width: 900,
    height: 560,
    scaleNote: 'The ranch spans about a quarter mile',
    legend: [
      { label: 'The farmhouse', note: "home of Alfonse 'Big Al' Kalazorn" },
      { label: 'Destroyed barn', note: 'something tore through here' },
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
      { label: 'Cave mouths', note: 'burrows worm beneath the hill' },
    ],
  },
  'dragon-barrow': {
    Component: DragonBarrow,
    width: 900,
    height: 560,
    scaleNote: 'The mound and the catacombs beneath it',
    legend: [
      { label: 'The burial mound', note: 'shaped like something with wings' },
      { label: 'Secret entrance', note: 'hidden among the spine-stones' },
      { label: 'The catacombs', note: 'a spiral stair at the heart of it' },
      { label: 'Tomb chambers', note: 'sarcophagi in the alcoves' },
      { label: 'Warded corridors', note: 'old traps, still armed' },
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
      { label: 'The great courtyard', note: 'open to the sky — and to wings' },
      { label: 'The keep', note: 'halls and chambers of the old garrison' },
      { label: 'The roof', note: 'a throne with a view, for something large' },
      { label: 'The undercroft', note: 'cold tombs beneath the keep' },
    ],
  },
  'loggers-camp': {
    Component: LoggersCamp,
    width: 900,
    height: 560,
    scaleNote: 'A timber camp on the riverbank',
    legend: [
      { label: 'The pier', note: 'timber floats downstream from here' },
      { label: 'The bunkhouse', note: 'something erupted through the floor' },
      { label: 'Tent rows', note: "the loggers' camp proper" },
      { label: 'Churned earth', note: 'eruption mounds pock the clearing' },
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
      { label: 'The great gallery', note: 'heart of the diggings' },
      { label: 'Deep galleries', note: 'something dens in the dark east halls' },
      { label: 'East entrance', note: 'quieter. Too quiet.' },
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
      { label: 'The belfry hole', note: 'a gap in the ceiling — a way up, or down' },
      { label: 'The standing tower', note: 'the only whole corner. Occupied?' },
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
      { label: 'Sea caves', note: 'something dens in the rocks' },
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
      { label: 'The courtyard', note: 'the vines in there are not still' },
      { label: 'The round tower', note: 'the last sound structure' },
      { label: 'Berry thickets', note: 'tempting. Watched.' },
    ],
  },
};
