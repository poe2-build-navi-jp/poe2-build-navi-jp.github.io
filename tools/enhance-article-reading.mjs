import {readFile, readdir, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {parse} from 'parse5';
import {applyGuideReadingLayout} from './guide-reading-layout.mjs';

const root = resolve(import.meta.dirname, '..');
const skipped = new Set(['node_modules', 'assets', 'images', 'data', 'tools', 'scripts', 'tests', 'docs', 'company']);
const text = node => node.nodeName === '#text' ? node.value : (node.childNodes || []).map(text).join('');
const attrs = node => Object.fromEntries((node.attrs || []).map(a => [a.name, a.value]));
const hasClass = (node, name) => (attrs(node).class || '').split(/\s+/).includes(name);
const escape = value => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');

async function* pages(dir) {
 for (const entry of await readdir(dir, {withFileTypes: true})) {
  if (entry.name.startsWith('.') || skipped.has(entry.name)) continue;
  const file = resolve(dir, entry.name);
  if (entry.isDirectory()) yield* pages(file);
  else if (entry.name.endsWith('.html')) yield file;
 }
}

function enhance(original) {
 const doc = parse(original, {sourceCodeLocationInfo: true});
 const nodes = [];
 function collect(node) {
  nodes.push(node);
  for (const child of node.childNodes || []) collect(child);
 }
 collect(doc);
 const article = nodes.find(node => hasClass(node, 'article-page'));
 const roadmap = nodes.find(node => hasClass(node, 'static-roadmap'));
 if (!article && !roadmap) return original;
 // Search and directory pages already have their own navigation and grid layout.
 if (article && hasClass(article, 'discovery-article')) return original;
 const edits = [];
 const within = (node, ancestor) => {
  for (let current = node; current; current = current.parentNode) if (current === ancestor) return true;
  return false;
 };
 const content = nodes.filter(node => within(node, article || roadmap));
 const replace = (start, end, value) => edits.push({start, end, value});
 const addAttr = (node, name, value) => {
  if (attrs(node)[name] !== undefined) return;
  const tag = node.sourceCodeLocation?.startTag;
  if (tag) replace(tag.endOffset - 1, tag.endOffset - 1, ` ${name}="${escape(value)}"`);
 };

 // Break long prose at sentence endings. Keep links and source references with
 // the sentence they qualify, and never change text or interactive markup.
 for (const node of content.filter(node => node.nodeName === 'p')) {
  if (text(node).length < 180 || node.childNodes.some(child => !['#text', 'a', 'sup', 'strong', 'em', 'b', 'span'].includes(child.nodeName))) continue;
  if (content.some(parent => parent !== node && within(node, parent) && ['sources', 'seo-sources', 'guide-review-detail', 'guide-direct-answer', 'first-hand-note'].some(name => hasClass(parent, name)))) continue;
  if (['guide-direct-answer', 'first-hand-note'].some(name => hasClass(node, name))) continue;
  let length = 0;
  const children = node.childNodes;
  for (let i = 0; i < children.length; i++) {
   const child = children[i];
   if (child.nodeName !== '#text') { length += text(child).length; continue; }
   for (const match of child.value.matchAll(/。/g)) {
    const local = match.index + 1;
    const offset = child.sourceCodeLocation?.startOffset;
    // An entity changes source offsets, so leave those text nodes intact.
    if (offset === undefined || original.slice(offset, child.sourceCodeLocation.endOffset) !== child.value) continue;
    const remaining = child.value.slice(local) + children.slice(i + 1).map(text).join('');
    if (length + local < 100 || remaining.length < 55) continue;
    let position = offset + local;
    if (local === child.value.length) {
     let next = i + 1;
     while (children[next]?.nodeName === 'sup') position = children[next++].sourceCodeLocation.endOffset;
    }
    replace(position, position, '</p><p>');
    length = -local;
   }
   length += child.value.length;
  }
 }

 if (article && !content.some(node => hasClass(node, 'guide-toc')) && !hasClass(article, 'discovery-page') && !hasClass(article, 'wide-article')) {
  const headings = content.filter(node => node.nodeName === 'h2' && (node.parentNode === article || node.parentNode?.parentNode === article) && !['sources', 'seo-sources', 'related', 'content-action', 'guide-verification', 'next-box', 'term-lead', 'term-action'].some(name => hasClass(node.parentNode, name)));
  if (headings.length >= 4) {
   const used = new Set(nodes.map(node => attrs(node).id).filter(Boolean));
   const links = headings.map((heading, i) => {
    let id = attrs(heading).id;
    if (!id) {
     id = `reading-section-${i + 1}`;
     while (used.has(id)) id += '-part';
     used.add(id);
     addAttr(heading, 'id', id);
    }
    return `<li><a href="#${escape(id)}">${escape(text(heading))}</a></li>`;
   }).join('');
   const first = headings[0];
   const location = first.parentNode === article ? first.sourceCodeLocation.startOffset : first.parentNode.sourceCodeLocation.startOffset;
   replace(location, location, `<details class="guide-toc reading-toc"${headings.length <= 7 ? ' open' : ''}><summary>この記事の目次</summary><nav aria-label="この記事の目次"><ol>${links}</ol></nav></details>`);
  }
 }

 for (const table of content.filter(node => node.nodeName === 'table')) {
  const rows = nodes.filter(node => node.nodeName === 'tr' && within(node, table));
  const header = rows[0];
  const labels = (header?.childNodes || []).filter(node => ['th', 'td'].includes(node.nodeName)).map(text);
  const record = hasClass(table.parentNode, 'guide-record-table');
  if (!record || labels.length < 2 || labels.length > 4 || rows.some(row => (row.childNodes || []).some(cell => attrs(cell).colspan || attrs(cell).rowspan))) continue;
  addAttr(table, 'data-reading-table', '');
  addAttr(table, 'role', 'table');
  for (const row of rows) {
   addAttr(row, 'role', 'row');
   const cells = row.childNodes.filter(node => ['th', 'td'].includes(node.nodeName));
   cells.forEach((cell, i) => {
    addAttr(cell, 'role', row === header ? 'columnheader' : cell.nodeName === 'th' ? 'rowheader' : 'cell');
    if (row !== header && i > 0) addAttr(cell, 'data-label', labels[i]);
    if (row !== header && text(cell).length > 140 && cell.childNodes.every(child => child.nodeName === '#text')) {
     const location = cell.sourceCodeLocation;
     const start = location.startTag.endOffset;
     const end = location.endTag.startOffset;
     const value = original.slice(start, end).replace(/。(?=\S)/g, '。<br>').replace(/ ／ /g, '<br> ／ ');
     replace(start, end, value);
    }
   });
  }
 }
 let html = original;
 for (const edit of edits.sort((a, b) => b.start - a.start || b.end - a.end)) html = html.slice(0, edit.start) + edit.value + html.slice(edit.end);
 return applyGuideReadingLayout(html);
}

let checked = 0;
let updated = 0;
for await (const file of pages(root)) {
 checked++;
 const original = await readFile(file, 'utf8');
 const next = enhance(original);
 if (next !== original) { await writeFile(file, next); updated++; }
}
console.log(`Reading layout: checked ${checked} HTML pages, updated ${updated}.`);
