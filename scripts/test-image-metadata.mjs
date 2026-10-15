import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { resolve } from 'node:path';
import { JSDOM } from 'jsdom';
import { imageRights } from '../tools/image-rights.mjs';
const root = resolve(import.meta.dirname, '..');
const site = JSON.parse(await readFile(resolve(root, 'data/site.json'), 'utf8'));
const rights = imageRights(site);
const xml = await readFile(resolve(root, 'sitemap.xml'), 'utf8');
const sitemap = new JSDOM(xml, { contentType: 'text/xml' }).window.document;
assert.equal(sitemap.querySelector('parsererror'), null);
assert(!/<image:(title|caption|geo_location|license)>/.test(xml), 'deprecated image sitemap fields');
const terms = new JSDOM(await readFile(resolve(root, 'terms/index.html'), 'utf8')).window.document;
for (const property of ['license', 'acquireLicensePage']) assert(terms.getElementById(new URL(rights[property]).hash.slice(1)), `${property} anchor missing`);
assert(terms.querySelector('#image-permission a[href="/about/"]'));
assert(terms.querySelector('#image-usage').textContent.includes('出典：オカピ研究所（POE2ビルドナビ）'));
assert(terms.querySelector('#image-usage').textContent.includes('元記事へのリンク'));
assert(terms.querySelector('#image-usage').textContent.includes('元記事のURL'));
assert(terms.querySelector('#image-permission').textContent.includes('事前のお問い合わせなし'));
assert(!terms.querySelector('#image-usage').textContent.includes('自由利用や再配布を許諾するライセンスではありません'));
assert(terms.body.textContent.includes('この限りではありません'));
let images = 0, pages = 0;
const walk = (node, found = []) => {
  if (!node || typeof node !== 'object') return found;
  if (node['@type'] === 'ImageObject') found.push(node);
  for (const value of Object.values(node)) walk(value, found);
  return found;
};
for (const entry of sitemap.getElementsByTagName('url')) {
  const path = new URL(entry.getElementsByTagName('loc')[0].textContent).pathname;
  const doc = new JSDOM(await readFile(resolve(root, `${path.slice(1)}index.html`), 'utf8')).window.document;
  const visible = new Set([...doc.querySelectorAll('main img[src]')].map(img => new URL(img.getAttribute('src'), site.baseUrl).href));
  const objects = [...doc.querySelectorAll('script[type="application/ld+json"]')].flatMap(script => walk(JSON.parse(script.textContent)));
  for (const object of objects) {
    assert(visible.has(object.contentUrl), `${path}: ImageObject is not in page content`);
    for (const key of Object.keys(rights)) assert.deepEqual(object[key], rights[key], `${path}: ${key}`);
    await access(resolve(root, new URL(object.contentUrl).pathname.slice(1)));
    images++;
  }
  for (const loc of entry.getElementsByTagName('image:loc')) assert(visible.has(loc.textContent), `${path}: sitemap image absent from page`);
  for (const img of doc.querySelectorAll('main img')) {
    assert(img.getAttribute('alt')?.trim(), `${path}: missing alt`);
    assert(+img.getAttribute('width') > 0 && +img.getAttribute('height') > 0, `${path}: missing dimensions`);
  }
  if (path === '/' || path === '/beginner-builds/') {
    assert.equal(objects.length, 0, `${path}: phantom primary image returned`);
    assert(doc.querySelector('meta[property="og:image"]'), `${path}: OG preview lost`);
  }
  pages++;
}
assert.equal(images, 27, 'unexpected diagram metadata coverage');
console.log(`PASS: ${pages} pages, ${images} displayed ImageObjects, rights links, sitemap alignment, alt and dimensions`);
