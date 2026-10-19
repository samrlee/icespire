import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, readdir, mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import securityHeaders from '../integrations/security-headers.mjs';

const root = new URL('../', import.meta.url);
const requiredFaces = [
  { family: 'Cinzel', slug: 'cinzel', style: 'normal', weights: [400, 700], subsets: ['latin', 'latin-ext'] },
  { family: 'Crimson Pro', slug: 'crimson-pro', style: 'normal', weights: [400, 700], subsets: ['latin', 'latin-ext', 'vietnamese'] },
  { family: 'Crimson Pro', slug: 'crimson-pro', style: 'italic', weights: [400, 400], subsets: ['latin', 'latin-ext', 'vietnamese'] },
  { family: 'JetBrains Mono', slug: 'jetbrains-mono', style: 'normal', weights: [400, 500], subsets: ['latin', 'latin-ext', 'vietnamese', 'greek', 'cyrillic', 'cyrillic-ext'] },
];

test('published typography uses the licensed fingerprinted font subsets at the retained styles and weights', async () => {
  const cssURL = new URL('src/styles/fonts.css', root);
  const assetDirectory = new URL('src/assets/fonts/', root);
  const css = await readFile(cssURL, 'utf8');
  const global = await readFile(new URL('src/styles/global.css', root), 'utf8');
  assert.match(global, /@import\s+['"]\.\/fonts\.css['"]/);
  assert.doesNotMatch(global, /@import\s+['"]\.\/tokens\/fonts\.css['"]/);
  assert.doesNotMatch(css, /https?:|@import|local\(/);
  const faces = [...css.matchAll(/@font-face\s*\{([^}]+)\}/g)].map(([, body]) => ({
    family: body.match(/font-family:\s*['"]([^'"]+)['"]/)?.[1],
    style: body.match(/font-style:\s*(\w+)/)?.[1],
    weights: body.match(/font-weight:\s*(\d+)(?:\s+(\d+))?/)?.slice(1),
    file: body.match(/url\(([^)]+)\)/)?.[1],
    unicodeRange: body.match(/unicode-range:\s*([^;]+)/)?.[1],
    swap: /font-display:\s*swap\s*;/.test(body),
  }));
  const requiredFiles = requiredFaces.flatMap(face => face.subsets.map(subset => `${face.slug}-${subset}-wght-${face.style}.woff2`)).sort();
  assert.equal(faces.length, requiredFiles.length);
  assert.deepEqual((await readdir(assetDirectory)).filter(file => file.endsWith('.woff2')).sort(), requiredFiles);
  const checksums = new Map((await readFile(new URL('SHA256SUMS', assetDirectory), 'utf8')).trim().split('\n').map(line => {
    const match = line.match(/^([a-f0-9]{64})  ([\w.-]+\.woff2)$/);
    assert.ok(match, 'font checksum entries have a SHA-256 and filename');
    return [match[2], match[1]];
  }));
  assert.deepEqual([...checksums.keys()].sort(), requiredFiles);
  for (const required of requiredFaces) {
    const matchingFaces = faces.filter(face => face.family === required.family && face.style === required.style);
    assert.equal(matchingFaces.length, required.subsets.length, `${required.family} ${required.style} retains every subset`);
    for (const subset of required.subsets) {
      const filename = `${required.slug}-${subset}-wght-${required.style}.woff2`;
      const face = matchingFaces.find(face => face.file === `../assets/fonts/${filename}?no-inline`);
      assert.ok(face, `${filename} is fingerprinted and kept compatible with font-src self`);
      assert.ok(face.swap, `${filename} swaps without hiding text`);
      assert.match(face.unicodeRange ?? '', /^U\+[0-9A-F]/, `${filename} retains its Unicode range`);
      assert.deepEqual([Number(face.weights?.[0]), Number(face.weights?.[1] ?? face.weights?.[0])], required.weights);
      const assetURL = new URL(face.file, cssURL);
      assetURL.search = '';
      const file = await readFile(assetURL);
      assert.equal(file.toString('ascii', 0, 4), 'wOF2', `${filename} is a WOFF2 font`);
      assert.equal(file.readUInt32BE(8), file.length, `${filename} length matches the complete asset`);
      assert.equal(createHash('sha256').update(file).digest('hex'), checksums.get(filename), `${filename} matches the recorded package asset`);
    }
    const license = await readFile(new URL(`public/licenses/fonts/${required.slug}-OFL.txt`, root), 'utf8');
    assert.match(license, /Copyright/);
    assert.match(license, /SIL OPEN FONT LICENSE Version 1\.1/);
    assert.match(license, /PERMISSION & CONDITIONS/);
  }
});

test('generated security policy permits same-origin styles and fonts while retaining script hashes', async t => {
  const directory = await mkdtemp(path.join(tmpdir(), 'icespire-font-policy-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const script = 'document.documentElement.dataset.theme = "dark";';
  await writeFile(path.join(directory, 'index.html'), `<link rel="stylesheet" href="/_astro/site.css"><script>${script}</script>`);
  await securityHeaders().hooks['astro:build:done']({ dir: pathToFileURL(`${directory}/`), logger: { info() {} } });
  const headers = await readFile(path.join(directory, '_headers'), 'utf8');
  const policy = headers.match(/Content-Security-Policy:\s*([^\n]+)/)?.[1];
  assert.ok(policy);
  const directives = new Map(policy.split('; ').map(directive => {
    const [name, ...sources] = directive.split(' ');
    return [name, sources];
  }));
  assert.deepEqual(directives.get('style-src'), ["'self'", "'unsafe-inline'"]);
  assert.deepEqual(directives.get('style-src-elem'), ["'self'"]);
  assert.deepEqual(directives.get('font-src'), ["'self'"]);
  assert.deepEqual(directives.get('connect-src'), ["'self'"]);
  assert.deepEqual(directives.get('script-src'), ["'self'", `'sha256-${createHash('sha256').update(script).digest('base64')}'`]);
  assert.doesNotMatch(policy, /googleapis|gstatic|https?:/);
});
