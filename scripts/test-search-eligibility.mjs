// Public HTML eligibility checks, not a prediction of Google indexing or AI citations.
import assert from 'node:assert/strict';
import {readFile as read} from 'node:fs/promises';
import {resolve} from 'node:path';
import {JSDOM} from 'jsdom';
const root=resolve(import.meta.dirname,'..');
const base='https://poe2-build-navi-jp.github.io';
function crawlAllowed(robots,path,agent='Googlebot') {
 const groups=[];let group=null,hasRules=false;
 for(const line of robots.split('\n')) {
  const m=line.replace(/#.*/,'').trim().match(/^([^:]+):\s*(.*)$/);if(!m)continue;
  const key=m[1].toLowerCase(),value=m[2].trim();
  if(key==='user-agent') {
   if(!group||hasRules){group={agents:[],rules:[]};groups.push(group);hasRules=false;}
   group.agents.push(value.toLowerCase());
  } else if(group && ['allow','disallow'].includes(key)) {group.rules.push({allow:key==='allow',value});hasRules=true;}
 }
 const matching=groups.map(g=>({...g,specificity:Math.max(-1,...g.agents.map(a=>a==='*'?0:agent.toLowerCase().includes(a)?a.length:-1))}));
 const best=Math.max(...matching.map(g=>g.specificity));
 const rules=matching.filter(g=>g.specificity===best).flatMap(g=>g.rules).filter(r=>r.value).filter(r=>{
  const terminal=r.value.endsWith('$');const raw=terminal?r.value.slice(0,-1):r.value;
  const pattern=raw.split('*').map(s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('.*');
  return new RegExp('^'+pattern+(terminal?'$':'')).test(path);
 }).sort((a,b)=>b.value.length-a.value.length || Number(b.allow)-Number(a.allow));
 return rules[0]?.allow ?? true;
}
function snippetAllowed(d) {
 const values=[...d.querySelectorAll('meta[name]')].filter(m=>['robots','googlebot'].includes(m.name.toLowerCase())).map(m=>m.content.toLowerCase()).join(',');
 return !/(?:^|[,\s])(?:none|noindex|nosnippet|nofollow)(?:$|[,\s])|max-snippet\s*:\s*0(?:$|[,\s])/.test(values);
}
assert.equal(crawlAllowed('User-agent: *\nDisallow: /\nUser-agent: Googlebot\nAllow: /guides/','/guides/'),true);
assert.equal(crawlAllowed('User-agent: *\nDisallow: /guides/\nAllow: /guides/open/','/guides/closed/'),false);
assert.equal(crawlAllowed('User-agent: *\nDisallow: /guides/\nAllow: /guides/open/','/guides/open/'),true);
for(const rule of ['noindex','nosnippet','max-snippet:0','NOINDEX,follow'])assert.equal(snippetAllowed(new JSDOM(`<meta name="googlebot" content="${rule}">`).window.document),false);
const robots=await read(resolve(root,'robots.txt'),'utf8');
const sitemap=await read(resolve(root,'sitemap.xml'),'utf8');
const paths=[...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m=>new URL(m[1]).pathname);
const docs=new Map(),edges=new Map();let articleCount=0;
const flatten=v=>Array.isArray(v)?v.flatMap(flatten):[v,...(v?.['@graph']?flatten(v['@graph']):[])];
for(const path of paths) {
 const d=new JSDOM(await read(resolve(root,`.${path}index.html`),'utf8'),{url:base+path}).window.document;docs.set(path,d);
 assert(crawlAllowed(robots,path),`Googlebot blocked: ${path}`);
 assert(snippetAllowed(d),`Indexing/snippet restriction: ${path}`);
 assert.equal(d.querySelectorAll('link[rel="canonical"]').length,1,path);
 assert.equal(d.querySelector('link[rel="canonical"]').href,base+path,path);
 assert.equal(d.querySelectorAll('h1').length,1,path);
 assert(d.querySelector('main')?.textContent.trim(),`Missing static main: ${path}`);
 assert(!d.querySelector('main[data-nosnippet],main [data-nosnippet]'),`Main content excluded from snippets: ${path}`);
 const schemas=[...d.querySelectorAll('script[type="application/ld+json"]')].flatMap(s=>flatten(JSON.parse(s.textContent)));
 const articles=schemas.filter(s=>[].concat(s?.['@type']||[]).includes('Article'));
 assert(articles.length<=1,`Duplicate Article: ${path}`);
 for(const a of articles) {
  articleCount++;
  assert.equal(a.headline,d.querySelector('h1').textContent.trim(),path);
  assert.equal(a.mainEntityOfPage,base+path,path);
  assert.equal(a.author?.name,'オカピ研究所',path);
  assert(d.querySelector('.editorial-credit a[href="/about/"]'),`Missing visible editor: ${path}`);
  for(const cite of a.citation||[])assert([...d.querySelectorAll('a[href]')].some(link=>link.href===(typeof cite==='string'?cite:cite.url)),`Invisible citation: ${path}`);
 }
 edges.set(path,[...d.querySelectorAll('a[href]')].map(a=>new URL(a.href)).filter(u=>u.origin===base).map(u=>u.pathname));
}
const reached=new Set(['/']),queue=['/'];
while(queue.length)for(const path of edges.get(queue.shift())||[])if(!reached.has(path)){reached.add(path);queue.push(path);}
for(const path of paths)assert(reached.has(path),`Unreachable from homepage: ${path}`);
const builds=JSON.parse(await read(resolve(root,'data/builds.json'),'utf8')).filter(b=>b.status==='verified');
for(const b of builds) {
 const path=`/builds/${b.classSlug}/${b.slug}/`,d=docs.get(path);
 const answer=d.querySelector('.build-direct-answer');
 assert(answer?.textContent.includes(b.className),`Missing static definition: ${path}`);
 assert(!answer.closest('[hidden],details:not([open])'),path);
 assert(d.querySelector('.build-overview').textContent.includes('主力への切替'),path);
 assert(d.querySelector('.build-answer-source a[href]'),`Missing nearby source: ${path}`);
 const article=[...d.querySelectorAll('script[type="application/ld+json"]')].flatMap(s=>flatten(JSON.parse(s.textContent))).find(s=>s['@type']==='Article');
 assert(article?.citation?.length,`Missing source citations: ${path}`);
}
assert.equal(crawlAllowed(robots,'/assets/styles.css'),true);
assert.equal(crawlAllowed(robots,'/data/builds.json'),true);
console.log(`PASS: ${paths.length} crawlable/snippet-eligible canonical HTML pages, homepage reachability, ${articleCount} attributed articles and ${builds.length} static build answers. Google indexing/citation not asserted.`);
