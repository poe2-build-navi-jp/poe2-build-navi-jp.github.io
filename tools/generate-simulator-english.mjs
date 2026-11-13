/** Build the English simulator's crawlable HTML from the shared Japanese UI.
 * Exact translations fail closed if a new Japanese label has not been reviewed.
 * Run after Japanese article enhancements and before sitemap generation.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse, parseFragment, serialize } from 'parse5';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const translations = new Map(read('data/simulator-static-en.tsv').split('\n').filter(Boolean).map(line => {
  const i = line.indexOf('\t');
  if(i < 0) throw new Error(`Missing translation delimiter: ${line}`);
  return [line.slice(0,i),line.slice(i+1)];
}));
translations.set('レアリティ: レア\n装備名\nベース名\n…','Rarity: Rare\nItem name\nBase name\n…');
translations.set('最大ライフ +100\n火耐性 +30%','+100 to maximum Life\n+30% to Fire Resistance');
const hasJa = value => /[\u3040-\u30ff\u3400-\u9fff]/u.test(value);
const missing = new Set();
function translate(value) {
  if (translations.has(value)) return translations.get(value);
  if (hasJa(value)) missing.add(value);
  return value;
}
const japanese = read('simulator/index.html').replace(/<!-- simulator-language:start -->[\s\S]*?<!-- simulator-language:end -->/g,'');
const document = parse(japanese, {scriptingEnabled:false});
function walk(node, fn) {fn(node); for(const child of node.childNodes || []) walk(child,fn);}
function attr(node,key) {return node.attrs?.find(a=>a.name===key);}
function set(node,key,value) {const a=attr(node,key);if(a)a.value=value;else(node.attrs ||= []).push({name:key,value});}
const base = 'https://poe2-build-navi-jp.github.io';
const enUrl = `${base}/en/simulator/`;
let head, body, main;
walk(document,node=>{
  if(node.tagName==='head')head=node;
  if(node.tagName==='body')body=node;
  if(node.tagName==='main')main=node;
  if(node.tagName==='html')set(node,'lang','en');
  if(node.nodeName==='#text' && !['script','style'].includes(node.parentNode?.tagName)) node.value=translate(node.value);
  for(const a of node.attrs || []) {
    if(['title','aria-label','placeholder','alt','content'].includes(a.name)) a.value=translate(a.value);
    if(a.name==='href' || (a.name==='content' && attr(node,'property')?.value==='og:url')) {
      if(a.value.startsWith('/simulator/')) a.value=a.value.replace('/simulator/','/en/simulator/');
      if(a.value===`${base}/simulator/`)a.value=enUrl;
    }
  }
  if(node.tagName==='script' && attr(node,'src')?.value.startsWith('/assets/simulator.js')) set(node,'src','/assets/simulator-en.js');
  if(node.tagName==='script' && attr(node,'type')?.value==='application/ld+json') {
    for(const child of node.childNodes || []) {
      if(child.nodeName!=='#text')continue;
      const schema=JSON.parse(child.value);
      function localize(value) {
        if(typeof value==='string') {
          if(value.startsWith(`${base}/simulator/`)) return value.replace(`${base}/simulator/`,enUrl);
          return translate(value);
        }
        if(Array.isArray(value))return value.map(localize);
        if(value && typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,k==='inLanguage'?'en':localize(v)]));
        return value;
      }
      child.value=JSON.stringify(localize(schema));
    }
  }
});
if(missing.size) throw new Error(`Missing English simulator translations:\n${[...missing].join('\n')}`);
function appendHtml(parent,html,first=false) {
 const fragment=parseFragment(html);
 for(const child of fragment.childNodes)child.parentNode=parent;
 if(first)parent.childNodes.unshift(...fragment.childNodes);else parent.childNodes.push(...fragment.childNodes);
}
// All language versions have self canonicals; alternates never canonicalize EN to JA.
head.childNodes=head.childNodes.filter(n=> !(n.tagName==='link' && attr(n,'hreflang')));
appendHtml(head, `<link rel="alternate" hreflang="ja" href="${base}/simulator/"><link rel="alternate" hreflang="en" href="${enUrl}"><link rel="alternate" hreflang="x-default" href="${base}/simulator/"><meta property="og:locale" content="en_US"><meta property="og:locale:alternate" content="ja_JP">`);
appendHtml(main,'<nav class="sim-language-switch" aria-label="Language" style="padding:12px 20px;display:flex;gap:16px;flex-wrap:wrap"><a href="/simulator/" lang="ja" hreflang="ja">日本語</a><a href="/en/simulator/" lang="en" hreflang="en" aria-current="page">English</a></nav>',true);
// Preserve shared build IDs and save data when changing language.
appendHtml(body,`<script>document.querySelectorAll('.sim-language-switch a').forEach(function(a){a.href=a.getAttribute('href')+location.search+location.hash;});</script>`);
fs.mkdirSync(path.join(root,'en/simulator'),{recursive:true});
fs.writeFileSync(path.join(root,'en/simulator/index.html'),serialize(document)+'\n');
console.log('Generated English simulator HTML');

const jaAlternates=`<!-- simulator-language:start --><link rel="alternate" hreflang="ja" href="${base}/simulator/"><link rel="alternate" hreflang="en" href="${enUrl}"><link rel="alternate" hreflang="x-default" href="${base}/simulator/"><!-- simulator-language:end -->`;
const jaSwitch=`<!-- simulator-language:start --><nav class="sim-language-switch" aria-label="表示言語" style="padding:12px 20px;display:flex;gap:16px;flex-wrap:wrap"><a href="/simulator/" lang="ja" hreflang="ja" aria-current="page">日本語</a><a href="/en/simulator/" lang="en" hreflang="en">English</a></nav><script>document.querySelectorAll('.sim-language-switch a').forEach(function(a){a.href=a.getAttribute('href')+location.search+location.hash;});</script><!-- simulator-language:end -->`;
fs.writeFileSync(path.join(root,'simulator/index.html'),japanese.replace('</head>',jaAlternates+'</head>').replace('<main id="main">','<main id="main">'+jaSwitch));
