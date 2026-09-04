# Website improvements — running list

A living to-do list of site improvements, kept so it can be referenced across
work sessions. When you finish one, move it to **Done** with a one-line note.
When you think of a new one, add it under **Ideas** with enough detail that
someone (or a future chat) can pick it up cold.

Priorities are a rough guide, not a contract — reorder freely.

## Done

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

5. **"Ask the Chronicle" — an AI bot for player questions.** A box on the site
   where a player asks "who was that priest in Phandalin?" or "why do the orcs
   want the mine?" and gets an answer grounded in the published campaign. The
   whole publishable corpus (sessions, campaign summary, NPCs, factions, lore,
   characters, journey, published locations) is **~21.5k words / ~30k tokens**
   — it fits in a single prompt with room to spare, so this needs **no vector
   database, no embeddings, no chunking**. Three pieces:

   - **A corpus builder** that assembles published content into one text blob
     at build time. It must reuse the site's existing publish gates — a
     location with `status: unknown`, a session with `draft: true`, an
     `interiorSeen: false` interior — so the bot can never surface something
     the site itself withholds. That gating is the whole ballgame: 14 of 21
     locations are currently `unknown`, and every undiscovered sub-map is
     already drawn in the repo. Build the corpus from *published* entries
     only, never from a bare read of `src/content/`, and it stays spoiler-safe
     for free as the campaign advances. Emitting it as a public
     `/_corpus.txt` is fine by construction — every word of it is already on
     the site.
   - **A Cloudflare Pages Function** (`functions/api/ask.ts`) holding the API
     key as a Pages environment secret. Pages already hosts the site, so this
     adds no infrastructure. The browser only ever talks to our own origin,
     which the CSP's `connect-src 'self'` already permits — no policy change
     needed, and a bundled Astro `<script>` is external, so `script-src` is
     unaffected too. Note `dist/_headers` covers static assets; the function
     sets its own response headers.
   - **A chat box component**, probably on `/campaign/` or in the nav.

   Cost is negligible at our traffic: ~30k input tokens per question means
   roughly $0.01–0.06 per question depending on model and cache hits, i.e.
   single-digit dollars a month for seven players. The real risk is not cost
   per question but **an unauthenticated endpoint spending our key** — anyone
   who finds the URL can drive it. Gate it before shipping: Cloudflare
   Turnstile and/or a rate-limit rule, a hard cap on input length and
   `max_tokens`, and consider a shared password since the audience is one
   table.

   Two nice properties: the site rebuilds on every push to `main`, so the
   bot's knowledge advances with the campaign automatically; and answers can
   cite real site URLs, since every corpus entry maps to a page. Grounding
   instruction should be strict — answer only from the corpus, say "the
   chronicle doesn't record that" rather than inventing, and never speculate
   about what's coming. Pairs well with idea 1: the same corpus builder feeds
   a search index.

6. ~~Per-session dynamic OG images~~ — **done, see above.**

7. **Reading time + "dramatis personae" on recaps.** A reading-time estimate
   and an auto-generated cast strip (NPCs/characters appearing in a session,
   from the encounters array or entity links) at the top of each recap.

8. **Print stylesheet.** A `@media print` block so a recap or the campaign
   summary prints cleanly for players/DMs who want a hard copy.

9. **Replace the sample data.** The README still flags the current content as
   sample data from the design system. The features above only pay off once
   real campaign content fills them in. (Content work, not code.)
