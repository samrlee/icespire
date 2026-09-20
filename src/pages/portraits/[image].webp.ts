import type { APIRoute, GetStaticPaths } from 'astro';
import sharp from 'sharp';
import { getPortraits } from '../../lib/portraits';

export const getStaticPaths: GetStaticPaths = async () => {
  const unique = new Map((await getPortraits()).map(portrait => [portrait.key, portrait]));
  return [...unique.values()].flatMap(portrait => portrait.widths.map(width => ({
    params: { image: `${portrait.key}-${width}` },
    props: { file: portrait.file, width },
  })));
};

export const GET: APIRoute = async ({ props }) => {
  // Width only preserves the image; existing CSS supplies top-aligned crops.
  const bytes = await sharp(props.file).resize({ width: props.width, withoutEnlargement: true })
    .webp({ quality: 82 }).toBuffer();
  return new Response(new Uint8Array(bytes), { headers: { 'Content-Type': 'image/webp' } });
};
