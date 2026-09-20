import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { generatedLinkErrors } from '../integrations/generated-links.mjs';

async function fixture(t, files) {
  const directory = await mkdtemp(path.join(tmpdir(), 'icespire-links-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  for (const [name, content] of Object.entries(files)) {
    const target = path.join(directory, name);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, content);
  }
  return directory;
}

test('resolves nested, encoded, query, absolute and fragment links with HTML entities', async t => {
  const directory = await fixture(t, {
    'index.html': '<a href="/nested/?q=1&amp;x=2#one&amp;two">go</a><a href="https://example.com/nested#one%26two">go</a><a href="/guide">guide</a>',
    'nested/index.html': '<h2 id="one&amp;two">Heading</h2><a href="../#top">home</a><a name="legacy"></a><a href="#legacy">old</a><img src="../a%20b.png">',
    'a b.png': '', 'guide.html': '<a href="/#:~:text=hello">text fragment</a>',
  });
  // HTML's #top fallback scrolls to the top even without a named element.
  assert.deepEqual(await generatedLinkErrors(directory, 'https://example.com'), []);
});

test('reports missing pages, assets, fragments and malformed encoded targets', async t => {
  const directory = await fixture(t, { 'index.html': '<a href="/missing/">bad</a><img src="/absent.png"><a href="#absent">bad</a><a href="/%zz">bad</a>' });
  const errors = await generatedLinkErrors(directory, 'https://example.com');
  assert.equal(errors.length, 4);
  for (const reason of ['missing target /missing/', 'missing target /absent.png', 'missing fragment #absent', 'invalid URL or encoding']) assert.ok(errors.some(error => error.includes(reason)));
});

test('does not fetch external URLs or mistake scripts and comments for links', async t => {
  const directory = await fixture(t, { 'index.html': '<script>const example = \'<a href="/missing">\';</script><!-- <img src="/absent"> --><a href="https://elsewhere.example/missing">external</a><a href="mailto:hi@example.com">mail</a><img src="data:image/png;base64,abc">' });
  assert.deepEqual(await generatedLinkErrors(directory, 'https://example.com'), []);
});

test('map fragments require published rendered markers', async t => {
  const directory = await fixture(t, {
    'index.html': '<a href="/map/#visited">yes</a><a href="/map/#hidden">no</a>',
    'map/index.html': '<svg><g class="map-marker" data-slug="visited"></g></svg><div data-slug="hidden"></div>',
  });
  const errors = await generatedLinkErrors(directory, 'https://example.com');
  assert.equal(errors.length, 1);
  assert.match(errors[0], /missing fragment #hidden/);
});

test('configured base prefixes are resolved without checking another site root', async t => {
  const directory = await fixture(t, { 'index.html': '<a href="/campaign/next/">yes</a><a href="/outside/">no</a>', 'next/index.html': '<a href="../">home</a>' });
  const errors = await generatedLinkErrors(directory, 'https://example.com', '/campaign');
  assert.equal(errors.length, 1);
  assert.match(errors[0], /outside configured site base/);
});
