import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import securityHeaders from '../integrations/security-headers.mjs';

test('self-hosted fonts need no external CSP sources and inline scripts remain hash-pinned', async t => {
  const directory = await mkdtemp(path.join(tmpdir(), 'icespire-headers-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const script = "document.documentElement.dataset.theme = 'light';";
  await writeFile(path.join(directory, 'index.html'), `<script>${script}</script>`);

  await securityHeaders().hooks['astro:build:done']({
    dir: pathToFileURL(directory + path.sep),
    logger: { info() {} },
  });
  const headers = await readFile(path.join(directory, '_headers'), 'utf8');
  const csp = headers.match(/^  Content-Security-Policy: (.+)$/m)?.[1];
  assert.ok(csp, 'the generated headers include a CSP');
  const directives = new Map(csp.split('; ').map(directive => {
    const [name, ...sources] = directive.split(' ');
    return [name, sources.join(' ')];
  }));
  assert.equal(directives.get('style-src'), "'self' 'unsafe-inline'");
  assert.equal(directives.get('style-src-elem'), "'self'");
  assert.equal(directives.get('font-src'), "'self'");
  assert.doesNotMatch(csp, /https?:\/\//);
  const hash = createHash('sha256').update(script).digest('base64');
  assert.equal(directives.get('script-src'), `'self' 'sha256-${hash}'`);
});
