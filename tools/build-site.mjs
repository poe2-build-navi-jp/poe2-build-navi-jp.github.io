// Rebuilds every generated page in the order the tools expect (`npm run build`).
// Needs ImageMagick (`convert`) for generate-image-assets and a local Chromium for the OG images
// (PLAYWRIGHT_BROWSERS_PATH, or CHROMIUM_PATH). Each step runs in its own process because the
// generators do their work when imported.
import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';
const root=resolve(import.meta.dirname,'..');
const steps=[
 'generate-pages',           // base pages, then content/discovery/SEO/strategy pages and their own enhancers
 'enhance-image-seo','enhance-ratings','enhance-build-ux','enhance-version-notice','enhance-one-hub',
 'enhance-term-links','enhance-site-chrome','enhance-practical-help','generate-build-data',
 'generate-sitemap',         // after everything that changes <main>: it records each page's content date
 'enhance-page-schema',      // reads those dates
 'generate-og-images','inject-analytics',
 'sync-asset-versions'       // always last
];
for(const step of steps){
 console.log(`> ${step}`);
 execFileSync(process.execPath,[resolve(root,'tools',`${step}.mjs`)],{cwd:root,stdio:'inherit',env:process.env});
}
