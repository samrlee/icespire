import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cp, mkdir, mkdtemp, readFile, readdir, rm, symlink, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const root = fileURLToPath(new URL('../', import.meta.url));
const prefix = 'publication-fixture';
const drafts = [
  { id: `${prefix}-draft`, number: 1001, flag: 'true' },
  { id: `${prefix}/nested-draft`, number: 1003, flag: 'true' },
  { id: `${prefix}-comment-draft`, number: 1005, flag: 'true # awaiting review' },
];
const published = [
  { id: `${prefix}-body`, number: 1002, body: 'draft: true\n\nPUBLICATION_BODY_SENTINEL' },
  { id: `${prefix}/nested-published`, number: 1004, body: 'PUBLICATION_NESTED_SENTINEL' },
  { id: `${prefix}-last`, number: 1006, body: 'PUBLICATION_LAST_SENTINEL' },
];
const places = [
  { id: `${prefix}-a`, name: 'Fixture Visited A', status: 'visited', interiorSeen: false },
  { id: `${prefix}-b`, name: 'Fixture Visited B', status: 'visited', interiorSeen: true },
  { id: `${prefix}-known`, name: 'Fixture Known Place', status: 'known', interiorSeen: true },
  { id: `${prefix}-rumored`, name: 'Fixture Rumored Place', status: 'rumored', interiorSeen: true },
  { id: `${prefix}-unknown`, name: 'Fixture Unknown Place', status: 'unknown', interiorSeen: true },
  { id: `${prefix}-interior-only`, name: 'Fixture Shut Entrance', status: 'visited', interiorSeen: false },
];
const [a, b, known, rumored, unknown, shut] = places;

async function put(site, relative, contents) {
  const target = path.join(site, relative);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, contents);
}

async function fixtures(site) {
  for (const session of [...drafts, ...published]) {
    const body = session.body ?? `PUBLICATION_DRAFT_${session.number}`;
    await put(site, `src/content/sessions/${session.id}.md`, `---
title: Publication fixture ${session.number}
sessionNumber: ${session.number}
date: 2026-09-19
summary: ${body.split('\n').at(-1)}
encounters:
  - name: PUBLICATION_REPORTED_ENCOUNTER
    image: /images/creatures/orc.webp
    href: /map/#${known.id}
  - name: PUBLICATION_UNSEEN_ENCOUNTER
    image: /images/creatures/orc.webp
    href: /map/${shut.id}/
  - name: PUBLICATION_VISITED_ENCOUNTER
    image: /images/creatures/orc.webp
    href: /map/#${a.id}
${session.flag ? `draft: ${session.flag}\n` : ''}---
${body}

The report mentioned ${known.name} and ${rumored.name}.
`);
    const route = session.number === 1002
      ? [a.id, known.id, b.id, rumored.id, unknown.id]
      : [a.id, b.id, a.id];
    await put(site, `src/content/journey/${prefix}-${session.number}.yaml`, `session: ${session.number}
route: ${JSON.stringify(route)}
events:
  - at: ${a.id}
    title: ${session.flag ? `PUBLICATION_DRAFT_EVENT_${session.number}` : `PUBLICATION_EVENT_${session.number}`}
  - at: ${unknown.id}
    title: PUBLICATION_UNMAPPED_EVENT
`);
  }
  for (const place of places) {
    await put(site, `src/content/locations/${place.id}.md`, `---
name: ${place.name}
x: ${place === b ? 123 : 100}
y: 100
status: ${place.status}
interiorSeen: ${place.interiorSeen}
lore: ${place.id}
summary: PUBLICATION_LOCATION_${place.status}_${place.id}
---
PUBLICATION_LOCATION_BODY_${place.id}
`);
    await put(site, `src/content/lore/${place.id}.md`, `---
title: Report about ${place.name}
---
PUBLICATION_REPORT mentions ${place.name}.
`);
  }
  // Synthetic geometry/legend exist only in the disposable copy. Every state
  // has a registered map, so missing output actually exercises the gates.
  await put(site, 'src/components/map/submaps/PublicationFixture.astro', `---
interface Props { interior?: boolean }
const { interior = false } = Astro.props;
---
<g id="PUBLICATION_EXTERIOR"><path d="M0 0 H10" /></g>
{interior && <g id="PUBLICATION_INTERIOR_GEOMETRY"><title>PUBLICATION_INTERIOR_TOOLTIP</title><path d="M1 1 H9" /></g>}
`);
  const registryPath = path.join(site, 'src/components/map/submaps/registry.ts');
  const registry = await readFile(registryPath, 'utf8');
  await writeFile(registryPath,
    `import PublicationFixture from './PublicationFixture.astro';\n` + registry.replace(
      'export const submaps: Record<string, SubmapEntry> = {',
      'export const submaps: Record<string, SubmapEntry> = {\n' + places.map(place => `
  '${place.id}': {
    Component: PublicationFixture, width: 10, height: 10,
    interiorOnly: ${place === shut},
    legend: [
      { label: 'PUBLICATION_EXTERIOR_KEY' },
      { label: 'PUBLICATION_INTERIOR_KEY', note: 'PUBLICATION_INTERIOR_NOTE', interior: true },
    ],
  },`).join('\n')));
}

async function build(site) {
  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(root, 'node_modules/astro/bin/astro.mjs'), 'build'], {
      cwd: site, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, ASTRO_TELEMETRY_DISABLED: '1' },
    });
    let output = '';
    child.stdout.on('data', chunk => { output += chunk; });
    child.stderr.on('data', chunk => { output += chunk; });
    child.on('error', reject);
    child.on('close', code => code === 0 ? resolve() : reject(new Error(`Fixture build failed (${code}):\n${output}`)));
  });
}

async function filesIn(dir) {
  const files = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await filesIn(full));
    else files.push(full);
  }
  return files;
}

function jsonIsland(html, id) {
  const match = html.match(new RegExp(`<script[^>]*id="${id}"[^>]*>([\\s\\S]*?)</script>`));
  assert.ok(match, `missing ${id} JSON island`);
  return JSON.parse(match[1]);
}

test('production publication across assembled routes, indexes, maps and navigation', async t => {
  const site = await mkdtemp(path.join(tmpdir(), 'icespire-publication-'));
  try {
    // No writes to campaign files or the real dist/. No old build/cache is copied.
    for (const item of ['src', 'public', 'integrations', 'astro.config.mjs', 'tsconfig.json', 'package.json']) {
      await cp(path.join(root, item), path.join(site, item), { recursive: true });
    }
    await symlink(path.join(root, 'node_modules'), path.join(site, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir');
    await fixtures(site);
    await build(site);
    const dist = path.join(site, 'dist');
    const files = await filesIn(dist);
    const html = relative => readFile(path.join(dist, relative), 'utf8');
    const map = await html('map/index.html');
    const timeline = await html('timeline/index.html');
    const recap = await html(`sessions/${published[0].id}/index.html`);
    const search = JSON.parse(await html('search-index.json'));
    const sitemap = (await Promise.all(files.filter(f => /sitemap.*\.xml$/.test(f)).map(f => readFile(f, 'utf8')))).join('\n');
    const textFiles = files.filter(f => /\.(html|json|xml|js|txt)$/.test(f));
    const allText = (await Promise.all(textFiles.map(f => readFile(f, 'utf8')))).join('\n');

    await t.test('plain, nested and YAML-comment drafts emit no artifacts or public contributions', () => {
      for (const draft of drafts) {
        assert.ok(!files.includes(path.join(dist, `sessions/${draft.id}/index.html`)));
        assert.ok(!files.includes(path.join(dist, `og/sessions/${draft.id}.png`)));
        assert.ok(!allText.includes(draft.id), `draft URL leaked: ${draft.id}`);
        assert.ok(!allText.includes(`Publication fixture ${draft.number}`));
        assert.ok(!allText.includes(`PUBLICATION_DRAFT_${draft.number}`));
        assert.ok(!allText.includes(`PUBLICATION_DRAFT_EVENT_${draft.number}`));
        assert.ok(!map.includes(`data-session="${draft.number}"`));
      }
    });

    await t.test('body draft text and nested published recaps build and preserve previous/next ordering', async () => {
      assert.ok(recap.includes('draft: true'));
      for (const [i, session] of published.entries()) {
        const page = await html(`sessions/${session.id}/index.html`);
        assert.ok(page.includes(session.body.split('\n').at(-1)));
        assert.ok(files.includes(path.join(dist, `og/sessions/${session.id}.png`)));
        assert.ok(sitemap.includes(`/sessions/${session.id}/`));
        assert.ok(search.some(doc => doc.href === `/sessions/${session.id}/`));
        const pager = page.match(/<nav class="session-pager"[\s\S]*?<\/nav>/)?.[0];
        assert.ok(pager);
        const prev = i === 0 ? 'session-9' : published[i - 1].id;
        assert.ok(pager.includes(`href="/sessions/${prev}/"`));
        if (i + 1 < published.length) assert.ok(pager.includes(`href="/sessions/${published[i + 1].id}/"`));
        else assert.ok(!pager.includes('pager-link next'));
      }
      assert.ok((await html('sessions/session-9/index.html')).includes(`href="/sessions/${published[0].id}/"`));
      assert.ok((await html('index.html')).includes(`href="/sessions/${published.at(-1).id}/"`));
    });

    await t.test('reported places remain readable without unavailable marker links or location payloads', () => {
      for (const place of [known, rumored]) {
        assert.ok(recap.includes(place.name));
        assert.ok(timeline.includes(place.name));
        assert.ok(search.some(doc => doc.kind === 'Recap' && doc.text.includes(place.name)));
      }
      assert.ok(recap.includes('PUBLICATION_REPORTED_ENCOUNTER'));
      assert.ok(recap.includes('PUBLICATION_UNSEEN_ENCOUNTER'));
      const entities = jsonIsland(recap, 'entity-link-data');
      for (const place of [known, rumored, unknown]) {
        assert.ok(!allText.includes(`/map/#${place.id}`));
        assert.ok(!map.includes(place.id));
        assert.ok(!map.includes(place.name));
        assert.ok(!search.some(doc => doc.href === `/map/#${place.id}`));
        assert.ok(!entities.some(entity => entity.href === `/map/#${place.id}`));
        assert.ok(!allText.includes(`PUBLICATION_LOCATION_BODY_${place.id}`));
        assert.ok(!files.includes(path.join(dist, `map/${place.id}/index.html`)));
      }
      assert.ok(!map.includes('PUBLICATION_UNMAPPED_EVENT'));
    });

    await t.test('unseen interiors withhold geometry, tooltips, legend, pages and links', async () => {
      const exterior = await html(`map/${a.id}/index.html`);
      assert.ok(exterior.includes('PUBLICATION_EXTERIOR'));
      assert.ok(exterior.includes('PUBLICATION_EXTERIOR_KEY'));
      for (const sentinel of ['GEOMETRY', 'TOOLTIP', 'KEY', 'NOTE']) {
        assert.ok(!exterior.includes(`PUBLICATION_INTERIOR_${sentinel}`));
        assert.ok(!map.includes(`PUBLICATION_INTERIOR_${sentinel}`));
        assert.ok((await html(`map/${b.id}/index.html`)).includes(`PUBLICATION_INTERIOR_${sentinel}`));
      }
      assert.ok(!files.includes(path.join(dist, `map/${shut.id}/index.html`)));
      assert.ok(!allText.includes(`/map/${shut.id}/`));
      assert.ok(map.includes(`data-slug="${shut.id}"`));
    });

    await t.test('hidden stops never create shortcut arcs, journey arrows or replay routes', () => {
      const routeTags = [...map.matchAll(/<g\b[^>]*class="map-route-leg[^>]*>/g)].map(m => m[0]);
      assert.ok(!routeTags.some(tag => tag.includes('data-session="1002"')));
      assert.equal(routeTags.filter(tag => tag.includes('data-session="1004"')).length, 2);
      const replay = jsonIsland(map, 'scrub-data');
      assert.equal(replay.find(rung => rung.session === 1002).route, `${a.name} … ${b.name}`);
      assert.equal(replay.find(rung => rung.session === 1004).route, `${a.name} → ${b.name} → ${a.name}`);
      const route = map.match(/<li class="mj-leg" data-session="1002">[\s\S]*?<p class="mj-route">([\s\S]*?)<\/p>/)?.[1];
      assert.ok(route);
      assert.ok(route.includes('…'));
      assert.ok(!route.includes('→'));
      assert.ok(!drafts.some(draft => replay.some(rung => rung.session === draft.number)));
    });

    await t.test('existing published map destinations, recap links and generated headers survive', async () => {
      assert.ok(map.includes('data-slug="phandalin"'));
      assert.ok(map.includes('href="/map/phandalin/"'));
      assert.ok(map.includes('href="/sessions/session-9/"'));
      assert.ok(recap.includes(`href="/map/#${a.id}"`));
      assert.ok(timeline.includes(`href="/map/#${a.id}"`));
      const encounter = recap.match(/<div class="creature-name">([^<]*|<a[^>]*>PUBLICATION_VISITED_ENCOUNTER<\/a>)<\/div>/g);
      assert.ok(encounter?.some(item => item.includes(`href="/map/#${a.id}"`)));
      assert.ok((await html(`lore/${a.id}/index.html`)).includes(`href="/map/${a.id}/"`));
      assert.ok((await html(`lore/${shut.id}/index.html`)).includes(`href="/map/#${shut.id}"`));
      assert.ok((await html('map/gnomengarde/index.html')).includes('gn-room-walls'));
      assert.ok(!files.includes(path.join(dist, 'map/mountains-toe-gold-mine/index.html')));
      assert.ok(!files.some(f => f.includes('offical-assets')));
      const headers = await html('_headers');
      assert.match(headers, /script-src 'self' 'sha256-/);
      assert.doesNotMatch(headers, /script-src[^;]*'unsafe-inline'/);
    });
    await t.test('the assembled build rejects missing pages, images and fragments', async () => {
      await put(site, 'src/pages/link-fixture.astro', `<a href="/missing-fixture/">Missing</a>
<a href="/campaign/#missing-fixture-anchor">Missing anchor</a>
<img src="/missing-fixture-image.png" alt="Fixture" />`);
      await assert.rejects(build(site), error => {
        for (const diagnostic of ['Generated link validation failed', 'missing target /missing-fixture/',
          'missing fragment #missing-fixture-anchor', 'missing target /missing-fixture-image.png']) {
          assert.ok(error.message.includes(diagnostic), `missing diagnostic: ${diagnostic}\n${error.message}`);
        }
        return true;
      });
      await unlink(path.join(site, 'src/pages/link-fixture.astro'));
    });

    await t.test('the assembled build rejects broken references even in draft content', async () => {
      await put(site, 'src/content/sessions/integrity-broken.md', `---
title: Integrity fixture
sessionNumber: 1001
date: 2026-09-19
draft: true
playersPresent: [UnknownPlayer]
encounters:
  - name: Missing creature
    image: /images/integrity-missing.webp
---
Disposable draft.
`);
      await put(site, 'src/content/npcs/integrity-broken.md', `---
name: Integrity witness
faction: integrity-missing
firstAppearance: 99999
portrait: /images/integrity-missing-npc.webp
---
Disposable witness.
`);
      await assert.rejects(build(site), error => {
        for (const diagnostic of ['Content reference validation failed', 'duplicate sessionNumber 1001',
          'UnknownPlayer', 'npcs/integrity-broken: faction', 'firstAppearance',
          'encounters.image (Missing creature): missing public image', 'portrait: missing public image']) {
          assert.ok(error.message.includes(diagnostic), `missing diagnostic: ${diagnostic}\n${error.message}`);
        }
        return true;
      });
    });
  } finally {
    assert.equal(path.dirname(path.resolve(site)), path.resolve(tmpdir()));
    assert.ok(path.basename(site).startsWith('icespire-publication-'));
    // Remove the dependency link first; never traverse the real dependencies.
    await unlink(path.join(site, 'node_modules')).catch(error => {
      if (error.code !== 'ENOENT') throw error;
    });
    await rm(site, { force: true, recursive: true });
  }
});
