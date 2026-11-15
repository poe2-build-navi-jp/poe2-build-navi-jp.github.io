// Stamp the actual deployed HTML, rather than modifying generated source-page dates.
import {readFile, writeFile, readdir} from 'node:fs/promises';
import {resolve} from 'node:path';
const [directory, revision] = process.argv.slice(2);
if (!directory || !/^[a-f0-9]{40}$/.test(revision || '')) throw Error('Usage: node tools/stamp-mobile-release.mjs <site-output> <40-character-commit-sha>');
const root = resolve(directory);
async function walk(folder) {
  for (const entry of await readdir(folder, {withFileTypes: true})) {
    const path = resolve(folder, entry.name);
    if (entry.isDirectory()) { await walk(path); continue; }
    if (!entry.name.endsWith('.html')) continue;
    const html = await readFile(path, 'utf8');
    if (!/<head(?:\s[^>]*)?>/i.test(html)) continue;
    const next = html.replace(/<meta\s+name="poe2-release"\s+content="[^"]*"\s*\/?>\s*/g, '').replace(/<head(?:\s[^>]*)?>/i, head => head + '\n<meta name="poe2-release" content="' + revision + '">');
    await writeFile(path, next);
  }
}
await walk(root);
await writeFile(resolve(root, 'mobile-version.json'), JSON.stringify({schemaVersion: 1, revision, origin: 'https://poe2-build-navi-jp.github.io', updatedAt: new Date().toISOString()}, null, 2) + '\n');
console.log('Stamped deployed HTML and mobile-version.json with ' + revision);
