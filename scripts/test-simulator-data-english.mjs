import fs from 'node:fs';
import assert from 'node:assert/strict';
const ja=s=>/[\u3040-\u30ff\u3400-\u9fff]/u.test(s);
for(const kind of ['presets','examples']){
 const source=JSON.parse(fs.readFileSync(`data/simulator-${kind}.json`));
 const translated=JSON.parse(fs.readFileSync(`data/simulator-${kind}-en.json`));
 function walk(a,b,p=[]){
  assert.equal(typeof a,typeof b,p.join('.'));
  if(['saved','request','weaponSets'].includes(p.at(-1))){assert.deepEqual(a,b,`Calculation payload changed: ${p.join('.')}`);return;}
  if(typeof a==='string'){
   if(ja(a))assert.ok(!ja(b),`Untranslated display data: ${p.join('.')}`);
   else assert.equal(a,b,`Internal identifier/English source changed: ${p.join('.')}`);
  } else if(Array.isArray(a)){
   assert.equal(a.length,b.length,p.join('.'));a.forEach((x,i)=>walk(x,b[i],[...p,i]));
  } else if(a&&typeof a==='object'){
   assert.deepEqual(Object.keys(a),Object.keys(b),p.join('.'));for(const k of Object.keys(a))walk(a[k],b[k],[...p,k]);
  } else assert.equal(a,b,p.join('.'));
 }
 walk(source,translated);
}
console.log('English data: all display strings translated; IDs, numbers, keys, requests and saves preserved.');
const kelari = JSON.parse(fs.readFileSync('data/simulator-presets-en.json')).find(p=>p.id==='sorceress-sand-fire');
assert.ok(kelari, 'Sand and Fire guide exists');
assert.equal((JSON.stringify(kelari).match(/Kelari's Brutality/g)||[]).length,4,'Verified command name in four leveling instructions');
assert.doesNotMatch(JSON.stringify(kelari),/second command|English name unverified/);
