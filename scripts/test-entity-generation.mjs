import {mkdtemp,cp,readFile,rm} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import assert from 'node:assert/strict';
const root=resolve(import.meta.dirname,'..'),dir=await mkdtemp(join(tmpdir(),'poe2-entity-generation-'));
try{for(const p of ['data','tools','builds','guides'])await cp(join(root,p),join(dir,p),{recursive:true});const es=JSON.parse(await readFile(join(dir,'data/core-entities.json'),'utf8'));const bs=JSON.parse(await readFile(join(dir,'data/builds.json'),'utf8'));const files=['guides/skill-gems/index.html','guides/equipment-basics/index.html','skills/index.html','equipment/index.html',...es.map(e=>`${e.kind==='skill'?'skills':'equipment'}/${e.slug}/index.html`),...bs.filter(b=>es.some(e=>e.buildIds.includes(b.id))).map(b=>`builds/${b.classSlug}/${b.slug}/index.html`)];const run=()=>execFileSync(process.execPath,[join(dir,'tools/generate-core-entities.mjs')],{stdio:'pipe'});run();const a=await Promise.all(files.map(p=>readFile(join(dir,p),'utf8')));run();for(let i=0;i<files.length;i++)assert.equal(await readFile(join(dir,files[i]),'utf8'),a[i],files[i]);console.log(`PASS: ${files.length} entity/build outputs stable after repeated generation`)}finally{await rm(dir,{recursive:true,force:true})}
