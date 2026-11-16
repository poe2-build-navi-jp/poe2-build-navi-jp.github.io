// Reproduce the compatibility binary from the unmodified, verified PoBR 0.0.46 binary.
// Usage: node tools/prepare-safari-engine.mjs /absolute/path/to/wasm-opt
import {readFile,writeFile,mkdtemp,rm} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {tmpdir} from 'node:os';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {gzipSync,gunzipSync} from 'node:zlib';
const cli=process.argv[2];
if(!cli || !/^wasm-opt version 125\b/.test(execFileSync(cli,['--version'],{encoding:'utf8'})))throw Error('Binaryen wasm-opt 125 is required');
const root=resolve(import.meta.dirname,'../assets/simulator-engine/v0.0.46');
const runtime=JSON.parse(await readFile(join(root,'runtime.json'),'utf8'));
const source=runtime.originalWasm || runtime.wasm;
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const packed=Buffer.concat(await Promise.all(source.parts.map(async part=>{
  const bytes=await readFile(join(root,part.file));if(bytes.length!==part.bytes || sha(bytes)!==part.sha256)throw Error('Invalid original part: '+part.file);return bytes;
})));
if(sha(packed)!==source.sha256)throw Error('Invalid original bundle');
const original=gunzipSync(packed),sourceSha=sha(original);
if(sourceSha!=='808543244d0ab5e2164a08b2e0f0ff9361413f9006671cd050e54d8235b20d9b')throw Error('Unexpected original engine binary');
const temp=await mkdtemp(join(tmpdir(),'poe2-wasm-compat-'));
try{
  await writeFile(join(temp,'source.wasm'),original);
  // This pass replaces the two bulk-memory instructions with equivalent MVP routines.
  // Do not optimize game logic or enable unrelated passes/features here.
  execFileSync(cli,['--llvm-memory-copy-fill-lowering','--enable-bulk-memory','--enable-reference-types','--enable-multivalue','--enable-sign-ext','--enable-nontrapping-float-to-int',join(temp,'source.wasm'),'-o',join(temp,'compatible.wasm')]);
  const compatible=await readFile(join(temp,'compatible.wasm'));
  if(!WebAssembly.validate(compatible))throw Error('Invalid compatibility binary');
  const buffer=gzipSync(compatible,{mtime:0}),parts=[];
  for(let offset=0,index=0;offset<buffer.length;offset+=524288,index++){
    const file=`compat-wasm-${String(index).padStart(2,'0')}.bin`,bytes=buffer.subarray(offset,offset+524288);
    await writeFile(join(root,file),bytes);parts.push({file,bytes:bytes.length,sha256:sha(bytes)});
  }
  runtime.originalWasm=source;
  runtime.wasm={parts,bytes:buffer.length,sha256:sha(buffer)};
  runtime.compatibility={tool:'Binaryen wasm-opt 125',pass:'llvm-memory-copy-fill-lowering',sourceWasmSha256:sourceSha,wasmSha256:sha(compatible)};
  await writeFile(join(root,'runtime.json'),JSON.stringify(runtime,null,2)+'\n');
  console.log('Prepared reproducible bulk-memory compatibility binary: '+sha(compatible));
}finally{await rm(temp,{recursive:true,force:true});}
