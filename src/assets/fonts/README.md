# Website fonts

These unmodified WOFF2 variable fonts were copied from Fontsource's npm packages:

| Typeface | Package | Version | Styles used | Unicode subsets |
| --- | --- | --- | --- | --- |
| Cinzel | `@fontsource-variable/cinzel` | 5.3.0 | Normal, weights 400–700 | Latin, Latin extended |
| Crimson Pro | `@fontsource-variable/crimson-pro` | 5.3.0 | Normal, weights 400–700; italic, weight 400 | Latin, Latin extended, Vietnamese |
| JetBrains Mono | `@fontsource-variable/jetbrains-mono` | 5.3.0 | Normal, weights 400–500 | Latin, Latin extended, Vietnamese, Greek, Cyrillic, Cyrillic extended |

The CSS in [`../../styles/fonts.css`](../../styles/fonts.css) retains the site's
existing family names, requested weight ranges, and `font-display: swap`. Its
Unicode ranges come from the packages' `wght.css` and `wght-italic.css` files.
Browsers fetch only the subsets used on a page. Astro fingerprints the font
URLs and the generated response headers allow immutable caching of those files.
Each URL uses `?no-inline` so even small subsets remain compatible with
`font-src 'self'` in the production CSP.
The original design tokens remain unchanged.

All three typefaces use the **SIL Open Font License, Version 1.1**. Exact copies
of the package notices are included in the public site:

- [Cinzel license](../../../public/licenses/fonts/cinzel-OFL.txt): Copyright 2020
  The Cinzel Project Authors. Upstream: <https://github.com/NDISCOVER/Cinzel>.
- [Crimson Pro license](../../../public/licenses/fonts/crimson-pro-OFL.txt):
  Copyright 2018 The Crimson Pro Project Authors. Upstream:
  <https://github.com/Fonthausen/CrimsonPro>.
- [JetBrains Mono license](../../../public/licenses/fonts/jetbrains-mono-OFL.txt):
  Copyright 2020 The JetBrains Mono Project Authors. Upstream:
  <https://github.com/JetBrains/JetBrainsMono>.

Package archives used:

- <https://registry.npmjs.org/@fontsource-variable/cinzel/-/cinzel-5.3.0.tgz>
- <https://registry.npmjs.org/@fontsource-variable/crimson-pro/-/crimson-pro-5.3.0.tgz>
- <https://registry.npmjs.org/@fontsource-variable/jetbrains-mono/-/jetbrains-mono-5.3.0.tgz>

[`SHA256SUMS`](SHA256SUMS) records the bundled files' checksums. The font
integrity test verifies those bytes, the complete subset inventory, the CSS
weight/style ranges and local URLs, and the published license notices.

To update, inspect the new package's license and metadata, copy the needed
WOFF2 files without modification, update `SHA256SUMS`, and retain its corresponding
Unicode ranges in `fonts.css`. No npm dependency is needed at build time or in the browser.
