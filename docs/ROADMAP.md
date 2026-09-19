# Website improvements — running list

A living to-do list of site improvements, kept so it can be referenced across
work sessions. When you finish one, move it to **Done** with a one-line note.
When you think of a new one, add it under **Ideas** with enough detail that
someone (or a future chat) can pick it up cold. When you decide against one,
move it to **Considered and dropped** with the reason, so it doesn't come
back around as a fresh idea.

Priorities are a rough guide, not a contract — reorder freely.

## Done

- **NPC portraits** — Phantom has a standalone portrait based on Sage's image;
  Don-Jon uses the existing official illustration, and all ten remaining humanoid
  NPCs have generated campaign portraits. Profile captions carry explicit art
  credits; sources and prompts are in `NPC-ART.md`. _(Sep 2026)_

- **Calendar dates keep their day** — recap headers, cards, timeline, search
  and social previews format date-only session values in UTC, so builds in
  Central time no longer display the previous day. _(Sep 2026)_

- **Question-focused passages for Ask** — long entries now contribute ranked,
  overlapping sentence windows with surrounding context, in source order.
  Omission markers distinguish separate passages; headings and separators count
  toward the context budget. Oversized entries no longer force an opening-only
  fallback or block smaller sources. Regression tests run in CI. _(Sep 2026)_

- **Sword Coast region redraw** — the full official reference sheet, with
  traced coastline, forest boundaries, river branches, roads, and relief.
  Five-mile hexes and location coordinates share a 1344×1872 space; terrain
  is unnamed and only visited campaign locations receive markers. _(Sep 2026)_

- **Visited-only region map** — unvisited places are absent from markers,
  detail panels, event pins, replay data, location search documents, and
  location auto-links. Draft journeys are excluded; regression checks cover
  hidden waypoints and malformed references. _(Sep 2026)_

- **Gnomengarde map redraw** — traced both cave wings, the river and islands,
  bridge, stairs, and room connections from the official five-foot grid.
  Corrected the ballista and blade-room positions; interiors and their key
  entries share the discovery gate. _(Sep 2026)_

- **Phandalin map redraw** — aligned roads, landmark footprints, houses,
  orchard, fields, and eastern ravine with the official town map and its
  500-foot scale bar. Retains the seven campaign landmarks. _(Sep 2026)_

- **Umbrage Hill map redraw** — traced the official contour lines, windmill
  footprint, yard fence, ruined outbuilding, and boulders at five-foot grid
  scale. Labels the exterior as a record before the dragon destroyed it;
  unseen floor plans remain withheld. _(Sep 2026)_

- **Dwarven Excavation map redraw** — traced the official canyon, ruins, room
  footprints, and passages at a consistent five-foot grid scale. Uses the
  campaign palette and existing pan/zoom viewer; includes the chamber reached
  in Session 7 and respects the interior gate. The other three published local maps now use the same approach. _(Sep 2026)_

- **The maps' hand is written down** — [`MAP-STYLE.md`](MAP-STYLE.md) records
  what the five redraws established: trace the official scan and draw it in our
  ink, the coordinate space per sheet (and the one every remaining local map
  will use), what gets traced and in what order, the shared `.ref-map` classes,
  and the gates that keep secret doors, traps, unreached rooms and unfound
  threats off a player-facing map. Linked from `AGENTS.md`, `CLAUDE.md` and the
  README's map section, so the next tool does not rediscover it — or, worse,
  quietly go back to inventing geography. _(Sep 2026)_

- **The handoff knows about the table.** Everything an agent needed but could
  only get by being told — the DM's name, which player runs which character, the
  house rules, the canonical spelling of every name a room mic garbles — is now
  in [`TABLE-FACTS.md`](TABLE-FACTS.md) instead of scattered across seven
  `player` fields and one Session 0 bullet.
  [`TRANSCRIPT-BRIEF.md`](TRANSCRIPT-BRIEF.md) packs the same material, the
  voice rules, and the clarifying round into one prompt that can be pasted into
  any chat with a transcript — no repo access required — so the writing can
  happen wherever it is convenient and still land here clean. The failure modes
  the correction commits kept catching (the count of a repeated action, who knew
  what and when, agreed-versus-paid, the order of a negotiation) are written
  down in the workflow and the style guide rather than being rediscovered each
  session. _(Sep 2026)_

- **Dramatis personae on recaps** — each recap opens with its cast: the party
  at the table (from `playersPresent`), then the NPCs and factions the session
  involves, as chips linking to their pages
  (`src/components/DramatisPersonae.astro`). The alias table that auto-links
  entity mentions in prose moved to `src/lib/entities.ts` and now does double
  duty — the browser linker and the build-time cast scan share one definition
  of who answers to what name, so a name written into a recap enrolls its
  owner with no extra tagging.

  Two deliberate limits, both costing coverage to avoid guessing: a name has
  to be written out (an NPC called only "the Queen" is missed — frontmatter
  `firstAppearance` and linked `encounters` cover that gap where it exists),
  and a faction sharing a place's name stays out, since "business at
  Gnomengarde" means the warren, not the gnomes. _(Sep 2026)_

- **Sitemap + `robots.txt`** — the site is crawlable and lists its own pages
  for Search Console (`@astrojs/sitemap` in `astro.config.mjs`,
  `public/robots.txt`). The filter reuses the site's publish gates: a draft
  recap builds a page but stays out of the sitemap, exactly as it stays out of
  `/sessions/` and the search index. **One dashboard step left** — verify the
  domain in Google Search Console and submit the sitemap. _(Sep 2026)_

- **The sample data is gone.** The design system's placeholder content was
  replaced session by session as the campaign was actually written up; Sessions
  0–8, the roster, the NPCs, the factions, the lore and the places are all real.
  The README's "sample data" note lagged behind, and has been corrected.
  _(Sep 2026)_

- **"Ask the Chronicle" — grounded Q&A over the campaign** — the palette offers
  to put a question to Llama 3.3 70B via Cloudflare's Workers AI binding, after
  retrieving only the published entries that bear on it
  (`functions/api/ask.ts`, ranking shared with search in
  `src/lib/search-rank.ts`). No API key: the binding is the credential.
  **Live** — the Workers AI binding is configured on the Pages project.

  What the investigation settled, since the numbers drove the design: the
  served context is **24,000 tokens** with `max_tokens` counted against it, so
  the ~27,600-token corpus does *not* fit and retrieval is load-bearing rather
  than an optimisation; cost is ~124 Neurons for a typical question against
  10,000/day free (~25–80 questions/day depending on how much gets retrieved,
  then ~$0.0014 each); and the 70B refuses cleanly on questions the entries
  don't cover — including "what is inside Axeholm?", which it could have
  answered from module knowledge and didn't. Questions that retrieve nothing
  never reach the model at all. _(Sep 2026)_

- **Site-wide search (`⌘K`)** — a palette over every published page: recaps,
  roster, NPCs, factions, lore, visited places, and the campaign summary. The
  index is a build-time static file (`/search-index.json`, from
  `src/lib/search-index.ts`); ranking, snippets, and highlighting all happen in
  the browser (`src/scripts/search.ts`), so search adds no server, no runtime
  dependency, and nothing that can be rate-limited or run up a bill. It reuses
  the site's publish gates — a `draft` recap and an `unknown` location are
  unsearchable for exactly as long as they are unlinked. _(Sep 2026)_

- **Per-session social-preview cards** — each session gets its own Open Graph
  image so a shared recap link shows that session's title/date instead of one
  static card. Generated at build time (`src/pages/og/sessions/[id].png.ts` →
  `src/lib/og.ts`, satori + sharp, fonts bundled in `src/assets/og-fonts/`).
  Wired via the `ogImage` prop on `src/pages/sessions/[id].astro`. _(Jul 2026)_

## Ideas

Ordered high → low by rough impact-per-effort.

1. **Reading time on recaps.** The cast strip half of this idea shipped (see
   Done); the reading-time estimate did not. It was held back because it reads
   as noise on the early recaps — Sessions 0–4 run 61 to 389 words, and "1 min
   read" tells nobody anything. The trend argues for revisiting: the last four
   sessions ran 749, 1,789, 3,214 and 4,165 words. Ship it behind a threshold
   (say 500 words) rather than on every recap.

2. **Print stylesheet.** A `@media print` block so a recap or the campaign
   summary prints cleanly for players/DMs who want a hard copy.

3. **Redraw the eleven hidden local maps, as they publish.** Axeholm,
   Butterskull Ranch, Circle of Thunder, Dragon Barrow, Falcon's Hunting Lodge,
   Icespire Hold, Loggers' Camp, Mountain's Toe Gold Mine, Shrine of Savras,
   Tower of Storms and the Woodland Manse are still in the pre-redraw invented
   style. Their publication gates keep them unbuilt, so this is
   not work to do in a batch — it is one map's work before its local map
   publishes. Mountain's Toe was reached in Session 9, but no interior features
   are established; `interiorOnly: true` and `interiorSeen: false` keep its
   placeholder unbuilt until exploration and redraw.
   [`MAP-STYLE.md`](MAP-STYLE.md) has the method and the numbers: every one of
   those scans is 2888 × 1838, so every one of those maps is 1960 × 1248 at
   29.4 units to the five-foot square, exactly like Gnomengarde, the Dwarven
   Excavation and Umbrage Hill. When the last one is done, the "work in
   progress" caveat comes off the sub-map pages and the region map.

## Considered and dropped

Kept here so they don't get re-proposed cold.

- **Quest Board page (`/quests/`).** *Dragon of Icespire Peak* is built around
  Phandalin's job board, but this party accepts every job offered — so the
  posted/active/failed states would sit empty and the board would collapse
  into a list of completed jobs. The recaps and the campaign page already
  narrate those, in prose, with their consequences attached. _(Sep 2026)_

- **Treasury / loot index.** The premise was that `callout loot` and
  `callout magic-item` blocks were scattered through the recaps waiting to be
  aggregated. Counted across Sessions 0–8: three `callout loot` blocks and no
  `callout magic-item` blocks at all, so a generated page would have three rows.
  `src/content/lore/magic-item-haul.md` is already the treasury, and it
  handles what a table could not — the second sending stone "has not been
  assigned to anyone", the coffer is "still unappraised". Ownership is often
  genuinely unsettled, and prose can say so where a column cannot. _(Sep 2026)_

- **RSS feed.** Not wanted — the group is seven people who already know when
  they played. The sitemap half of this idea shipped on its own merits. _(Sep 2026)_
