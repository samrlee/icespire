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

   **Cloudflare Workers AI — investigated Sep 2026; it works, but not the way
   the section above assumes.** We are already on Cloudflare Pages, so a
   Workers AI binding replaces the API key outright: no secret to leak, no
   spend cap to set, nothing to rotate. Pages Functions do support the
   binding, but unlike a plain Worker it is configured in the **dashboard**
   (Pages project → Settings → Bindings → Workers AI), not in a config file,
   and reached as `context.env.AI.run(...)`. Free allowance is 10,000
   Neurons/day shared across all models, then $0.011/1,000 Neurons. Text
   generation is rate-limited around 300 req/min, far above anything we'd see.

   Measured against our real index (44 docs, ~30,700 tokens whole, ~1,800
   tokens for five typical entries, ~400-token answers):

   | Model | Prompt | Neurons/question | Free questions/day | $/question after |
   | --- | --- | --- | --- | --- |
   | Llama 3.1 8B | whole corpus | 140 | ~71 | $0.0015 |
   | Llama 3.1 8B | top-5 retrieved | 25 | ~403 | $0.0003 |
   | Llama 3.3 70B | whole corpus | 900 | ~11 | $0.0099 |
   | Llama 3.3 70B | top-5 retrieved | 152 | ~66 | $0.0017 |

   (Neuron rates: 8B 4,119 in / 34,909 out per M tokens; 70B 26,668 in /
   204,805 out. Cross-checked against the published per-token dollar prices.)

   **The finding that changes the design: don't send the whole corpus.** The
   "it all fits in one prompt, so no retrieval" conclusion above holds for a
   large-context commercial API. It does not hold here. Cloudflare serves many
   models with far smaller context than their headline spec — plenty sit at
   4K–8K, and the `fp8-fast` 70B is listed by third-party catalogues at 24K,
   which our ~30,700-token corpus would not fit. (Llama 3.1/3.2 do appear to
   serve their full 128K on Workers AI.) Cloudflare's own docs have at least
   one confirmed case of documented context exceeding what the API actually
   returns, so **the catalogue is not authoritative — ask the API.**

   Retrieval dissolves the problem instead of working around it. Feeding the
   top few search hits rather than everything cuts input roughly 17×, which
   simultaneously: fits every model in the catalogue including the 4K ones;
   makes the *good* model affordable (the 70B goes from ~11 to ~66 free
   questions a day); and needs no new machinery, because `/search-index.json`
   and the ranking in `src/scripts/search.ts` are already exactly the
   retrieval layer this wants. The bot becomes a thin reader over search.

   So the shape is **search first, model second**: the free index answers
   lookups outright, the model is called only for genuine "why/how" questions
   and only ever sees the handful of entries search already matched, and
   answers cache (Workers KV) so seven people asking the same thing after a
   session costs one call. Spoiler-safety comes along for free — the model
   can only ever see documents the index was allowed to contain.

   Still open before building: confirm the served context of whichever model
   we pick by asking the API rather than trusting the catalogue, and judge
   grounded-answer quality on real campaign questions — small open models
   confabulate more, and on a canon-of-record site that is the failure that
   matters. Keep Turnstile on the endpoint regardless; the binding removes the
   billing risk, not the abuse.

5. ~~Per-session dynamic OG images~~ — **done, see above.**

6. **Reading time + "dramatis personae" on recaps.** A reading-time estimate
   and an auto-generated cast strip (NPCs/characters appearing in a session,
   from the encounters array or entity links) at the top of each recap.

7. **Print stylesheet.** A `@media print` block so a recap or the campaign
   summary prints cleanly for players/DMs who want a hard copy.

8. **Replace the sample data.** The README still flags the current content as
   sample data from the design system. The features above only pay off once
   real campaign content fills them in. (Content work, not code.)
