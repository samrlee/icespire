import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import securityHeaders from '../integrations/security-headers.mjs';

const root = new URL('../', import.meta.url);
const requiredFaces = [
  { family: 'Cinzel', style: 'normal', weights: [400, 500, 600, 700, 800] },
  { family: 'Crimson Pro', style: 'normal', weights: [400, 500, 600, 700] },
  { family: 'Crimson Pro', style: 'italic', weights: [400, 600, 700] },
  { family: 'JetBrains Mono', style: 'normal', weights: [400, 500] },
];

test('published typography uses licensed local variable faces at every requested weight', async () => {
  const css = await readFile(new URL('src/styles/fonts.css', root), 'utf8');
  const global = await readFile(new URL('src/styles/global.css', root), 'utf8');
  assert.match(global, /@import\s+['"]\.\/fonts\.css['"]/);
  assert.doesNotMatch(global, /@import\s+['"]\.\/tokens\/fonts\.css['"]/);
  assert.doesNotMatch(css, /https?:|@import|local\(/);
  const faces = [...css.matchAll(/@font-face\s*\{([^}]+)\}/g)].map(([, body]) => ({
    family: body.match(/font-family:\s*['"]([^'"]+)['"]/)?.[1],
    style: body.match(/font-style:\s*(\w+)/)?.[1],
    weights: body.match(/font-weight:\s*(\d+)\s+(\d+)/)?.slice(1).map(Number),
    file: body.match(/url\(['"](\/fonts\/[^'"]+\.woff2)['"]\)/)?.[1],
    swap: /font-display:\s*swap\s*;/.test(body),
  }));
  assert.equal(faces.length, requiredFaces.length);
  const sources = JSON.parse(await readFile(new URL('public/fonts/SOURCES.json', root), 'utf8'));
  assert.match(sources.revision, /^[a-f0-9]{40}$/);
  for (const required of requiredFaces) {
    const face = faces.find(face => face.family === required.family && face.style === required.style);
    assert.ok(face, `${required.family} ${required.style} is available`);
    assert.ok(face.swap, `${required.family} swaps without hiding text`);
    assert.ok(face.file, `${required.family} loads from this origin`);
    for (const weight of required.weights) assert.ok(weight >= face.weights[0] && weight <= face.weights[1]);
    const file = await readFile(new URL(`public${face.file}`, root));
    assert.equal(file.toString('ascii', 0, 4), 'wOF2', 'asset is a WOFF2 font');
    assert.equal(file.readUInt32BE(8), file.length, 'WOFF2 length matches the complete asset');
    const source = sources.fonts.find(source => `/fonts/${source.file}` === face.file);
    assert.equal(source?.family, required.family);
    assert.deepEqual(source.axes.wght, face.weights);
    assert.equal(createHash('sha256').update(file).digest('hex'), source.sha256);
    assert.ok(source.source.startsWith(`${sources.repository}/blob/${sources.revision}/`));
    const license = await readFile(new URL(`public/fonts/${source.license}`, root), 'utf8');
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
