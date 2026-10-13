// Search landing pages and their source conditions survive the documented generator chain.
import {cp,mkdtemp,readFile,rm,symlink} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {join,resolve} from 'node:path';
import assert from 'node:assert/strict';
const root=resolve(import.meta.dirname,'..');
const tmp=await mkdtemp('/tmp/poe2-build-search-');
try {
  await cp(root,tmp,{recursive:true,filter:p=>!/(^|\/)(node_modules|\.git)$/.test(p)});
  await symlink(join(root,'node_modules'),join(tmp,'node_modules'),'dir');
  const pages=['index.html','best-builds/index.html'];
  const original=await Promise.all(pages.map(file=>readFile(join(root,file),'utf8')));
  const steps=['generate-discovery-pages','generate-strategy-hub','enhance-image-seo','enhance-ratings','enhance-build-ux','enhance-version-notice','enhance-one-hub','enhance-term-links','enhance-site-chrome','enhance-practical-help','generate-sitemap','enhance-page-schema','generate-og-images','inject-analytics','sync-asset-versions'];
  for (let pass=0;pass<2;pass++) {
    for (const step of steps) execFileSync(process.execPath,[join(tmp,'tools',`${step}.mjs`)],{cwd:tmp,stdio:'ignore',env:{...process.env,OG_METADATA_ONLY:'1'}});
    for (let i=0;i<pages.length;i++) assert.equal(await readFile(join(tmp,pages[i]),'utf8'),original[i],`${pages[i]} differs after generation pass ${pass+1}`);
  }
  console.log('PASS: general and strongest-build pages match their generators after two complete focused passes');
} finally { await rm(tmp,{recursive:true,force:true}); }
