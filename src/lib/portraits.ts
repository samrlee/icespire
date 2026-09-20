import { getCollection } from 'astro:content';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { validateContent } from './validate-content';
import { url } from '../utils/url';

const widths = [64, 128, 256, 512, 768];
async function collectPortraits() {
  // Preserve authored-field errors when endpoints build before page layouts.
  await validateContent();
  const entries = [...await getCollection('characters'), ...await getCollection('npcs')];
  const sources = [...new Set(entries.flatMap(entry => entry.data.portrait ? [entry.data.portrait] : []))];
  return Promise.all(sources.map(async source => {
    const file = resolve('public', '.' + decodeURIComponent(source));
    const bytes = await readFile(file);
    const metadata = await sharp(bytes).metadata();
    if (!metadata.width || !metadata.height) throw new Error(`Cannot size portrait ${source}`);
    const key = createHash('sha256').update(bytes).digest('hex').slice(0, 16);
    return { source, file, key, widths: [...new Set(widths.map(width => Math.min(width, metadata.width!)))] };
  }));
}

let buildPortraits: ReturnType<typeof collectPortraits> | undefined;
export function getPortraits() {
  return import.meta.env.PROD ? (buildPortraits ??= collectPortraits()) : collectPortraits();
}

export async function portraitSources(source: string, maximum = 768) {
  const portrait = (await getPortraits()).find(item => item.source === source || url(item.source) === source);
  if (!portrait) throw new Error(`Unregistered portrait ${source}`);
  const candidates = portrait.widths.filter(width => width <= maximum);
  const href = (width: number) => url(`/portraits/${portrait.key}-${width}.webp`);
  return {
    src: href(candidates[0]),
    srcset: candidates.map(width => `${href(width)} ${width}w`).join(', '),
  };
}
