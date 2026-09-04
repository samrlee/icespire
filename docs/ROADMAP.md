# Website improvements — running list

A living to-do list of site improvements, kept so it can be referenced across
work sessions. When you finish one, move it to **Done** with a one-line note.
When you think of a new one, add it under **Ideas** with enough detail that
someone (or a future chat) can pick it up cold.

Priorities are a rough guide, not a contract — reorder freely.

## Done

- **"Ask the Chronicle" — grounded Q&A over the campaign** — the palette offers
  to put a question to Llama 3.3 70B via Cloudflare's Workers AI binding, after
  retrieving only the published entries that bear on it
  (`functions/api/ask.ts`, ranking shared with search in
  `src/lib/search-rank.ts`). No API key: the binding is the credential.
  **Needs one dashboard step to go live** — Pages project → Settings →
  Bindings → Add → Workers AI, variable `AI` — until which the endpoint
  answers 503 and search carries on unaffected.

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

1. **Quest Board page (`/quests/`).** *Dragon of Icespire Peak* is built around
   Phandalin's job board. A page listing jobs (posted → active → completed →
   failed), each tied to a location and the session it resolved in. Nothing on
   the site currently tracks objectives.

2. **Treasury / loot index.** `callout loot` and `callout magic-item` blocks
   are scattered through recaps but never aggregated. A page collecting every
   magic item and notable haul (who carries it, which session it dropped)
   surfaces content that's currently buried in prose.

3. **RSS feed + sitemap.** No `@astrojs/sitemap`, no RSS. An RSS feed of recaps
   lets players subscribe to new sessions; a sitemap helps the deployed site.
   Both are near-zero-effort Astro integrations.

4. ~~Per-session dynamic OG images~~ — **done, see above.**

5. **Reading time + "dramatis personae" on recaps.** A reading-time estimate
   and an auto-generated cast strip (NPCs/characters appearing in a session,
   from the encounters array or entity links) at the top of each recap.

6. **Print stylesheet.** A `@media print` block so a recap or the campaign
   summary prints cleanly for players/DMs who want a hard copy.

7. **Replace the sample data.** The README still flags the current content as
   sample data from the design system. The features above only pay off once
   real campaign content fills them in. (Content work, not code.)
