// Build a reviewed change manifest for explicitly selected canonical pages.
// This command only reads Git snapshots and local files. It makes no HTTP requests.
import { readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { SITE, articleUrl, inspectArticle, requireValue, validatePlan } from './indexnow-content.mjs';
const root = resolve(import.meta.dirname, '..');
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
try {
  const [baseArg, headArg, urlsFile, output] = process.argv.slice(2);
  requireValue(baseArg && headArg && urlsFile && output && process.argv.length === 6,
    'Usage: node scripts/indexnow-plan.mjs BASE_COMMIT HEAD_COMMIT URLS.txt OUTPUT.json');
  const baseCommit = git('rev-parse', '--verify', `${baseArg}^{commit}`).trim();
  const headCommit = git('rev-parse', '--verify', `${headArg}^{commit}`).trim();
  git('merge-base', '--is-ancestor', baseCommit, headCommit);
  const sitemap = new Set([...git('show', `${headCommit}:sitemap.xml`).matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]));
  const urls = [...new Set((await readFile(resolve(urlsFile), 'utf8')).trim().split(/\s+/))].map(url => {
    articleUrl(url);
    requireValue(sitemap.has(url), `Not in reviewed source sitemap: ${url}`);
    const path = `${new URL(url).pathname.slice(1)}index.html`;
    const afterHash = inspectArticle(git('show', `${headCommit}:${path}`), url).hash;
    let beforeHash = null;
    const priorFiles = git('ls-tree', '--name-only', baseCommit, '--', path).trim();
    if (priorFiles) beforeHash = inspectArticle(git('show', `${baseCommit}:${path}`), url).hash;
    return { url, change: beforeHash === null ? 'added' : 'updated', beforeHash, afterHash };
  });
  const plan = validatePlan({ version: 1, origin: SITE, baseCommit, headCommit, urls });
  await writeFile(resolve(output), `${JSON.stringify(plan, null, 2)}\n`, { flag: 'wx' });
  console.log(`Wrote ${plan.urls.length} changed URLs to ${output}. No requests made.`);
} catch (error) { console.error(error.message); process.exitCode = 1; }
