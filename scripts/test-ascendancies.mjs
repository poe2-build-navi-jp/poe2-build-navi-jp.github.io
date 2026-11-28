// Ascendancy hub and pages: every ascendancy is generated, listed, linked from its class and agrees with the tier-list article.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const root=resolve(import.meta.dirname,'..');
const read=p=>readFile(resolve(root,p),'utf8');
const data=JSON.parse(await read('data/ascendancies.json'));
const guides=JSON.parse(await read('data/strategy-guides.json'));
const sitemap=await read('sitemap.xml');
const hub=await read('ascendancies/index.html');
const text=h=>h.replace(/<[^>]+>/g,'').replaceAll('&amp;','&');
const table=guides.find(g=>g.slug==='build-tier-list').sections.find(s=>s.id==='ascendancy').table.rows;
assert.equal(data.ascendancies.length,22);
assert.equal(new Set(data.ascendancies.map(a=>a.slug)).size,22,'unique slugs');
assert.match(sitemap,/<loc>https:\/\/poe2-build-navi-jp\.github\.io\/ascendancies\/<\/loc>/);
for(const a of data.ascendancies){
 const html=await read(`ascendancies/${a.slug}/index.html`);
 // After a major release the shown title is rewritten (tools/version-title.mjs); the original stays in a head comment.
 const saved=html.match(/<!-- version-title:original (.*?) -->/)?.[1];
 const title=saved?JSON.parse(decodeURIComponent(saved)).title:html.match(/<title>([^<]*)<\/title>/)[1];
 assert.ok(title.includes(`（${data.version}）`),`${a.slug}: title names the checked version, not the live game version`);
 assert.equal(text(html.match(/<h1>([\s\S]*?)<\/h1>/)[1]),title.replaceAll('&amp;','&'),`${a.slug}: h1 matches title`);
 assert.ok(title.includes(a.name)&&title.includes(a.englishName),`${a.slug}: title names`);
 assert.ok(sitemap.includes(`/ascendancies/${a.slug}/</loc>`),`${a.slug}: in sitemap`);
 assert.ok(hub.includes(`href="/ascendancies/${a.slug}/"`),`${a.slug}: linked from hub`);
 assert.ok((await read(`classes/${a.classSlug}/index.html`)).includes(`href="/ascendancies/${a.slug}/"`),`${a.slug}: linked from class page`);
 const nodes=html.match(/<section id="nodes"[\s\S]*?<\/section>/)[0];
 assert.equal((nodes.match(/<tr><th scope="row">/g)||[]).length,a.nodes.length,`${a.slug}: node rows`);
 assert.ok(!/（[^（）<]*（/.test(text(nodes)),`${a.slug}: no doubled name glosses in nodes`);
 const row=table.find(r=>r[1]===a.englishName);
 assert.ok(row,`${a.slug}: in tier-list article`);
 assert.deepEqual([row[2],row[3]],[a.maxrollTier,a.pathofexileggTier],`${a.slug}: tiers agree with the tier-list article`);
 for(const id of a.siteBuildIds)assert.ok(html.includes('/builds/'),`${a.slug}: build links`);
 assert.ok(html.includes(a.poe2db)&&html.includes('/guides/ascendancy-trials/'),`${a.slug}: source and trials link`);
}
assert.ok((await read('guides/build-tier-list/index.html')).includes('href="/ascendancies/"'),'tier list links the hub');
assert.ok((await read('index.html')).includes('href="/ascendancies/"'),'home links the hub');
console.log(`PASS: ${data.ascendancies.length} ascendancy pages, hub, class links and tier agreement`);
