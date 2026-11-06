// Reproduce the pinned runtime from an extracted, checksum-verified official release archive.
// Does not run during the site build and never downloads or executes third-party scripts.
import {readFile,writeFile,mkdir,copyFile}from'node:fs/promises';
import {resolve}from'node:path';import{createHash}from'node:crypto';import{gzipSync}from'node:zlib';
const source=process.argv[2];if(!source)throw Error('Usage: node tools/vendor-simulator-engine.mjs /path/to/pobr-wasm-v0.0.46-web');
const root=resolve(import.meta.dirname,'..'),directory=resolve(source),out=resolve(root,'assets/simulator-engine/v0.0.46');
const sha=b=>createHash('sha256').update(b).digest('hex');
const manifest=JSON.parse(await readFile(resolve(directory,'manifest.json'),'utf8'));
if(manifest.packageVersion!=='0.0.46'||manifest.schemaVersion!==19||manifest.dataVersion!=='0.5.5.5')throw Error('Unexpected engine / schema / game-data version');
for(const item of manifest.files)if(sha(await readFile(resolve(directory,item.name)))!==item.sha256)throw Error(`Checksum mismatch: ${item.name}`);
await mkdir(out,{recursive:true});
for(const name of ['pobr_wasm.js','LICENSE','manifest.json'])await copyFile(resolve(directory,name),resolve(out,name==='LICENSE'?'LICENSE.txt':name));
const packed={};
for(const [name,buffer]of [['wasm',gzipSync(await readFile(resolve(directory,'pobr_wasm_bg.wasm')),{mtime:0})],['data',await readFile(resolve(directory,'pobr-data.json.gz'))]]){
 const parts=[];for(let offset=0,index=0;offset<buffer.length;offset+=524288,index++){
  const file=`${name}-${String(index).padStart(2,'0')}.bin`,bytes=buffer.subarray(offset,offset+524288);await writeFile(resolve(out,file),bytes);parts.push({file,bytes:bytes.length,sha256:sha(bytes)});
 }packed[name]={parts,bytes:buffer.length,sha256:sha(buffer)};
}
await writeFile(resolve(out,'runtime.json'),JSON.stringify({release:'0.0.46',schema:19,dataVersion:manifest.dataVersion,source:'https://github.com/ackness/pobr/releases/tag/v0.0.46',archiveSha256:'49546f88ef88605a3a9071acbb0e411faf87be57081f6e0af1d1d03e27093e3d',...packed},null,2)+'\n');
console.log('Packed verified PoBR 0.0.46 runtime. Keep its MIT license with the distribution.');
