import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'parse5';

async function filesUnder(directory, prefix = '') {
  const files = [];
  for (const entry of await readdir(path.join(directory, prefix), { withFileTypes: true })) {
    const name = prefix + entry.name;
    if (entry.isDirectory()) files.push(...await filesUnder(directory, name + '/'));
    else if (entry.isFile()) files.push(name);
  }
  return files;
}

function elements(node, result = []) {
  if (node.tagName) result.push(node);
  for (const child of node.childNodes ?? []) elements(child, result);
  return result;
}

// Only browser-facing URL attributes, never strings inside scripts or prose.
const attributes = {
  a: ['href'], area: ['href'], link: ['href'], script: ['src'],
  img: ['src'], source: ['src'], video: ['src', 'poster'], audio: ['src'],
  iframe: ['src'], object: ['data'], image: ['href'], use: ['href'],
};

export async function generatedLinkErrors(directory, site, base = '/') {
  const files = new Set(await filesUnder(directory));
  const pages = new Map();
  const prefix = '/' + base.replace(/^\/+|\/+$/g, '');
  const routeBase = prefix === '/' ? '/' : prefix + '/';
  const origin = new URL(site).origin;
  for (const file of files) {
    if (!file.endsWith('.html')) continue;
    const nodes = elements(parse(await readFile(path.join(directory, file), 'utf8'), { sourceCodeLocationInfo: true }));
    const anchors = new Set();
    const links = [];
    const route = routeBase + file.replace(/index\.html$/, '');
    let documentBase = new URL(route, origin);
    let hasBase = false;
    for (const node of nodes) {
      const attrs = Object.fromEntries(node.attrs.map(attr => [attr.name, attr.value]));
      if (attrs.id) anchors.add(attrs.id);
      if (node.tagName === 'a' && attrs.name) anchors.add(attrs.name);
      // Region-map hashes select rendered markers, not arbitrary location slugs.
      if (file === 'map/index.html' && attrs.class?.split(/\s+/).includes('map-marker') && attrs['data-slug']) {
        anchors.add(attrs['data-slug']);
      }
      if (node.tagName === 'base' && attrs.href && !hasBase) {
        documentBase = new URL(attrs.href, documentBase);
        hasBase = true;
      }
      for (const attr of attributes[node.tagName] ?? []) {
        if (attrs[attr] !== undefined) links.push({ value: attrs[attr], label: `${node.tagName}[${attr}]`, line: node.sourceCodeLocation?.startLine });
      }
    }
    pages.set(file, { anchors, links, documentBase });
  }
  const errors = [];
  for (const [file, page] of pages) {
    for (const link of page.links) {
      const source = `${file}:${link.line ?? 1} ${link.label} ${JSON.stringify(link.value)}`;
      try {
        const target = new URL(link.value, page.documentBase);
        if (!['http:', 'https:'].includes(target.protocol) || target.origin !== origin) continue;
        const pathname = decodeURIComponent(target.pathname);
        if (!pathname.startsWith(routeBase)) {
          errors.push(`${source}: outside configured site base`);
          continue;
        }
        const relative = pathname.slice(routeBase.length);
        // Match static files, directory routes, and Cloudflare's .html aliases.
        const candidates = relative.endsWith('/') || !relative
          ? [relative + 'index.html']
          : [relative, relative + '.html', relative + '/index.html'];
        const destination = candidates.find(candidate => files.has(candidate));
        if (!destination) {
          errors.push(`${source}: missing target ${target.pathname}`);
          continue;
        }
        const fragment = decodeURIComponent(target.hash.slice(1).split(':~:')[0]);
        const destinationPage = pages.get(destination);
        if (fragment && fragment.toLowerCase() !== 'top' && destinationPage && !destinationPage.anchors.has(fragment)) {
          errors.push(`${source}: missing fragment #${fragment} in ${destination}`);
        }
      } catch {
        errors.push(`${source}: invalid URL or encoding`);
      }
    }
  }
  return [...new Set(errors)].sort();
}

export default function generatedLinks() {
  let site;
  let base;
  return {
    name: 'icespire:generated-links',
    hooks: {
      'astro:config:done': ({ config }) => { site = config.site; base = config.base; },
      'astro:build:done': async ({ dir, logger }) => {
        if (!site) throw new Error('generated-links requires a configured site URL');
        const errors = await generatedLinkErrors(fileURLToPath(dir), site, base);
        if (errors.length) throw new Error(`Generated link validation failed:\n${errors.join('\n')}`);
        logger.info('Internal HTML links, fragments, and asset references verified');
      },
    },
  };
}
