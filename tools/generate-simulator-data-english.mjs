/** English display data only. Never translates calculation requests or save payloads. */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const hasJa=s=>/[\u3040-\u30ff\u3400-\u9fff]/u.test(s);
const dictionaries=['data/simulator-presets-en-a.json','data/simulator-presets-en-b.json','data/simulator-examples-en-dictionary.json'];
const dict=Object.assign({},...dictionaries.map(read));
const missing=new Set();
function translate(x,p=[]){
 // Full saved builds are deliberately byte-for-byte equivalent as objects: item
 // display names may be Japanese but no calculation strings or save keys change.
 if(['saved','request','weaponSets'].includes(p.at(-1)))return x;
 if(typeof x==='string'){
  if(!hasJa(x))return x;
  if(dict[x]!==undefined)return dict[x];
  missing.add(p.join('.')+'\t'+x);return x;
 }
 if(Array.isArray(x))return x.map((v,i)=>translate(v,[...p,i]));
 if(x && typeof x==='object')return Object.fromEntries(Object.entries(x).map(([k,v])=>[k,translate(v,[...p,k])]));
 return x;
}
const results=['presets','examples'].map(kind=>[kind,translate(read(`data/simulator-${kind}.json`))]);
for(const example of results.find(([kind])=>kind==='examples')[1].examples){
 if(example.source?.href?.startsWith('/') && !example.source.label.endsWith('(Japanese)'))example.source.label+=' (Japanese)';
}
if(missing.size)throw new Error(`Missing English display data translations:\n${[...missing].join('\n')}`);
for(const[kind,data]of results)fs.writeFileSync(path.join(root,`data/simulator-${kind}-en.json`),JSON.stringify(data,null,2)+'\n');
console.log('Generated English preset and example display data; calculation payloads preserved');
