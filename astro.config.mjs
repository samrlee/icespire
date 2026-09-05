// @ts-check
import { readdirSync, readFileSync } from 'node:fs';
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import securityHeaders from './integrations/security-headers.mjs';

// Draft recaps build to a page but are deliberately unlinked — off /sessions/,
// out of the prev/next chain, out of the search index. The sitemap has to
// honour the same gate or it becomes the back door that hands search engines
// the one thing the site withholds. Read straight from the frontmatter here:
// astro.config runs before the content collections exist.
const draftSessionPaths = readdirSync('./src/content/sessions')
  .filter((f) => f.endsWith('.md'))
  .filter((f) => /^draft:\s*true\s*$/m.test(readFileSync(`./src/content/sessions/${f}`, 'utf8')))
  .map((f) => `/sessions/${f.replace(/\.md$/, '')}/`);

// Deployed to Cloudflare Pages at https://icespire.ghostbloods.net
// Served from the root of its own subdomain, so no `base` prefix is needed.
export default defineConfig({
  site: 'https://icespire.ghostbloods.net',
  build: {
    // Keep every stylesheet a linked file. The site has one stylesheet, so
    // this changes nothing today — it holds the invariant the CSP's
    // `style-src-elem` relies on: no inline <style> in the output.
    inlineStylesheets: 'never',
  },
  integrations: [
    // Lists the site's pages for Search Console. Readable pages only: the
    // generated OG images and the search index are machinery, not destinations.
    sitemap({
      filter: (page) => {
        const path = new URL(page).pathname;
        if (path.startsWith('/og/')) return false;
        if (path.endsWith('.json')) return false;
        return !draftSessionPaths.includes(path);
      },
    }),
    // Writes dist/_headers, with the CSP's script-src pinned to this build's
    // inline scripts.
    securityHeaders(),
  ],
});
