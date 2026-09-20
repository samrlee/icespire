import { execFileSync } from 'node:child_process';
import { readFile, mkdir, writeFile, appendFile, unlink } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parse } from 'yaml';
import { isSessionPublished } from '../src/lib/session-publication.ts';
import { isMapLocationPublished, isMapInteriorPublished } from '../src/lib/map-publication.ts';
import { contentReferenceErrors } from '../src/lib/content-integrity.ts';

const collections = ['sessions', 'characters', 'npcs', 'factions', 'lore', 'locations', 'journey'];
const paths = ['src/content', 'src/pages/campaign.md', 'docs/CAMPAIGN-CANON.md', 'docs/TABLE-FACTS.md'];
const git = (...args) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, windowsHide: true });
// Names and diagnostics are repository data, never raw Markdown/HTML.
const escape = value => String(value).replace(/[&<>"'`*_[\]\\|\r\n]/g, char => `&#${char.charCodeAt(0)};`);

export function parseRecord(file, source) {
  let yaml = source;
  if (file.endsWith('.md')) {
    const lines = source.replace(/^\uFEFF/, '').split(/\r?\n/);
    if (lines[0] !== '---') throw new Error(`${file}: missing frontmatter`);
    const end = lines.indexOf('---', 1);
    if (end < 0) throw new Error(`${file}: unclosed frontmatter`);
    yaml = lines.slice(1, end).join('\n');
  }
  const data = parse(yaml);
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error(`${file}: expected a record`);
  return data;
}

export function snapshot(files) {
  const content = Object.fromEntries(collections.map(name => [name, []]));
  let current;
  for (const [file, source] of files) {
    const match = file.match(/^src\/content\/([^/]+)\/(.+)\.(md|yaml)$/);
    if (!match) continue;
    const [, collection, id] = match;
    if (!collections.includes(collection) && collection !== 'current-state') continue;
    const data = parseRecord(file, source);
    if (collection === 'current-state') { if (id === 'current') current = data; continue; }
    // These defaults mirror omitted optional arrays; Astro remains the schema authority.
    content[collection].push({ id, data: { playersPresent: [], encounters: [], route: [], events: [], ...data } });
  }
  return { content, current };
}

export function reviewReport(beforeFiles, afterFiles, base) {
  const before = snapshot(beforeFiles);
  const after = snapshot(afterFiles);
  const out = ['# Publication review', '', `Compared with ${escape(base)}.`, '',
    'Mechanical review aid, not approval of campaign facts, character knowledge, or map geometry. Build/type/link checks remain authoritative. This report is repository review material, not website output.', '', '## Changed campaign files', ''];
  const changed = [...new Set([...beforeFiles.keys(), ...afterFiles.keys()])].sort()
    .filter(file => beforeFiles.get(file)?.replaceAll('\r\n', '\n') !== afterFiles.get(file)?.replaceAll('\r\n', '\n'));
  for (const file of changed) out.push(`- ${!beforeFiles.has(file) ? 'Added' : !afterFiles.has(file) ? 'Deleted' : 'Modified'}: ${escape(file)}`);
  if (!changed.length) out.push('No campaign files changed.');
  out.push('', '## Publication gate changes', '');
  let transitions = 0;
  for (const [collection, gate, label] of [
    ['sessions', isSessionPublished, 'Recap'],
    ['locations', isMapLocationPublished, 'Region marker'],
    ['locations', isMapInteriorPublished, 'Interior gate'],
  ]) {
    const old = new Map(before.content[collection].map(entry => [entry.id, gate(entry)]));
    const next = new Map(after.content[collection].map(entry => [entry.id, gate(entry)]));
    for (const id of [...new Set([...old.keys(), ...next.keys()])].sort()) {
      if (!!old.get(id) === !!next.get(id)) continue;
      transitions++;
      out.push(`- ${label} ${escape(id)}: ${next.get(id) ? 'newly eligible' : 'no longer eligible'}.`);
    }
  }
  if (!transitions) out.push('No publication gate changes.');
  out.push('', 'Interior eligibility does not certify a registered, redrawn or reviewed local map.', '', '## Current snapshot freshness', '');
  const published = after.content.sessions.filter(isSessionPublished).sort((a, b) => b.data.sessionNumber - a.data.sessionNumber);
  const source = published.find(entry => entry.id === after.current?.sourceSession);
  if (!source) out.push('Needs attention: current snapshot is missing or does not reference a published recap.');
  else out.push(`Recorded through Session ${escape(source.data.sessionNumber)}; latest published recap is Session ${escape(published[0].data.sessionNumber)}. ${source.data.sessionNumber < published[0].data.sessionNumber ? 'Snapshot is behind: review it.' : 'Snapshot is current by source session number.'}`);
  out.push('', '## Profile review freshness', '', 'Explicit editorial checkpoints only; mentions, attendance and unchanged prose do not establish review or character knowledge.', '');
  for (const collection of ['characters', 'npcs']) {
    for (const entry of [...after.content[collection]].sort((a, b) => a.id.localeCompare(b.id))) {
      const checkpoint = published.find(session => session.id === entry.data.reviewedThrough);
      const state = entry.data.reviewedThrough === undefined ? 'No review checkpoint recorded.'
        : !checkpoint ? 'Invalid checkpoint: must reference a published session.'
        : `Reviewed through Session ${checkpoint.data.sessionNumber}. ${checkpoint.data.sessionNumber < published[0].data.sessionNumber ? 'Newer recap available: review may be needed.' : 'Matches latest published recap.'}`;
      out.push(`- ${escape(collection)}/${escape(entry.id)}: ${escape(state)}`);
    }
  }
  out.push('', '## Reference findings', '');
  const errors = contentReferenceErrors(after.content);
  const members = new Set();
  for (const group of after.current?.groups ?? []) {
    for (const id of group.characters ?? []) {
      if (members.has(id) || !after.content.characters.some(entry => entry.id === id)) errors.push(`Current snapshot: unknown or repeated character ${id}`);
      members.add(id);
    }
    if (group.location && !after.content.locations.some(entry => entry.id === group.location)) errors.push(`Current snapshot: unknown location ${group.location}`);
  }
  if (!source) errors.push('Current snapshot: source must reference a published recap');
  out.push(...(errors.length ? errors.sort().map(error => `- ${escape(error)}`) : ['No collection-reference problems found. Image, HTML-link and schema checks run separately in the build.']));
  return out.join('\n') + '\n';
}

export async function main(base = process.argv[2] ?? 'HEAD') {
  await unlink('.review/publication-review.md').catch(error => { if (error.code !== 'ENOENT') throw error; });
  // Resolve untrusted refs as arguments, never shell text. A missing base fails explicitly.
  const sha = git('rev-parse', '--verify', '--end-of-options', `${base}^{commit}`).trim();
  const beforeFiles = new Map();
  for (const file of git('ls-tree', '-r', '--name-only', '-z', sha, '--', ...paths).split('\0').filter(Boolean)) {
    beforeFiles.set(file, git('show', `${sha}:${file}`));
  }
  const afterFiles = new Map();
  for (const file of new Set(git('ls-files', '-z', '--cached', '--others', '--exclude-standard', '--', ...paths).split('\0').filter(Boolean))) {
    try { afterFiles.set(file, await readFile(file, 'utf8')); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  const report = reviewReport(beforeFiles, afterFiles, sha);
  await mkdir('.review', { recursive: true });
  await writeFile('.review/publication-review.md', report);
  if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, report);
  console.log('Publication review written to .review/publication-review.md');
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(error => { console.error(`Publication review failed: ${error.message}`); process.exitCode = 1; });
}
