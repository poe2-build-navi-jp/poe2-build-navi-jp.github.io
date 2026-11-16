// Compare the compatibility binary with its unmodified release, including full calculation responses.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {newPlan} from '../assets/simulator-model.js';
import {stageVerifiedData} from '../assets/simulator-engine-loader.js';
const root=new URL('../assets/simulator-engine/v0.0.46/',import.meta.url);
const runtime=JSON.parse(await readFile(new URL('runtime.json',root)));
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
async function unpack(bundle){
  const parts=await Promise.all(bundle.parts.map(async part=>{
    const bytes=await readFile(new URL(part.file,root));assert.equal(bytes.length,part.bytes);assert.equal(hash(bytes),part.sha256);return bytes;
  }));
  const bytes=Buffer.concat(parts);assert.equal(hash(bytes),bundle.sha256);return gunzipSync(bytes);
}
assert.equal(runtime.compatibility?.pass,'llvm-memory-copy-fill-lowering');
const original=await unpack(runtime.originalWasm),compatible=await unpack(runtime.wasm);
assert.equal(hash(original),runtime.compatibility.sourceWasmSha256);assert.equal(hash(compatible),runtime.compatibility.wasmSha256);
const sourceModule=new WebAssembly.Module(original),compatibleModule=new WebAssembly.Module(compatible);
assert.deepEqual(WebAssembly.Module.imports(compatibleModule),WebAssembly.Module.imports(sourceModule));
assert.deepEqual(WebAssembly.Module.exports(compatibleModule),WebAssembly.Module.exports(sourceModule));
const pack=JSON.parse(await unpack(runtime.data));
const engines=await Promise.all(['source','compatible'].map(mode=>import(new URL('pobr_wasm.js?engine-compat-qa='+mode,root))));
for(let index=0;index<engines.length;index++){
  const engine=engines[index];await engine.default({module_or_path:index?compatible:original});
  await stageVerifiedData(engine,{version:pack.version,files:{...pack.files}});
  assert.equal(engine.schemaVersion(),19);assert.equal(engine.isDataReady(),true);
}
const [source,changed]=engines;
for(const name of ['gemCatalogJson','uniqueCatalogJson','minionCatalogJson','availableLocales'])assert.deepEqual(JSON.parse(changed[name]()),JSON.parse(source[name]()),name);
const presets=JSON.parse(await readFile(new URL('../data/simulator-presets.json',import.meta.url)));
const examples=JSON.parse(await readFile(new URL('../data/simulator-examples.json',import.meta.url))).examples;
const gems=JSON.parse(source.gemCatalogJson());
const requests=[...presets.map(preset=>[preset.id,newPlan(preset,gems)]),...examples.map(example=>[example.id,example.saved.request])];
for(const [name,request] of requests){
  const normalized={...request,items:(request.items||[]).map(item=>item.slot==='body'?{...item,slot:'bodyarmour'}:item)};
  const json=JSON.stringify(normalized);
  assert.deepEqual(JSON.parse(changed.calculateBuildJson(json)),JSON.parse(source.calculateBuildJson(json)),name+': full calculation response');
}
console.log(`PASS: original/compatible exports, imports, schema, four catalogs and ${requests.length} exact calculation responses`);
