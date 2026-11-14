import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
const read=path=>readFile(new URL('../'+path,import.meta.url));
const catalog=JSON.parse(await read('data/passive-icons.json'));
const runtime=JSON.parse(await read('assets/simulator-engine/v0.0.46/runtime.json'));
const files=JSON.parse(gunzipSync(Buffer.concat(await Promise.all(runtime.data.parts.map(part=>read('assets/simulator-engine/v0.0.46/'+part.file)))))).files;
const nodes=JSON.parse(files['base/passive_tree.json']);
assert.equal(catalog.treeVersion,'0_5');assert.equal(catalog.dataVersion,runtime.dataVersion);
assert.equal(Object.keys(catalog.nodes).length,nodes.length);
for(const node of nodes){
 const record=catalog.nodes[node.skill];assert.ok(record,`Missing node ${node.skill}`);
 assert.equal(record.name,node.name);assert.equal(record.kind,node.kind);assert.equal(record.sourceId,node.id);
 const icon=catalog.icons[record.icon];assert.ok(icon,`Missing art for ${node.skill}`);
 assert.ok(catalog.source.files[icon.sourceFile]);assert.ok(icon.sourceLayer>=1);
 assert.ok(icon.x>=0&&icon.y>=0&&icon.x+catalog.sheet.tile<=catalog.sheet.width&&icon.y+catalog.sheet.tile<=catalog.sheet.height);
}
assert.match(catalog.sheet.url,/^\/images\/poe2\/passives\/passive-icons-[a-f0-9]+\.webp$/);
const bytes=await read(catalog.sheet.url.slice(1));assert.equal(bytes.length,catalog.sheet.bytes);
assert.equal(createHash('sha256').update(bytes).digest('hex'),catalog.sheet.sha256);
assert.equal(bytes.toString('ascii',0,4),'RIFF');assert.equal(bytes.toString('ascii',8,12),'WEBP');
for(const file of ['assets/simulator.js','assets/simulator-en.js']){
 const source=String(await read(file));
 assert.ok(source.includes('/data/passive-icons.json?v='+createHash('sha256').update(await read('data/passive-icons.json')).digest('hex').slice(0,10)),file+' must invalidate cached icon correspondence');
}
console.log(`PASS: ${nodes.length} exact passive IDs/names/kinds, ${catalog.icons.length} sourced icons, sprite bounds/checksum, and JA/EN cache fingerprints.`);
