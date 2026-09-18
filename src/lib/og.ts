import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import satori from 'satori';
import sharp from 'sharp';

// Build-time Open Graph card generator. Sessions (and anything else that wants
// a distinct social preview) render through here, so a link dropped in Discord
// shows the session's own title instead of one shared static card.
//
// Pipeline: satori lays the card out with the campaign's own fonts and emits a
// self-contained SVG (text baked to vector paths), then sharp rasterises it to
// PNG. No network at build time — the fonts are bundled under src/assets.

export const OG_WIDTH = 1200;
export const OG_HEIGHT = 630;

// On-system palette (see src/styles/tokens/colors.css). Cards are always the
// Vellum theme — the primary one, and the campaign's face.
const COLOR = {
  bg: '#f4efe4', // ground
  copper: '#9a4a1c', // copper
  title: '#161d22', // ink
  date: '#3d4c55', // ink-secondary
  muted: '#556670', // ink-muted
} as const;

// Resolved from the project root: at build time satori runs from a bundled
// chunk under dist/, so a path relative to this module doesn't survive — but
// Astro always builds with the repo root as cwd.
const font = (name: string) => readFileSync(join(process.cwd(), 'src/assets/og-fonts', name));

const fonts = [
  { name: 'Fraunces', data: font('fraunces-600.woff'), weight: 600 as const, style: 'normal' as const },
  { name: 'Literata', data: font('literata-400.woff'), weight: 400 as const, style: 'normal' as const },
  { name: 'Literata', data: font('literata-600.woff'), weight: 600 as const, style: 'normal' as const },
  { name: 'IBM Plex Mono', data: font('plexmono-500.woff'), weight: 500 as const, style: 'normal' as const },
];

// satori takes a React-element-shaped tree; this keeps us in plain TS with no
// JSX build step. Each node is { type, props: { style, children } }.
type Node = { type: string; props: { style: Record<string, unknown>; children?: unknown } };
const h = (type: string, style: Record<string, unknown>, children?: unknown): Node => ({
  type,
  props: { style, children },
});

// Title fills the card, so long titles step down to stay on two lines or fewer.
function titleSize(title: string): number {
  const n = title.length;
  if (n <= 22) return 78;
  if (n <= 34) return 66;
  if (n <= 48) return 56;
  if (n <= 66) return 48;
  return 42;
}

export interface OgCard {
  /** Small label above the title, e.g. "Session 3". */
  kicker: string;
  title: string;
  /** Optional line under the title, e.g. the session date. */
  subtitle?: string;
}

export async function renderOgCard(card: OgCard): Promise<Buffer> {
  const tree = h(
    'div',
    {
      display: 'flex',
      flexDirection: 'column',
      width: OG_WIDTH,
      height: OG_HEIGHT,
      backgroundColor: COLOR.bg,
      color: COLOR.title,
      fontFamily: 'Literata',
    },
    [
      // A thin copper rule along the top — the chronicle's one warm accent.
      h('div', { display: 'flex', height: 8, width: '100%', backgroundColor: COLOR.copper }),
      h(
        'div',
        {
          display: 'flex',
          flexDirection: 'column',
          flexGrow: 1,
          justifyContent: 'space-between',
          padding: '68px 80px',
        },
        [
          // Header: kicker on the left, a quiet standing line on the right.
          h(
            'div',
            { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
            [
              h(
                'div',
                {
                  fontFamily: 'IBM Plex Mono',
                  fontWeight: 500,
                  fontSize: 26,
                  letterSpacing: 4,
                  textTransform: 'uppercase',
                  color: COLOR.copper,
                },
                card.kicker
              ),
              h(
                'div',
                {
                  fontFamily: 'IBM Plex Mono',
                  fontWeight: 500,
                  fontSize: 18,
                  letterSpacing: 4,
                  textTransform: 'uppercase',
                  color: COLOR.muted,
                },
                'A Campaign Chronicle'
              ),
            ]
          ),
          // Body: the title, and its date.
          h('div', { display: 'flex', flexDirection: 'column' }, [
            h(
              'div',
              {
                fontFamily: 'Fraunces',
                fontWeight: 600,
                fontSize: titleSize(card.title),
                lineHeight: 1.08,
                color: COLOR.title,
              },
              card.title
            ),
            ...(card.subtitle
              ? [
                  h(
                    'div',
                    {
                      display: 'flex',
                      marginTop: 24,
                      fontFamily: 'IBM Plex Mono',
                      fontWeight: 500,
                      fontSize: 26,
                      letterSpacing: 1,
                      color: COLOR.date,
                    },
                    card.subtitle
                  ),
                ]
              : []),
          ]),
          // Footer wordmark.
          h(
            'div',
            {
              display: 'flex',
              fontFamily: 'IBM Plex Mono',
              fontWeight: 500,
              fontSize: 22,
              letterSpacing: 4,
              textTransform: 'uppercase',
              color: COLOR.muted,
            },
            'Dragon of Icespire Peak'
          ),
        ]
      ),
    ]
  );

  const svg = await satori(tree as never, { width: OG_WIDTH, height: OG_HEIGHT, fonts });
  return sharp(Buffer.from(svg)).png().toBuffer();
}
