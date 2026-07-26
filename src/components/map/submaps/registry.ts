// Registry of local sub-maps, keyed by location slug (the filename in
// src/content/locations/). A sub-map page is only built — and only linked
// from the region map — once its location's status is `visited`, so maps
// for undiscovered places can live here without appearing on the site.
//
// The geometry is traced from the official sheets by
// scripts/trace_local_maps.py and written to ./traced/<slug>.ts. Nothing in
// this file is drawn by hand: to change a map, edit scripts/local-maps.json
// and re-run the script. The numbered markers and the map's key are the same
// list — a map's `pois`, authored in that config.

import type { TracedMap } from './traced/types';

import axeholm from './traced/axeholm';
import butterskullRanch from './traced/butterskull-ranch';
import circleOfThunder from './traced/circle-of-thunder';
import dragonBarrow from './traced/dragon-barrow';
import dwarvenExcavation from './traced/dwarven-excavation';
import falconsHuntingLodge from './traced/falcons-hunting-lodge';
import gnomengarde from './traced/gnomengarde';
import icespireHold from './traced/icespire-hold';
import loggersCamp from './traced/loggers-camp';
import mountainsToeGoldMine from './traced/mountains-toe-gold-mine';
import phandalin from './traced/phandalin';
import shrineOfSavras from './traced/shrine-of-savras';
import towerOfStorms from './traced/tower-of-storms';
import umbrageHill from './traced/umbrage-hill';
import woodlandManse from './traced/woodland-manse';

export const submaps: Record<string, TracedMap> = {
  phandalin,
  gnomengarde,
  'dwarven-excavation': dwarvenExcavation,
  'umbrage-hill': umbrageHill,

  // ---- Not yet discovered: these render nowhere until their location's
  // status flips to `visited` in src/content/locations/.
  axeholm,
  'butterskull-ranch': butterskullRanch,
  'circle-of-thunder': circleOfThunder,
  'dragon-barrow': dragonBarrow,
  'falcons-hunting-lodge': falconsHuntingLodge,
  'icespire-hold': icespireHold,
  'loggers-camp': loggersCamp,
  'mountains-toe-gold-mine': mountainsToeGoldMine,
  'shrine-of-savras': shrineOfSavras,
  'tower-of-storms': towerOfStorms,
  'woodland-manse': woodlandManse,
};
