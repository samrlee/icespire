# Dragon of Icespire Peak — Campaign Website

The chronicle of our D&D campaign: session recaps, a running campaign summary,
the party roster, an NPC directory, and a faction & lore codex.

Built with [Astro](https://astro.build) and deployed to Cloudflare Pages at
**https://icespire.ghostbloods.net/** (deploys automatically on every push
to `main`).

## Site structure

| Nav item | Route | Source |
| --- | --- | --- |
| Recaps | `/sessions/` | `src/content/sessions/` |
| Campaign | `/campaign/` | `src/pages/campaign.md` (single running page, edit in place) |
| Map | `/map/` | `src/content/locations/` + `src/content/journey/` |
| Roster | `/characters/` | `src/content/characters/` |
| NPCs | `/npcs/` | `src/content/npcs/` |
| Relations | `/graph/` | derived from `src/content/npcs/` + `factions/` + `characters/` |
| Codex | `/codex/` | factions (`src/content/factions/`) + lore (`src/content/lore/`) |

## Adding content

All content lives as Markdown files — one file per entry. Copy an existing file,
rename it, and edit. The current content is **sample data from the design system**;
replace it with the real campaign as you go.

- **Sessions**: `session-15.md` etc. Frontmatter: `title`, `sessionNumber`, `date`,
  `summary` (the card excerpt), `playersPresent`, optional `draft: true` to hide.
- **Characters**: `name`, `player`, `ancestry`, `class`, optional `level`,
  `status` (active/retired/dead/missing), `tagline` (one-line bio on the card),
  `traits` (short pill labels), optional `portrait`.
- **NPCs**: `name`, `role`, `affiliation` (shown as "Role · Affiliation"),
  `status`, plus `note` (directory blurb), optional `faction` (a faction
  file's name, for linking) and `firstAppearance`. `status` is the NPC's
  disposition toward the party and drives both the status pill and the colour
  of their line on the relationship graph — so keep the bar for `ally` high:
  - `ally` — has given the party real, material aid, or is a committed
    friend/asset who'd take their side. **Not merely polite** — an NPC *earns*
    ally, they don't start there.
  - `hostile` — actively opposed (renders in ember, "Hostile").
  - `unresolved` — a relationship the story hasn't settled, owed a reckoning
    either way (renders as "Unresolved Thread").
  - `neutral` — met and non-hostile but uncommitted: townsfolk, patrons,
    one-off contacts, the newly-met, wildcards. Renders as "At Large". This is
    the default.
- **Factions**: `name`, `type`, `status`, `alignment`, `summary` (codex panel text).
- **Lore**: `title`, `category` (places/history/items/…), `summary`.
- **Locations** (`src/content/locations/`): places on the campaign map. `name`,
  `x`/`y` (map coordinates in the SVG's 1000×750 space), `kind`
  (town/settlement/landmark/dungeon/camp/lair), `status`
  (`visited`/`known`/`rumored`/`unknown` — drives the marker style; `unknown`
  renders nowhere until you change it), optional `danger` (ember marker,
  reserved for real threats), `firstVisited` (session number), `summary`
  (tooltip/panel one-liner), `labelPlacement` (top/bottom/left/right), and
  optional `lore`/`faction` slugs to link from the detail panel. The body is
  the panel write-up.
- **Journey** (`src/content/journey/session-N.yaml`): one YAML file per
  session. `route` is the ordered list of location slugs the party travelled
  through (consecutive stops become route segments on the map — include
  intermediate stops on return trips so the trail overlaps instead of cutting
  a new line). `events` pins notable moments to a location: `title`, `at`
  (location slug), optional `note`, and `kind`
  (`battle`/`discovery`/`social`/`omen` — battles pin in ember). Unknown slugs
  fail the build.

### The maps

`/map/` renders a custom SVG of the Phandalin region
(`src/components/map/MapTerrain.astro` — terrain only; markers, route, and
event pins are generated from the content collections by
`src/pages/map/index.astro`). The geography follows the official Sword Coast
map in `offical-assets/Maps/` (reference only — the scans are never shipped
to the built site). The map pans and zooms (drag/scroll/pinch), markers open
a detail panel with links to recaps and codex entries, and
`/map/#location-slug` deep-links to a location. Terrain colors live in the
Campaign Map section of `src/styles/global.css` and follow both themes.

**Local sub-maps** are *traced from the official sheets* rather than drawn by
hand. `scripts/trace_local_maps.py` reads a scan out of `offical-assets/Maps/`,
segments it into layers — the walkable floor and the ink inside it for a
dungeon sheet; roads, buildings, woods and water for the painted town sheet —
vectorises each layer, and writes the paths to
`src/components/map/submaps/traced/<slug>.ts`. `TracedSubmap.astro` draws those
paths in the campaign's own palette. What ships is geometry: the scans are
never served, and the sheets' own lettering is dropped on the way through
(the site draws its own labels).

To change a map, edit `scripts/local-maps.json` and re-run the script — never
edit a file under `traced/`, it is generated.

```sh
pip install -r scripts/requirements.txt
python3 scripts/trace_local_maps.py                  # all maps
python3 scripts/trace_local_maps.py --preview        # + tuning previews
python3 scripts/trace_local_maps.py phandalin        # just one
```

Each map's config entry names its `source` scan and its `kind`:

- `dungeon` — a battle-mat sheet, bright floor against dark stone. Tuned with
  `floorLow`/`floorHigh`, the hysteresis thresholds that decide what counts as
  floor. Raise `floorHigh` when background texture leaks in; lower `floorLow`
  when real floor is being clipped.
- `outdoor` — a sheet that is all ground (a ranch, a hilltop, a camp). Its
  structures come from what the ink encloses, and the linework is kept whole.
- `town` — the painted Phandalin sheet. Roads come off the paint; buildings are
  the roofs the ink fences in.

`margin` trims the sheet's decorative border, and `ignore` blanks named
rectangles (a title cartouche, an inset floor plan) in fractions of the sheet.
Run with `--preview` and look at `scripts/previews/<slug>.png` — the traced
floor is outlined in red and the ink is filled blue — before changing numbers.

Scale is measured, not guessed: the script finds the five-foot grid printed on
each sheet and derives the scale bar and the "about N feet across" note from
it. Because every sheet in the set shares a pitch, they cross-check each other,
and a sheet whose measurement disagrees with the rest takes the consensus.

A map's **points of interest** are its `pois`, authored in the same config as
`{ label, note, at: [x, y] }` — `at` in pixels of the source scan, which is the
one coordinate space you can read off the official sheet by eye. The script
snaps each one to the nearest traced structure, so a rough reading still lands
in the right room. `at` is optional: an entry the sheet doesn't pin down keeps
its number in the key and simply goes unmarked. The map's numbered markers and
the "Key" list below it are the same list, so they can never drift apart.

A sub-map page (`/map/<slug>/`) is only built — and only linked from the region
map's detail panel — while its location's status is `visited`. Every official
site is already traced, including the ones the party hasn't found: to reveal
one after a session, flip its location's `status` (`unknown` → `visited` shows
both the region marker and the local map). The full status ladder:

- `unknown` — not on the site at all (all the undiscovered official sites
  start here)
- `rumored` — dashed marker, the party has only heard of it
- `known` — hollow marker, seen but not entered
- `visited` — solid marker, local map published

Frontmatter is validated at build time (`src/content.config.ts`); a bad field
fails the build with a pointed error.

### The relationship graph

`/graph/` ("The Political Web") renders an inline SVG force-of-allegiance
diagram — the party at the centre, factions on an inner ring, and every NPC on
an outer ring clustered beside the faction they answer to
(`src/pages/graph/index.astro`). Nothing new to author: it is generated from
the existing `npcs`, `factions`, and `characters` collections at build time.

- **Lines carry disposition.** A solid line's colour is a figure's stance
  toward the party — ally (green), hostile (ember), unresolved thread (gold),
  or at-large/neutral (frost) — reusing the NPC `status` values and the same
  status tokens as the pills. A faction's free-text `alignment` collapses onto
  the same four buckets.
- **Dashed lines are membership** — an NPC's `faction` slug draws a quiet grey
  tie to that faction's hub.
- Choosing any node lights up its ties and opens a detail panel (with links to
  the full NPC/faction/roster pages); the graph pans and zooms like the maps
  (it reuses `src/scripts/map-viewer.ts`). A plain "By allegiance" roll-call
  under the graph is the no-tiny-targets path on a phone.

To grow the web, just add NPCs and factions as normal — set an NPC's `faction`
to cluster it, and its `status` to colour its line.

### Design elements inside recaps

Markdown blockquotes render as gold-bordered pull quotes automatically. Add an
attribution with a `<footer>` line inside the quote:

```markdown
> I said the sled was fine. I did not say it would stay fine.
>
> <footer>— Brindle Cogsworth (played by Alex)</footer>
```

Callout boxes (game mechanics stay out of narrative prose per the design system):

```html
<div class="callout loot">           <!-- or magic-item / house-rule -->
  <div class="callout-label">Loot</div>
  <div class="callout-title">The Necklace, Found Again</div>
  <div class="callout-body">Recovered from the temple vault.</div>
</div>
```

Character portraits go in `public/images/characters/` and are referenced as
`portrait: /images/characters/brindle.jpg`.

## Design system

The design is implemented from the **Icespire Peak Campaign Design System**
(Claude Design). Key rules, so edits stay on-system:

- Dark theme ("Night in the Wilds") is default; the nav button toggles the light
  "Snowfield" theme via `data-theme="light"`.
- Cold slate neutrals everywhere; **gold is the only "pay attention" color**;
  **ember red is reserved for danger/hostility only**.
- Cinzel for display/headings only, Crimson Pro for body, JetBrains Mono for
  stat blocks/dice notation. No emoji, no parchment textures.
- Tokens live in `src/styles/tokens/` (verbatim from the design project);
  component classes in `src/styles/global.css`; Astro components in
  `src/components/`.
- Fonts load from Google Fonts (the design system's documented substitution —
  swap `src/styles/tokens/fonts.css` if self-hosting later).

## Social preview cards

Each session gets its own Open Graph image, so a recap link shared in Discord
or elsewhere shows that session's title and date rather than one shared card.
The images are generated at build time — no network needed — from
`src/lib/og.ts` (satori lays the card out with the campaign's fonts; sharp
rasterises it to PNG), served at `/og/sessions/<id>.png` via
`src/pages/og/sessions/[id].png.ts`, and wired to a page through the `ogImage`
prop on `Base.astro`. The card fonts are bundled under `src/assets/og-fonts/`
(Cinzel + Crimson Pro, `.woff`); every other page falls back to the static
`/images/social-card.jpg`. To give another page type its own card, add an
endpoint that calls `renderOgCard(...)` and point its `ogImage` at it.

## Roadmap

Planned and possible improvements are tracked in
[`docs/ROADMAP.md`](docs/ROADMAP.md) — check there before starting new work.

## Development

```sh
npm install
npm run dev      # local dev server at localhost:4321
npm run build    # production build (also validates all content)
```

## One-time Cloudflare Pages setup

Deploys are handled by Cloudflare Pages (not GitHub Actions). Connect the repo
once in the Cloudflare dashboard:

1. **Workers & Pages → Create → Pages → Connect to Git**, select this repo.
2. Build settings:
   - **Framework preset:** Astro
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
   - Node version is pinned to 22 via `.nvmrc`.
3. **Custom domains → Set up a custom domain →** `icespire.ghostbloods.net`.
   Cloudflare adds the DNS record and provisions TLS automatically since the
   `ghostbloods.net` zone is already on Cloudflare.

After that, every push to `main` triggers a production deploy, and other
branches / PRs get automatic preview URLs.
