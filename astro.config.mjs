// @ts-check
import { defineConfig } from 'astro/config';
import securityHeaders from './integrations/security-headers.mjs';

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
  // Writes dist/_headers, with the CSP's script-src pinned to this build's
  // inline scripts.
  integrations: [securityHeaders()],
});
