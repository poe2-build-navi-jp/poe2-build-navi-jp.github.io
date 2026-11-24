// Makes 800px- and 1280px-wide copies (name-800w.webp, name-1280w.webp) of every guide screenshot wider than 1000px, so phones
// download far less. Needs ImageMagick (`convert`) with WebP support. Run after adding a wide screenshot:
//   node tools/make-screenshot-variants.mjs
// Existing copies are kept; delete one to make it again. tools/guide-records.mjs adds the srcset.
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { SCREENSHOT_WIDTHS, screenshotCopy } from './guide-records.mjs';
const root = resolve(import.meta.dirname, '..');
const guides = JSON.parse(await readFile(resolve(root, 'data/strategy-guides.json'), 'utf8'));
let made = 0;
for (const image of guides.flatMap(g => g.sections.flatMap(s => s.screenshots || []))) {
  if (!(image.width > 1000) || !image.src.endsWith('.webp')) continue;
  for (const width of SCREENSHOT_WIDTHS.filter(width => width < image.width)) {
    const out = resolve(root, '.' + screenshotCopy(image.src, width));
    if (existsSync(out)) continue;
    execFileSync('convert', [resolve(root, '.' + image.src), '-resize', `${width}x`, '-define', 'webp:method=6', '-quality', '80', out]);
    made++;
  }
}
console.log(`Screenshot copies: ${made} made.`);
