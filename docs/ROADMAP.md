# Website improvements — running list

A living to-do list of site improvements, kept so it can be referenced across
work sessions. When you finish one, move it to **Done** with a one-line note.
When you think of a new one, add it under **Ideas** with enough detail that
someone (or a future chat) can pick it up cold.

Priorities are a rough guide, not a contract — reorder freely.

## Done

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

4. **"Ask the Chronicle" — an AI bot for player questions.** A box on the site
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
   about what's coming. The shipped search index (see Done)
   already proves the gating approach and gives the corpus builder a model to
   follow.

   **Next step is the free path: Cloudflare Workers AI.** Every account gets
   10,000 Neurons/day free (then $0.011/1,000), and we are already on
   Cloudflare Pages, so a binding replaces the API key entirely — nothing to
   leak and no bill to cap. Two things to check before committing to it: the
   per-model Neuron rate against a ~30k-token prompt, since the daily pool is
   shared across models and a whole-campaign prompt is a heavy request; and
   the served context limit in Cloudflare's model catalog rather than the
   model's headline spec. If the served context is smaller than the corpus,
   the "no retrieval needed" advantage is gone and this becomes a much larger
   job — at which point the search index above is already answering the
   lookup questions anyway. Smaller open models are also weaker at grounded
   Q&A, which on a canon-of-record site is the failure mode that matters.

   Whichever backend wins, the cheapest architecture is **search first, model
   second**: let the free index answer lookups, fall through to a model only
   for genuine "why/how" questions, and cache answers (Workers KV) so seven
   people asking the same thing after a session costs one call.

5. ~~Per-session dynamic OG images~~ — **done, see above.**

6. **Reading time + "dramatis personae" on recaps.** A reading-time estimate
   and an auto-generated cast strip (NPCs/characters appearing in a session,
   from the encounters array or entity links) at the top of each recap.

7. **Print stylesheet.** A `@media print` block so a recap or the campaign
   summary prints cleanly for players/DMs who want a hard copy.

8. **Replace the sample data.** The README still flags the current content as
   sample data from the design system. The features above only pay off once
   real campaign content fills them in. (Content work, not code.)
