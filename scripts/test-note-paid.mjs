// The note article boxes come from data/note-paid.json through the build, so a full rebuild keeps them.
import assert from 'node:assert/strict';
import {readFile,mkdtemp,cp,symlink,rm} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {join,resolve} from 'node:path';
import {BUILD_STEPS} from '../tools/build-steps.mjs';
const root=resolve(import.meta.dirname,'..');
const entries=JSON.parse(await readFile(join(root,'data/note-paid.json'),'utf8'));
const at=name=>BUILD_STEPS.indexOf(name);
assert(at('enhance-note-links')>at('localize-japanese-names')&&at('enhance-note-links')<at('generate-sitemap'),'note links run after localization and before page dates are recorded');
assert(entries.length>=1);
for(const e of entries){
 const html=await readFile(join(root,'.'+e.path,'index.html'),'utf8');
 const blocks=html.match(/<!-- note-paid:start -->[\s\S]*?<!-- note-paid:end -->/g)||[];
 assert.equal(blocks.length,1,`${e.path}: exactly one note box`);
 assert(blocks[0].includes(`href="${e.href}"`)&&blocks[0].includes(e.linkText),`${e.path}: note box matches data`);
 const main=html.match(/<main[\s\S]*<\/main>/)?.[0]||'';
 assert(main.includes(blocks[0]),`${e.path}: note box is inside <main>`);
 const one=main.indexOf('<!-- one-link:end -->');assert(one===-1||one<main.indexOf(blocks[0]),`${e.path}: note box follows the 1.0 box`);
}
// Repeatable: rerunning the step changes nothing.
const tmp=await mkdtemp('/tmp/poe2-note-');
try{
 await cp(root,tmp,{recursive:true,filter:p=>!/(^|\/)(node_modules|\.git)$/.test(p)});
 await symlink(join(root,'node_modules'),join(tmp,'node_modules'),'dir');
 for(let i=0;i<2;i++)execFileSync('node',[join(tmp,'tools/enhance-note-links.mjs')],{cwd:tmp,stdio:'ignore'});
 for(const e of entries)assert.equal(await readFile(join(tmp,'.'+e.path,'index.html'),'utf8'),await readFile(join(root,'.'+e.path,'index.html'),'utf8'),`${e.path}: rerun is stable`);
}finally{await rm(tmp,{recursive:true,force:true});}
console.log(`PASS: ${entries.length} note boxes come from data, sit after the 1.0 box, run before page dates and are stable on rebuild.`);
