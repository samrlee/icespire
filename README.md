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
| Search (`⌘K`) | `/search-index.json` | every published entry, built by `src/lib/search-index.ts` |
| Ask | `POST /api/ask` | `functions/api/ask.ts` (Cloudflare Pages Function) |

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
  - `at-large` — a wildcard the party has lost track of: escaped, fled, or
    otherwise unaccounted for and still out there. Renders as "At Large".
  - `deceased` — dead, and known to the party to be dead. The relationship is
    over; what they left behind may not be.
  - `neutral` — met and non-hostile but uncommitted: townsfolk, patrons,
    one-off contacts, the newly-met. Renders as "Neutral". This is the
    default.
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

**Local sub-maps** live in `src/components/map/submaps/` (one SVG component
per site, registered in `registry.ts` with a numbered key). A sub-map page
(`/map/<slug>/`) is only built — and only linked from the region map's
detail panel — while its location's status is `visited`. Every official site
is already drawn, including the ones the party hasn't found: to reveal one
after a session, flip its location's `status` (`unknown` → `visited` shows
both the region marker and the local map). The full status ladder:

- `unknown` — not on the site at all (all the undiscovered official sites
  start here)
- `rumored` — dashed marker, the party has only heard of it
- `known` — hollow marker, seen but not entered
- `visited` — solid marker, local map published

Because the sub-maps are our own drawings and still being reworked, every
sub-map page carries a "work in progress" caveat above the map, and the region
map repeats it in one line under the local-map quick links (`.map-wip` /
`.map-wip-note` in `global.css`). Drop both if the maps ever settle.

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

## Search

Every page is searchable from the header button, `⌘K`/`Ctrl-K`, or `/`. There
is no search server: `src/lib/search-index.ts` flattens the published content
into one static JSON file at `/search-index.json` during the build, and
`src/scripts/search.ts` fetches it the first time someone opens the palette and
does the ranking, snippets, and highlighting in the browser. Nothing to run,
nothing to pay for, nothing to rate-limit.

**The index publishes only what the site publishes**, and that is the rule to
keep when editing it. Each collection is filtered exactly as its page filters:
a `draft` recap and a location whose `status` is `unknown` are absent from the
index for precisely as long as they are absent from the site — so a place
becomes searchable the moment you flip it to `rumored`, and not a build
before. Add a collection to `buildSearchIndex()` and you must bring its
publish gate with it; reaching for a bare `getCollection()` there is how a
spoiler ships.

Ranking is deliberately small: every term has to appear somewhere in an entry
for it to place at all (so "dax mine" means both, not either), and a hit
counts most in a name, then a subtitle, then body prose. Snippets are built
from DOM nodes rather than an HTML string, so campaign prose can never smuggle
markup into the palette.

Nothing about this changes the CSP — the palette's script bundles to an
external file under `/_astro/` (already covered by `script-src 'self'`), and
the index fetch is same-origin, which `connect-src 'self'` already allows.

## Ask the Chronicle

Under the search results, the palette offers to put the question to a model:
`functions/api/ask.ts` retrieves the few published entries that bear on it and
hands **only those** to Llama 3.3 70B through Cloudflare's Workers AI binding.
Search answers first and for free; the model runs only when a reader decides
the list didn't answer them, so a call is always a choice rather than a side
effect of typing.

**It needs one dashboard step to work.** In the Cloudflare dashboard: Workers &
Pages → icespire → Settings → Bindings → Add → Workers AI, variable name `AI`,
then redeploy. Pages Functions cannot declare this binding in a config file —
the dashboard is the only place. Until it exists the endpoint answers 503 and
the palette says so; search is unaffected either way.

There is **no API key anywhere in this repo**. The binding is the credential,
so there is nothing to leak, nothing to rotate, and no spend cap to set.

Three measured numbers shape the code, all from probing the live API (the
working is in `docs/ROADMAP.md`):

- **The context window is 24,000 tokens**, and Cloudflare counts `max_tokens`
  against it — exceed the sum and the call fails `413`/`5021`. The whole
  campaign is ~27,600 tokens, so it does *not* fit. Retrieval is what makes
  this work at all, not an optimisation.
- **~124 Neurons per question** at these prompt sizes, against a free
  allowance of 10,000/day. Bigger questions that pull five long recaps cost
  nearer 400. Call it 25–80 questions a day free, then ~$0.0014 each.
- **The model refuses cleanly** when the entries don't cover the question,
  including when it plainly knows the published module — asked what is inside
  Axeholm, which the party has not found, it answered "The chronicle does not
  record that" rather than reciting the book.

The system prompt is tuned between three failures that pull against each
other, so change it with all of them in mind.

1. **Too loose** and the model answers from its own knowledge of the module,
   telling players what is in rooms they have never entered.
2. **Too strict** and it refuses questions the chronicle plainly answers. The
   first live question was "why do the orcs want the mine", and it refused
   despite Session 6 saying three times that the orcs wanted the ruin as "a
   good fort" — because the reader said *mine* where the recap says *ruin*.
   Hence the instruction to match on meaning rather than wording.
3. **Given licence to say what is missing**, it hedges: the next attempt at
   that same question opened "The chronicle does not record the orcs'
   motivations… it only records that they were scouting the ruin as a
   potential fort" — a disclaimer its own next clause contradicts. Hence the
   instruction to answer directly when the entries do answer, and that what
   someone is recorded saying or intending *is* an answer about their reasons.

Spoiler-safety is inherited rather than re-implemented: the model only ever
sees documents `/search-index.json` was allowed to contain, so the publish
gates that protect search protect this too. A question that retrieves nothing
is answered "The chronicle does not record that." without calling the model at
all — honest, instant, and free.

Ranking lives in `src/lib/search-rank.ts`, shared by the palette and the
endpoint. They differ in strictness on purpose: `pickAll` (palette) needs every
term to land, while `pickAny` (endpoint) drops question scaffolding and ranks
by overlap, because "what did the party find in the temple?" is mostly filler
and demanding every word would answer nothing.

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

## Response headers

`dist/_headers` — the file Cloudflare Pages reads for response headers — is
**generated at build time** by [`integrations/security-headers.mjs`](integrations/security-headers.mjs).
Edit the policy there; don't add a `public/_headers`, it would be overwritten.

It is generated because the Content-Security-Policy's `script-src` names the
SHA-256 hash of every inline script the build emitted (the pre-paint theme
script, the nav and contents-rail scripts, Astro's own small bundles). That
replaces `'unsafe-inline'`, which would have waved through any inline script —
including one arriving in a bad content edit, which is what the policy is here
to stop. Touch a script and the next build recomputes its hash; nothing to
remember.

Two invariants the policy leans on, so change them together:

- `build.inlineStylesheets: 'never'` in `astro.config.mjs` keeps every
  stylesheet a linked file, which is what lets `style-src-elem` drop
  `'unsafe-inline'`. `style-src` keeps it for the `style="…"` attributes on
  the map SVGs — CSP can't hash attributes.
- The Google Fonts allowances (`fonts.googleapis.com`, `fonts.gstatic.com`)
  exist only for the `@import` in `src/styles/tokens/fonts.css`. Self-host
  those faces and both can go.

To check a change locally, `npm run build` and read `dist/_headers`; `npm run
preview` does **not** apply it.

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
