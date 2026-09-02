// @ts-check
/**
 * Writes `dist/_headers` — the response headers Cloudflare Pages serves — at
 * the end of the build, with the Content-Security-Policy's `script-src`
 * pinned to the SHA-256 hashes of the inline scripts this build actually
 * emitted.
 *
 * Why generate rather than hand-write: the policy used to carry
 * `script-src 'unsafe-inline'`, because the theme, nav, and contents-rail
 * scripts are inline (the theme one has to be — it runs before first paint)
 * and Astro inlines its own small bundles too. `'unsafe-inline'` waves
 * through *any* inline script, including one that arrived in a bad content
 * edit, which is the exact thing this policy is here to stop. Hashes allow
 * only the scripts we shipped, and a build recomputes them, so nobody has to
 * remember to update a hash after touching a script.
 */
import { createHash } from 'node:crypto';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Cloudflare Pages rejects a _headers line longer than this.
const MAX_HEADER_LINE = 2000;

/** Every `<script>…</script>` that has no `src` — inline, so CSP hashes it. */
const INLINE_SCRIPT = /<script(\b[^>]*)>([\s\S]*?)<\/script>/gi;
const HAS_SRC = /\ssrc\s*=/i;

/** @param {string} dir */
async function htmlFiles(dir) {
  /** @type {string[]} */
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await htmlFiles(full)));
    else if (entry.name.endsWith('.html')) out.push(full);
  }
  return out;
}

/**
 * Hashes of every inline script in the built pages, sorted so an unchanged
 * build produces an unchanged file.
 * @param {string[]} files
 */
async function scriptHashes(files) {
  /** @type {Set<string>} */
  const hashes = new Set();
  for (const file of files) {
    const html = await readFile(file, 'utf8');
    for (const [, attrs, body] of html.matchAll(INLINE_SCRIPT)) {
      // A `<script src=…>` is covered by 'self'; only its own text is hashed.
      if (HAS_SRC.test(attrs)) continue;
      // JSON data blocks (`type="application/json"`) aren't executed, so most
      // browsers never check them against script-src — hash them anyway
      // rather than bet the entity-link and map-scrubber islands on that.
      hashes.add(`'sha256-${createHash('sha256').update(body, 'utf8').digest('base64')}'`);
    }
  }
  return [...hashes].sort();
}

/**
 * @param {string} scriptSrc `script-src` sources, hashes included.
 * @returns {string}
 */
function headersFile(scriptSrc) {
  const csp = [
    // Nothing loads from anywhere but this origin unless listed below.
    "default-src 'self'",
    // Hash-pinned: see the note at the top of this file. No 'unsafe-inline'.
    `script-src ${scriptSrc}`,
    // 'unsafe-inline' here is for the ~70 `style="…"` attributes the layouts
    // and map SVGs carry; hashes can't cover style *attributes*. It also
    // covers the Google Fonts stylesheet the site CSS pulls in with @import.
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    // Stylesheet *elements* are stricter than the attributes above: the build
    // emits one linked stylesheet and never an inline <style> (enforced by
    // `build.inlineStylesheets: 'never'`), so no 'unsafe-inline' is needed
    // and an injected <style> block is refused.
    "style-src-elem 'self' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data:",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    'upgrade-insecure-requests',
  ].join('; ');

  return `# Response headers for Cloudflare Pages, GENERATED at build time by
# integrations/security-headers.mjs — edit that file, not this one. It is
# written into the build output, where Pages reads it at deploy time.
#
# The site is static and ships no user input, so most of these are
# defence-in-depth: they narrow what a page could do if a bad content edit
# ever landed markup where only text was meant to go.

/*
  # Don't let a browser second-guess a declared Content-Type.
  X-Content-Type-Options: nosniff
  # Two years of HTTPS-only, this host and anything under it. Stops a
  # downgrade on the first request of a later visit, before the redirect.
  # No \`preload\` — that needs a submission for the apex domain, not us.
  Strict-Transport-Security: max-age=63072000; includeSubDomains
  # Nobody frames the chronicle; also covered by frame-ancestors below, kept
  # for older browsers that only understand this one.
  X-Frame-Options: DENY
  # A page we open, or one that opens us, gets no handle on our window.
  Cross-Origin-Opener-Policy: same-origin
  # Send the full URL to ourselves, only the origin off-site.
  Referrer-Policy: strict-origin-when-cross-origin
  # No page here asks for hardware or location.
  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()
  Content-Security-Policy: ${csp}

# Astro fingerprints these filenames, so a change ships a new URL — safe to
# cache forever.
/_astro/*
  Cache-Control: public, max-age=31536000, immutable

# Social cards are regenerated on every build and keep their URL when a session
# title is edited, so let scrapers re-check rather than pinning a stale card.
/og/*
  Cache-Control: public, max-age=3600
`;
}

/** @returns {import('astro').AstroIntegration} */
export default function securityHeaders() {
  return {
    name: 'icespire:security-headers',
    hooks: {
      'astro:build:done': async ({ dir, logger }) => {
        const outDir = fileURLToPath(dir);
        const files = await htmlFiles(outDir);
        const hashes = await scriptHashes(files);
        // A build with no inline scripts at all means the scan missed them
        // (a renamed output dir, say). Shipping a policy that blocks the
        // site's own scripts is worse than failing the build here.
        if (hashes.length === 0) {
          throw new Error(
            `security-headers: found no inline scripts in ${files.length} page(s); ` +
              'refusing to write a Content-Security-Policy that would block them.'
          );
        }
        const contents = headersFile(["'self'", ...hashes].join(' '));
        const longest = Math.max(...contents.split('\n').map((line) => line.length));
        if (longest > MAX_HEADER_LINE) {
          throw new Error(
            `security-headers: longest _headers line is ${longest} chars, over ` +
              `Cloudflare's ${MAX_HEADER_LINE} limit.`
          );
        }
        await writeFile(path.join(outDir, '_headers'), contents, 'utf8');
        logger.info(`_headers written with ${hashes.length} inline-script hashes`);
      },
    },
  };
}
