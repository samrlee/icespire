import { getCollection } from 'astro:content';
import { stat } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { contentImages, contentReferenceErrors } from './content-integrity';

async function validate(): Promise<void> {
  const [sessions, characters, npcs, factions, lore, locations, journey] = await Promise.all([
    getCollection('sessions'), getCollection('characters'), getCollection('npcs'),
    getCollection('factions'), getCollection('lore'), getCollection('locations'), getCollection('journey'),
  ]);
  const content = { sessions, characters, npcs, factions, lore, locations, journey };
  const errors = contentReferenceErrors(content);
  const publicDir = resolve('public');
  for (const image of contentImages(content)) {
    let exists = false;
    try {
      const file = resolve(publicDir, '.' + decodeURIComponent(image.path));
      exists = file.startsWith(publicDir + sep) && (await stat(file)).isFile();
    } catch { /* Report the source field, not an opaque filesystem error. */ }
    if (!exists) errors.push(`${image.source}: missing public image ${JSON.stringify(image.path)}`);
  }
  if (errors.length) throw new Error(`Content reference validation failed:\n${errors.sort().join('\n')}`);
}

// Every full build renders Base. Share its validation work across pages; dev
// must revalidate each render so corrected content never keeps a cached error.
let buildValidation: Promise<void> | undefined;
export function validateContent(): Promise<void> {
  return import.meta.env.PROD ? (buildValidation ??= validate()) : validate();
}
