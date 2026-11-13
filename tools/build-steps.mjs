// The ordered steps of `npm run build`. Tests that regenerate pages reuse BUILD_STEPS so they
// stay in step with the real build when a step is added.
export const BUILD_STEPS=[
 'generate-pages',           // base pages, then content/discovery/SEO/strategy pages and their own enhancers
 'generate-simulator-examples', // real engine checks for optional examples and sourced equipment
 'enhance-simulator-comparisons', // calculated article tables and reproducible comparison links
 'generate-simulator',       // selectable build workbench and per-build entry links
 'generate-issues',
 'enhance-image-seo','enhance-ratings','enhance-build-ux','enhance-version-notice',
 'generate-html-sitemap',    // reads page titles, so after the generators and the title changes
 'enhance-one-hub',
 'enhance-term-links','enhance-site-chrome','enhance-practical-help','generate-build-data',
 'localize-japanese-names',   // the final visible copy, before recording page dates
 'enhance-article-reading',  // paragraph breaks, contents and responsive tables
 'generate-simulator-data-english', // English descriptions; immutable calculation requests
 'generate-simulator-runtime-en', // shared logic with reviewed English UI/data
 'generate-simulator-english', // finish English UI after Japanese-only enhancers
 'enhance-skill-icons',       // real game icons beside names in JA/EN and dynamic skill selectors
 'generate-sitemap',         // after everything that changes <main>: it records each page's content date
 'enhance-page-schema',      // reads those dates
 'enhance-editorial-trust',  // visible editor, matching identity and source citations
 'generate-og-images','inject-analytics',
 'sync-asset-versions'       // always last
];
// Everything after generate-pages: the enhancers and late generators that finish each page.
export const FINISHING_STEPS=BUILD_STEPS.slice(BUILD_STEPS.indexOf('generate-pages')+1);
