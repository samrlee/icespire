import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';
import { glob } from 'astro/loaders';

// One Markdown file per entry. Frontmatter is validated against these
// schemas at build time, so a typo'd field fails loudly instead of
// rendering a broken page.

// A name/title that has to appear on the page. Bare z.string() accepts "",
// which renders as a blank card — and an empty name becomes an empty alias in
// components/EntityLinks.astro, where it matches at every position and hangs
// the entity linker. Require something to actually show.
const filled = () => z.string().trim().min(1);

// A path under /public or an in-site link. Anchored to a single leading slash:
// "//evil.example" is a protocol-relative URL that would quietly point a
// portrait or a card link off-site.
const sitePath = () =>
  z
    .string()
    .regex(/^\/(?!\/)/, 'must be a site-relative path beginning with a single "/"');

const sessions = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/sessions' }),
  schema: z.object({
    title: filled(),
    sessionNumber: z.number().int().nonnegative(),
    date: z.coerce.date(),
    // One-liner shown in the session list.
    summary: z.string().optional(),
    // Which players were at the table (handy with a 7-player roster).
    playersPresent: z.array(z.string()).default([]),
    // Creatures and characters met this session, rendered as an art gallery
    // at the end of the recap (and as thumbnails on the recap card).
    // Official art lives under /images/creatures/.
    encounters: z
      .array(
        z.object({
          name: filled(),
          image: sitePath(), // path under /public
          note: z.string().optional(),
          // Optional site link (an NPC page, a map anchor, ...).
          href: sitePath().optional(),
        })
      )
      .default([]),
    draft: z.boolean().default(false),
  }),
});

const characters = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/characters' }),
  schema: z.object({
    name: filled(),
    player: filled(),
    ancestry: filled(), // race/species
    class: filled(),
    level: z.number().int().positive().optional(),
    status: z.enum(['active', 'retired', 'dead', 'missing']).default('active'),
    // Path under /public, e.g. /images/characters/rook.jpg
    portrait: sitePath().optional(),
    // One-line bio shown on the roster card ("Builds things that mostly work.")
    tagline: z.string().optional(),
    // Short descriptors rendered as pills ("Tinkerer", "Afraid of Dragons")
    traits: z.array(z.string()).default([]),
  }),
});

const npcs = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/npcs' }),
  schema: z.object({
    name: filled(),
    role: z.string().optional(), // e.g. "Innkeeper", "White Dragon"
    affiliation: z.string().optional(), // shown next to role: place, group, or faction name
    faction: z.string().optional(), // slug of a faction entry, for linking
    // Disposition toward the party (drives the status pill AND the colour of
    // the figure's line on the relationship graph). Keep the bar for "ally"
    // high or the graph floods green and stops meaning anything:
    //   ally       — has given the party real, material aid, or is a committed
    //                 friend/asset who would take their side. Not merely polite.
    //   hostile    — actively opposed to the party. Renders in ember.
    //   unresolved — a relationship the story hasn't settled; owed a reckoning
    //                either way. Renders as "Unresolved Thread".
    //   at-large   — a wildcard the party has lost track of: escaped, fled, or
    //                otherwise unaccounted for and still out there. Renders as
    //                "At Large". Reserve it for the genuinely loose — most
    //                met-and-parted NPCs are "neutral", not "at-large".
    //   neutral    — met and non-hostile, but not committed: townsfolk,
    //                patrons, one-off contacts, the newly-met. Renders as
    //                "Neutral". This is the default — an NPC earns "ally", they
    //                don't start there.
    status: z.enum(['ally', 'hostile', 'unresolved', 'at-large', 'neutral']).default('neutral'),
    // Short directory blurb ("Means well. Is in over his head.")
    note: z.string().optional(),
    firstAppearance: z.number().int().optional(), // session number
    portrait: sitePath().optional(),
  }),
});

const factions = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/factions' }),
  schema: z.object({
    name: filled(),
    type: z.string().optional(), // guild, cult, kingdom, ...
    status: z.enum(['active', 'destroyed', 'dormant', 'unknown']).default('active'),
    alignment: z.string().optional(), // friendly / hostile / complicated
    summary: z.string().optional(),
  }),
});

const locations = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/locations' }),
  schema: z.object({
    name: filled(),
    // Position on the map SVG, in viewBox units (0–1000 wide, 0–750 tall).
    x: z.number().min(0).max(1000),
    y: z.number().min(0).max(750),
    kind: z
      .enum(['town', 'settlement', 'landmark', 'dungeon', 'camp', 'lair'])
      .default('landmark'),
    // visited = the party has been there; known = seen/confirmed from afar;
    // rumored = only heard about; unknown = not yet discovered — the location
    // (and any sub-map) exists in the repo but renders nowhere on the site.
    status: z.enum(['visited', 'known', 'rumored', 'unknown']).default('unknown'),
    // Renders the marker in ember (reserved for genuine danger).
    danger: z.boolean().default(false),
    firstVisited: z.number().int().optional(), // session number
    // One-liner for the marker tooltip and the top of the detail panel.
    summary: z.string().optional(),
    // Which side of the marker the map label sits on.
    labelPlacement: z.enum(['top', 'bottom', 'left', 'right']).default('bottom'),
    // Optional slugs of a lore entry / faction entry to link from the panel.
    lore: z.string().optional(),
    faction: z.string().optional(),
  }),
});

// One YAML file per session: where the party travelled (ordered location
// slugs — consecutive stops become route segments on the map) and what
// happened where (event pins).
const journey = defineCollection({
  loader: glob({ pattern: '**/*.yaml', base: './src/content/journey' }),
  schema: z.object({
    session: z.number().int().nonnegative(),
    route: z.array(z.string()).default([]),
    events: z
      .array(
        z.object({
          title: filled(),
          at: filled(), // location slug
          note: z.string().optional(),
          // battle pins render in ember; everything else in gold.
          kind: z.enum(['battle', 'discovery', 'social', 'omen']).default('discovery'),
        })
      )
      .default([]),
  }),
});

const lore = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/lore' }),
  schema: z.object({
    title: filled(),
    category: filled().default('general'), // places, history, items, ...
    summary: z.string().optional(),
  }),
});

export const collections = { sessions, characters, npcs, factions, lore, locations, journey };
