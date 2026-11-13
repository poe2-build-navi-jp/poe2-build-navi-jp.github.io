// Node transport for the exact browser worker, including packed asset integrity checks.
import {parentPort} from 'node:worker_threads';
import {readFile} from 'node:fs/promises';
const nativeFetch=globalThis.fetch;
globalThis.fetch=async input=>{const url=new URL(input);if(url.protocol==='file:')return new Response(await readFile(url));return nativeFetch(input);};
globalThis.self=globalThis;
globalThis.postMessage=value=>parentPort.postMessage(value);
await import('../../assets/simulator-worker-en.js');
parentPort.on('message',data=>self.onmessage({data}));
