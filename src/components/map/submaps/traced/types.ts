// Shape of the traced geometry emitted by scripts/trace_local_maps.py.

export interface TracedPoi {
  /** Key entry this marker belongs to; markers are numbered by array order. */
  label: string;
  note?: string;
  /** Ember marker — reserved for real threats, per the design system. */
  danger?: boolean;
  /** Where the marker sits. Absent for an entry the sheet doesn't pin down —
   *  it keeps its number in the key and goes unmarked on the map. */
  x?: number;
  y?: number;
}

export interface TracedMap {
  /** `dungeon` sheets are floor-and-wall; `town` sheets are painted overland. */
  kind: 'dungeon' | 'town';
  width: number;
  height: number;
  /** Feet per canvas unit, measured off the sheet's grid. Null if unmeasured. */
  feetPerUnit: number | null;
  pois: TracedPoi[];

  // Every layer is one path holding all of its contours, holes included, so
  // each is drawn with fill-rule: evenodd. Which layers exist depends on kind.

  /** Walkable floor (dungeon). */
  floor?: string;
  /** Dark linework inside the structures: walls, pillars, stairs, rubble. */
  ink?: string;
  /** Streets and squares (town). */
  roads?: string;
  /** Building footprints (town). */
  buildings?: string;
  /** Woodland canopy (town). */
  woods?: string;
  /** Ponds and streams (town). */
  water?: string;
}
