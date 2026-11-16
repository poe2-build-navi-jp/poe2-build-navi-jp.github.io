import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {stageVerifiedData,reserveStartupArena} from '../assets/simulator-engine-loader.js';
const arena=[];
reserveStartupArena({__wbindgen_malloc:(bytes,align)=>{arena.push(['allocate',bytes,align]);return 2048;},__wbindgen_free:(...args)=>arena.push(['release',...args])});
assert.deepEqual(arena,[['allocate',160*1024*1024,1],['release',2048,160*1024*1024,1]]);
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const contents={'base/passive_tree.json':'[{"name":"日本語"}]','base/large.json':'{"data":"test"}'};
const pack=()=>({version:'test',files:{...contents,'optional/sidecar.json':'{}','manifest.json':JSON.stringify({poe_version:'test',files:Object.fromEntries(Object.entries(contents).map(([path,text])=>[path,hash(Buffer.from(text))]))})}});
const staged=[];let initialized=false,yields=0;
const data=pack();
const kept=await stageVerifiedData({stageDataBytes(path,bytes){assert(bytes instanceof Uint8Array);staged.push([path,Buffer.from(bytes).toString('utf8')]);},initStagedDataVerified(){assert.equal(Object.keys(data.files).length,0,'large pack references must be released before engine indexing');initialized=true;}},data,{yieldControl:async()=>{yields++;}});
assert(initialized);assert.equal(yields,4);assert.equal(staged.length,4);
assert.deepEqual(staged.find(([path])=>path==='base/passive_tree.json'),['base/passive_tree.json',contents['base/passive_tree.json']]);
assert.deepEqual(Object.keys(kept),['base/passive_tree.json']);
for(const corrupt of [p=>p.files['base/large.json']='tampered',p=>delete p.files['base/large.json'],p=>p.files['../escape.json']='{}',p=>p.version='wrong']){
 const next=pack();corrupt(next);let init=false;
 await assert.rejects(stageVerifiedData({stageDataBytes(){},initStagedDataVerified(){init=true;}},next,{yieldControl:async()=>{}}),/ENGINE_DATA_INTEGRITY/);
 assert.equal(init,false,'a failed file check cannot activate engine data');
}
console.log('PASS: exact UTF-8 byte transfer, per-file digests, optional sidecars, released pack references, kept tree data and corrupt-pack rejection');
