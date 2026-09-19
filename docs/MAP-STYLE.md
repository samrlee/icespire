# The maps' hand

How maps are drawn on this site. Five maps are the model: the Sword Coast
region sheet and the local maps for Phandalin, Gnomengarde, Dwarven Excavation,
and Umbrage Hill. Read the component closest to the map you are changing before
drawing anything, beside its scan in `offical-assets/Maps/`.

Eleven local maps are still in the repo in the old style, waiting for enough
of their locations to be explored (see [The maps still to draw](#the-maps-still-to-draw)).
Before one of their local maps publishes, its placeholder component **and registry entry**
get replaced using this guide. Never reveal a placeholder by flipping a
publication gate: the old drawings are neither accurate nor audited
for player knowledge.

## Before drawing

1. Read the location, journey, and session content that establishes exactly
   what the party saw. Make two lists: visible exterior facts, and reached
   interior facts. If the record is ambiguous, withhold the feature.
2. Find the exact scan in [The maps still to draw](#the-maps-still-to-draw).
   Treat it as DM reference material: inspect it to trace geometry, but do not
   transfer its labels or encounter information into player-facing code.
3. Open the nearest model component and its rules in the `.ref-map` section of
   `src/styles/global.css`. Use Phandalin for a settlement, Umbrage Hill for an
   exterior, and Gnomengarde or Dwarven Excavation for a gridded interior.
4. Leave the location unpublished while working. Replace the component,
   dimensions, scale note, and legend as one change; only then update `status`
   or `interiorSeen`.

The unpublished placeholders are inventory, not source material. Do not copy
their invented geometry, approximate scale notes, tooltips, or legends into a
redraw. Start from the official scan and the campaign record.

## The one rule

**Trace the official map. Draw it in our ink.**

Both halves are load-bearing, and the second one is not permission to loosen
the first. The maps this site shipped before September 2026 were *illustrations
inspired by* the module's maps: a round knoll where the scan has a double-S
contour sweep, eight boulders arranged pleasingly, a fence drawn as a circle
with a gap in it, and a scale bar reading "≈ 50 feet" under a layout that had
no scale at all. They looked fine and they were fiction. A player who had the
real map in front of them could not have used ours to find anything.

So: geometry comes off the scan, measured. Style comes from the design system.
Nothing is composed to taste, and nothing is copied that the party has not
earned.

## Setting the coordinate space

Do this before drawing a single path. Everything downstream depends on it.

**Scale the whole sheet uniformly into the drawing space. Never crop, never
stretch, never fit a region "close enough".** The space is the scan's own
proportions at a convenient size:

| Map | Scan | Space | Unit |
| --- | --- | --- | --- |
| Sword Coast | 2105 × 2933 | 1344 × 1872 | 1 hex = 5 miles (radius 35) |
| Phandalin | 2550 × 1830 | 1872 × 1344 | 500-ft scale bar spans 778 units |
| Gnomengarde | 2888 × 1838 | 1960 × 1248 | 29.4 units = 5 feet |
| Dwarven Excavation | 2888 × 1838 | 1960 × 1248 | 29.4 units = 5 feet |
| Umbrage Hill | 2888 × 1838 | 1960 × 1248 | 29.4 units = 5 feet |

**Every remaining local scan is 2888 × 1838, so every remaining local map uses
1960 × 1248 with 29.4 units to the five-foot square.** That is not a
coincidence to rediscover each time — the module's local maps all ship at one
size. Use those numbers and the new map lands on the same grid as the three
that already exist.

The conversion is uniform: multiply scan coordinates by `1960 / 2888`
(approximately `0.67867`). That sends the scan height to approximately `1248`
as well. Record coordinates in the component's final space, keep the full-sheet
origin, and round only when SVG readability benefits; do not repeatedly scale
already-rounded points. The `29.4`-unit grid is the reference grid after this
conversion, not a number inferred from a placeholder component.

**Name the scan and the scale in a comment at the top of the file**, the way
the four do:

```
// Traced from map-00.04-phandalin.jpg in a 1872 × 1344 coordinate space.
// The reference's 500-foot scale bar spans 778 units. No dungeon interiors.
```

**Geometry is measured data, not styling.** `DwarvenExcavation.astro` says it
outright and it is the rule for all of them:

> Keep geometry in this coordinate space: resizing individual rooms destroys
> the shared scale and alignment.

If a room looks too small, it is the right size. Do not nudge a wall to improve
a composition; the composition is the module's.

**Where the module ships a player version** (currently Umbrage Hill's
`map-13.01-umbrage-hill-player.jpg`), use it as a spoiler check. Trace the `.02`
reference when it contains terrain facts absent from the player sheet, then
remove DM keys and unrevealed information yourself. Do not assume future player
and DM scans differ only by room keys; compare them.

## What gets traced

In roughly this order, because each layer constrains the next:

1. **The ground** — coastline, contours, cave walls, canyon rim, water. The
   outline is the map; get it right before anything sits on it.
2. **The built structures** — footprints at their real dimensions and real
   rotations. Roofs, walls, fences with their posts, ruins as broken runs.
3. **The small stuff** — boulders, rubble, trees, orchards, ploughed fields,
   hachures, stairs, bridges.
4. **Our overlay** — numbered points of interest, title, subtitle, scale bar,
   compass.

**Density is content.** Phandalin's redraw went from a handful of buildings to
about sixty roofs, and the comment in the file explains why: *"the town's
density is as important as its seven landmarks."* A frontier town with six
buildings on it is a different town. Trace the sheds.

**Keep the official scale bar, with the official tick values.** Phandalin's
reads `0 / 100 / 200 / 500 feet` because the module's does. Umbrage Hill's says
`1 square = 5 feet` because the module's does. Never approximate a scale with
`≈`; if a bar cannot be stated exactly, the coordinate space is wrong.

**Keep the marginal annotations that are terrain facts**: the `+0 ft.` through
`+40 ft.` elevation labels stacked down Umbrage Hill's east side, the `+10/+20/
+30 ft.` drops in Gnomengarde, road notes like *To Triboar Trail* and
*Miners' Trail*.

**Drop what belongs to the book, not the place**: parchment texture and the
decorative border, the module's room codes (`G1`–`G15`, `U1`–`U5`), floor-plan
insets, and any label naming something the party has not met.

Prefer explicit SVG geometry (`path`, `polygon`, `rect`, `circle`) and small,
deterministic data arrays. Generated marks may add texture, as the model maps
do, but must be deterministic so builds and visual comparisons do not drift.
Use unique SVG IDs prefixed for the map (`uh-grid`, `gn-water`, and so on),
because inline definitions share a document with the viewer. Keep the root
group `aria-hidden="true"`; the page supplies the map's accessible name and the
registry supplies the readable Key.

## The ink is ours

**Everything visual comes from the design system, nothing from the scan.** No
parchment, no textures, no scanned colour. Dark "Night in the Wilds" first,
both themes working, every value a token: `--map-land`, `--map-ridge`,
`--map-label`, `--map-building`, `--map-pool`, `--map-forest`, `--bg-inset`.
Gold is the only "pay attention" colour and ember red is reserved for danger —
which on a map means it is almost never correct (see the next section).

**Shared classes live in the `.ref-map` block at the bottom of
`src/styles/global.css`.** Put `class="submap-<name> ref-map"` on the root `<g>`
and these come with it:

| Class | For |
| --- | --- |
| `.ref-grid` | the five-foot grid, as a `<pattern>` fill |
| `.ref-building` / `.ref-roof` | structure footprints and their roof lines |
| `.ref-stone` / `.ref-rubble` | boulders, scree, spill |
| `.ref-ruins` | broken walls, drawn as a dashed heavy stroke |
| `.ref-fence` / `.ref-fence-posts` | fence runs and their posts |
| `.ref-poi` | the numbered discs (pairs with `.sm-poi` for the tooltip) |
| `.ref-title` / `.ref-subtitle` | map name and the mono caption under it |
| `.ref-scale` | the scale bar and its numbers |
| `.ref-elevation` | `+N ft.` labels, haloed so they read over any fill |

**Anything a single map needs goes under its own prefix** —
`.submap-phandalin .ph-ravine`, `.submap-gnomengarde .gn-mushrooms` — in
`global.css`, never in a `<style>` block and never on the tokens. If a second
map wants the same thing, promote it into `.ref-map` rather than copying it.

**The viewer is already built.** Pan/zoom, the tooltip on a `.sm-poi` (via
`data-tip-title` / `data-tip-sub`), the Key below the map, and the compass all
come from the page and the registry. Draw the map; do not rebuild the chrome.

## What never gets drawn

This is the part that matters most, because a map is the easiest place on the
site to spoil the game by accident. The full statement lives in the header
comment of `src/components/map/submaps/registry.ts`; the short version:

**A map carries only what the party could see standing in the place.** Off the
drawing, off the tooltips, off the Key, and off rendered HTML comments go:

- secret doors (the module marks them `s`), hidden passages, concealed entrances;
- traps, and any room nobody has reached;
- creatures, lairs, and hints that something is denned in, watching, or about
  to come through the floor;
- the `danger` class on a point of interest, which paints it ember.

**A secret earns its place on the day the party finds it in play, and not
before.** Both Gnomengarde and Dwarven Excavation draw secret doors — the ones
that were found, in dashed gold (`.gn-secret-doors`, `.exc-found-doors`), inside
the interior gate. That is the pattern: found, then drawn.

**Interiors are gated by `interiorSeen`, in the drawing and in the Key
together.** The component takes an `interior` prop, and everything behind a door
lives inside `{interior && …}`:

```astro
interface Props { interior?: boolean }
const { interior = false } = Astro.props;
```

`src/pages/map/[id].astro` passes the location's `interiorSeen`, filters the
legend on the matching `interior: true` flags, and prints the standing note that
the interior gets drawn the session they walk into it. Legend entries are
numbered explicitly so dropping one does not renumber the rest.

**A place with no outside worth drawing sets `interiorOnly: true`** in the
registry — a hold cut into a mountain is a shut gate and nothing else — and
waits for `interiorSeen` rather than publishing as a blank hillside.

**Do not write module knowledge into the notes.** The same rule as the
chronicle: you may well know what is in the vault. The map does not, until they
open it.

The old, unpublished registry entries predate this rule and contain speculative
module-flavoured notes. Their safety comes only from the publication gate. They
must be rewritten from campaign facts during the redraw; a status flip without
that audit is not a valid publishing workflow.

## The registry entry

Each map is registered in `src/components/map/submaps/registry.ts` under its
location slug, and the entry is as much of the work as the drawing:

```ts
'umbrage-hill': {
  Component: UmbrageHill,
  width: 1960,
  height: 1248,
  scaleNote: 'Before its destruction · Exterior · 1 square = 5 feet',
  legend: [
    { label: "Adabra Gwynn's windmill", note: 'former home and workshop; destroyed by the dragon in Session 7' },
    …
  ],
},
```

- `width`/`height` are the coordinate space, and must match the component.
- `scaleNote` states the scale, and any standing caveat about *when* the map is
  true — Umbrage Hill's says `Before its destruction · Exterior`, because the
  dragon levelled the place in Session 7 and the drawing is a record of what was
  there before.
- `legend` notes are campaign facts, in the chronicle's voice, tied to sessions
  where that is what makes them worth reading: *"Guildmaster Thornton. A trap
  door in the floor, and stairs under the town."* Not module descriptions.
- Anything inside gets `interior: true`.
- Marker numbers in the component must match the legend's array positions.
  Keep intentional gaps by retaining an interior legend entry and gating its
  marker with the same `interior` prop; do not renumber visible markers merely
  because a hidden entry is filtered out.

**When the campaign contradicts the module, the campaign wins.** Gnomengarde's
redraw moved the ballista and blade-room markers because the recaps put them
somewhere the official map did not.

## Finishing

- `npm run check && npm run build`.
- **Look at it in both themes**, at the map page and in the region map's
  quick links. A colour that only works dark is a bug.
- **Look at it beside the scan.** Overlay if you can. Every landmark should sit
  where the module puts it; if one drifts, the coordinate space is off, not the
  landmark.
- At minimum, compare the outer boundary, grid intersections, entrances,
  building corners, elevation marks, and scale bar at several widely separated
  points. A match in one corner does not prove uniform scale.
- Confirm the gate: with `interiorSeen` false, no interior geometry and no
  interior Key lines in the built HTML in `dist/`.
- Search the built page for room keys, secret-door labels, encounter names, and
  other terms copied from the DM scan. Also inspect tooltips and the Key; a
  visually hidden spoiler is still published content.
- Move the map from [The maps still to draw](#the-maps-still-to-draw) here and
  add a line to [`ROADMAP.md`](ROADMAP.md)'s Done.
- Commit in the house style — imperative subject, body grouped by area. The five
  redraws are the model: `git log --oneline` around `7e96619`.

Every sub-map page still carries a "work in progress" caveat, and the region map
repeats it under the local-map links (`.map-wip` / `.map-wip-note`). Drop both
when the last map is redrawn and the set finally settles.

## The maps still to draw

All eleven are drawn in the old invented style, publish nowhere, and are to be
redrawn from their scans before their local map publishes. Mountain's Toe is
visited as of Session 9, but its signed entrance is the only established
feature: `interiorOnly: true` and `interiorSeen: false` keep its old local map
unbuilt. Redraw and audit it before changing that interior gate.
Every scan is 2888 × 1838 → **1960 × 1248, 29.4 units = 5 feet**.

| Location | Scan |
| --- | --- |
| `axeholm` | `map-01.02-axeholm.jpg` |
| `butterskull-ranch` | `map-02.02-butterskull-ranch.jpg` |
| `circle-of-thunder` | `map-03.02-circle-of-thunder.jpg` |
| `dragon-barrow` | `map-04.02-dragon-barrow.jpg` |
| `falcons-hunting-lodge` | `map-06.02-falcons-hunting-lodge.jpg` |
| `icespire-hold` | `map-08.02-icespire-hold.jpg` |
| `loggers-camp` | `map-09.02-loggers-camp.jpg` |
| `mountains-toe-gold-mine` | `map-10.02-mountains-toe-gold-mine.jpg` |
| `shrine-of-savras` | `map-11.02-shrine-of-savras.jpg` |
| `tower-of-storms` | `map-12.02-tower-of-storms.jpg` |
| `woodland-manse` | `map-14.02-woodland-manse.jpg` |

The scans are reference only. They live in `offical-assets/` and are never
shipped to the built site.
