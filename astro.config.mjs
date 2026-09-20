// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import securityHeaders from './integrations/security-headers.mjs';
import generatedLinks from './integrations/generated-links.mjs';

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
        if (path.startsWith('/portraits/')) return false;
        if (path.endsWith('.json')) return false;
        // Draft recap routes are never generated. Inherit the authoritative
        // route list rather than parsing the content a second time here.
        return true;
      },
    }),
    // Writes dist/_headers, with the CSP's script-src pinned to this build's
    // inline scripts.
    securityHeaders(),
    generatedLinks(),
  ],
});
