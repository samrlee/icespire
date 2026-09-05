# Working on this repo — a handoff for AI coding tools

This is the campaign website for a *Dragon of Icespire Peak* D&D game: session
recaps, a running campaign summary, a party roster, an NPC directory, a faction
and lore codex, a hand-drawn map, a relationship graph, site-wide search, and a
small grounded Q&A bot over the published content. It is an [Astro](https://astro.build)
site deployed to Cloudflare Pages at **https://icespire.ghostbloods.net/**,
which redeploys on every push to `main`.

This file is the handoff. It exists so that any AI coding tool — Claude Code,
Cursor, Codex, Copilot, whatever comes next — can be pointed at this repo cold
and work the way it has been worked so far, without the owner re-explaining the
conventions every time. Claude Code reads `CLAUDE.md`, which points here; most
other tools read this file directly. Keep them in sync by keeping the content
in this one.

## Read these, in this order

1. **This file** — how the repo works, and the rules that are not obvious from
   reading the code.
2. **[`README.md`](README.md)** — the reference manual. Every collection, every
   frontmatter field, the map, the graph, search, the Ask endpoint, the CSP,
   the deploy. It is long and it is accurate. Never guess at a field name when
   it is written down there.
3. **[`docs/SESSION-WORKFLOW.md`](docs/SESSION-WORKFLOW.md)** — the recording →
   whisperx → transcript → agent → published-site pipeline. This is the job
   most of the time.
4. **[`docs/WRITING-STYLE.md`](docs/WRITING-STYLE.md)** — the chronicle's voice.
   Read it before writing a word of campaign prose.
5. **[`docs/ROADMAP.md`](docs/ROADMAP.md)** — what is done and what is planned.
   Check it before starting feature work, and update it when you finish some.

## Running it

```sh
npm install
npm run dev      # localhost:4321
npm run check    # astro check — types and template errors
npm run build    # production build; also validates every content file
```

Node 22 (pinned in `.nvmrc`). `npm run build` is the content linter: frontmatter
is validated by `src/content.config.ts`, and an unknown location slug in a
journey file fails the build. **Always run `npm run check && npm run build`
before committing** — CI (`.github/workflows/ci.yml`) runs both on every PR, plus
`npm audit --omit=dev --audit-level=high`.

Note `npm run preview` serves the built site but does **not** apply
`dist/_headers`, so it will not show you CSP problems.

## The two kinds of work

**Content work** — a new session goes up, an NPC's disposition changes, a place
is discovered. This is most of it, and it is what
[`docs/SESSION-WORKFLOW.md`](docs/SESSION-WORKFLOW.md) covers end to end. It
touches only Markdown and YAML under `src/content/` plus `src/pages/campaign.md`.

**Site work** — a new page type, a component, a build integration. Check
[`docs/ROADMAP.md`](docs/ROADMAP.md) first; the next few ideas are already
sketched with enough detail to pick up cold.

## Where things live

| What | Where |
| --- | --- |
| Session recaps | `src/content/sessions/session-N.md` |
| Where the party went, and what happened where | `src/content/journey/session-N.yaml` |
| Running campaign summary | `src/pages/campaign.md` (one page, edited in place) |
| Party | `src/content/characters/` |
| NPCs | `src/content/npcs/` |
| Factions / lore | `src/content/factions/`, `src/content/lore/` |
| Places on the map | `src/content/locations/` |
| Region map terrain | `src/components/map/MapTerrain.astro` |
| Local site maps | `src/components/map/submaps/` + `registry.ts` |
| Content schemas (the source of truth for frontmatter) | `src/content.config.ts` |
| Design tokens / component CSS | `src/styles/tokens/`, `src/styles/global.css` |
| Search index + ranking | `src/lib/search-index.ts`, `src/lib/search-rank.ts` |
| Ask endpoint (Cloudflare Pages Function) | `functions/api/ask.ts` |
| Response headers / CSP | `integrations/security-headers.mjs` |
| Official module scans (**reference only, never shipped**) | `offical-assets/` |

## The rules that are not obvious

**The repo knows more than the site publishes, and that gap is deliberate.**
Three gates hold it: `draft: true` on a session, `status: unknown` on a
location, and `interiorSeen: false` on a place whose inside the party has not
walked. Every undiscovered official site is already drawn and sitting in the
repo waiting for its status to be flipped. Publishing one early spoils the
game.

**Search and the Ask bot inherit those gates rather than re-implementing them.**
`src/lib/search-index.ts` filters each collection exactly as its page filters,
and `functions/api/ask.ts` only ever sees documents the index was allowed to
contain. If you add a collection to the index, bring its publish gate with it —
reaching for a bare `getCollection()` there is how a spoiler ships.

**Never write module knowledge the party has not earned.** You may well know
what is inside Axeholm. The chronicle does not, until they walk in. This
applies to prose, to lore entries, to map rooms, and to anything the Ask bot
could retrieve.

**Never present the table's inference as the chronicle's fact.** If nobody at
the table said it, it does not get asserted. This has needed correcting more
than once — see the "record what happened, not what it meant" section of
[`docs/WRITING-STYLE.md`](docs/WRITING-STYLE.md).

**Several pages are derived — do not hand-edit them.** The timeline
(`/timeline/`), the relationship graph (`/graph/`), the map markers and routes,
the search index, and each session's Open Graph card are all generated at build
time from the content collections. Add an NPC with a `faction` and a `status`
and the graph grows on its own.

**Prose links itself.** `src/components/EntityLinks.astro` turns the first
mention of any character, NPC, faction, or known location inside `.prose` into a
link with a hover card. Do not hand-write `[Adabra Gwynn](/npcs/adabra-gwynn)`
in a recap — write the name. If a name is not linking, check the `STOP_TOKENS`
list and the alias rules in that component.

**The `ally` bar is high, on purpose.** An NPC earns `ally` with real material
aid; `neutral` is the default for met-and-parted. NPC `status` colours their
line on the relationship graph, so a generous hand there floods the graph green
and it stops meaning anything. The full ladder is documented in `README.md` and
in the schema comments.

**Design system, in one breath:** dark "Night in the Wilds" is default; cold
slate neutrals; **gold is the only "pay attention" colour**; **ember red is
reserved for danger and hostility**; Cinzel for display, Crimson Pro for body,
JetBrains Mono for stat blocks. No emoji, no parchment textures. Tokens in
`src/styles/tokens/` are verbatim from the design project — change component
CSS in `global.css`, not the tokens.

**`dist/_headers` is generated, not written.** `integrations/security-headers.mjs`
emits it at build time and hashes every inline script into the CSP's
`script-src`, which is what lets the policy drop `'unsafe-inline'`. Edit the
integration; never add a `public/_headers`. Two invariants it leans on:
`build.inlineStylesheets: 'never'` in `astro.config.mjs`, and the Google Fonts
allowances that exist only for the `@import` in `src/styles/tokens/fonts.css`.

**There are no secrets in this repo, and it should stay that way.** The Ask
endpoint uses Cloudflare's Workers AI *binding* rather than an API key — the
binding is the credential, configured once in the dashboard. Nothing here needs
a `.env`.

## Git conventions

Work on a branch, never commit to `main` directly, and open a PR — CI has to
build the site before anything deploys. The deploy itself is Cloudflare Pages
watching `main`; there is no deploy workflow to run.

Commit messages here do a real job, because the campaign's history *is* the
project's history. The pattern in `git log` is worth matching: an imperative
subject line saying what changed in plain language ("Add Session 7: the hidden
chamber, a debt paid, and a dragon", "Fix how the dragons-eat-people
conversation actually went"), then a body that groups the change by area —
Content / Design system / Roadmap — and says *why* where the why is not
obvious. Session commits list what moved in the campaign, not what moved in the
filesystem.

Read `git log` for the last few sessions before writing a session commit. It is
the fastest way to see both the shape of the work and the shape of the message.
