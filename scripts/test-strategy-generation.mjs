// Verify repeated article/hub generation without changing the working tree.
import assert from 'node:assert/strict';
import {cp,mkdtemp,readFile,rm} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
const root=resolve(import.meta.dirname,'..');
const dir=await mkdtemp(join(tmpdir(),'poe2-strategy-generation-'));
try{
 await cp(root,dir,{recursive:true,filter:src=>!/[\\/](\.git|node_modules)$/.test(src)});
 const guides=JSON.parse(await readFile(join(dir,'data/strategy-guides.json'),'utf8'));
 const files=['index.html','beginner-builds/index.html','guides/index.html','sitemap.xml',...guides.map(g=>`guides/${g.slug}/index.html`),'guides/mapping/index.html','guides/cant-beat-boss/index.html'];
 const beforeHome=await readFile(join(dir,'index.html'),'utf8');
 const sequence=['generate-strategy-articles','enhance-guide-search-intents','generate-strategy-hub','generate-sitemap','enhance-one-hub','inject-analytics','sync-asset-versions','generate-sitemap'];
 const run=()=>{for(const name of sequence)execFileSync('node',[join(dir,'tools',`${name}.mjs`)],{cwd:dir,stdio:'pipe'});};
 run();const first=await Promise.all(files.map(f=>readFile(join(dir,f),'utf8')));
 run();const second=await Promise.all(files.map(f=>readFile(join(dir,f),'utf8')));
 for(let i=0;i<files.length;i++)assert.equal(second[i],first[i],`${files[i]} must be byte-identical after repeated generation`);
 assert.equal(first[0],beforeHome,'The expanded hub must not move the existing home guide link or disclosures');
 console.log(`PASS: ${files.length} strategy/navigation outputs identical after repeat generation; homepage unchanged`);
}finally{await rm(dir,{recursive:true,force:true});}
