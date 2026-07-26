# Website improvements — running list

A living to-do list of site improvements, kept so it can be referenced across
work sessions. When you finish one, move it to **Done** with a one-line note.
When you think of a new one, add it under **Ideas** with enough detail that
someone (or a future chat) can pick it up cold.

Priorities are a rough guide, not a contract — reorder freely.

## Done

- **Local maps traced from the official sheets** — the hand-drawn sub-maps are
  gone. `scripts/trace_local_maps.py` segments each official scan into layers
  (floor + ink for a dungeon sheet; roads, buildings, woods, water for the
  town), vectorises them, and writes
  `src/components/map/submaps/traced/<slug>.ts`, which `TracedSubmap.astro`
  draws in the campaign palette. Outlines now follow the source instead of an
  estimate, and the scale bar is measured off the sheets' five-foot grid.
  Config and points of interest live in `scripts/local-maps.json`. _(Jul 2026)_

- **Per-session social-preview cards** — each session gets its own Open Graph
  image so a shared recap link shows that session's title/date instead of one
  static card. Generated at build time (`src/pages/og/sessions/[id].png.ts` →
  `src/lib/og.ts`, satori + sharp, fonts bundled in `src/assets/og-fonts/`).
  Wired via the `ogImage` prop on `src/pages/sessions/[id].astro`. _(Jul 2026)_

## Ideas

Ordered high → low by rough impact-per-effort.

1. **Site-wide search.** No search today (only the map's URL sync). With this
   much content — sessions, NPCs, locations, lore, factions — a client-side
   search (a prebuilt JSON index + a small `⌘K` palette, no runtime deps
   needed) is the biggest usability win. "Who was that NPC in session 2?"

2. **Quest Board page (`/quests/`).** *Dragon of Icespire Peak* is built around
   Phandalin's job board. A page listing jobs (posted → active → completed →
   failed), each tied to a location and the session it resolved in. Nothing on
   the site currently tracks objectives.

3. **Treasury / loot index.** `callout loot` and `callout magic-item` blocks
   are scattered through recaps but never aggregated. A page collecting every
   magic item and notable haul (who carries it, which session it dropped)
   surfaces content that's currently buried in prose.

4. **RSS feed + sitemap.** No `@astrojs/sitemap`, no RSS. An RSS feed of recaps
   lets players subscribe to new sessions; a sitemap helps the deployed site.
   Both are near-zero-effort Astro integrations.

5. ~~Per-session dynamic OG images~~ — **done, see above.**

6. **Reading time + "dramatis personae" on recaps.** A reading-time estimate
   and an auto-generated cast strip (NPCs/characters appearing in a session,
   from the encounters array or entity links) at the top of each recap.

7. **Print stylesheet.** A `@media print` block so a recap or the campaign
   summary prints cleanly for players/DMs who want a hard copy.

8. **Replace the sample data.** The README still flags the current content as
   sample data from the design system. The features above only pay off once
   real campaign content fills them in. (Content work, not code.)
