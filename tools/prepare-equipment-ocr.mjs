// Lockfile-owned, same-origin OCR assets. Generated for deployment, never a CDN dependency.
import {mkdir,readFile,writeFile,copyFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const root=new URL('../',import.meta.url), target=new URL('assets/equipment-ocr/v7/',root);
await mkdir(target,{recursive:true});
const files=[
 ['tesseract.js/dist/tesseract.esm.min.js','tesseract.esm.min.js'],
 ['tesseract.js/dist/worker.min.js','worker.min.js'],
 ['tesseract.js/dist/worker.min.js.LICENSE.txt','worker.LICENSE.txt'],
 ['tesseract.js/LICENSE.md','Tesseract-LICENSE.txt'],
 ['tesseract.js-core/LICENSE','core-LICENSE.txt'],
 ...['eng','jpn'].map(lang=>[`@tesseract.js-data/${lang}/4.0.0_best_int/${lang}.traineddata.gz`,`${lang}.traineddata.gz`]),
 ...(await readdir(new URL('node_modules/tesseract.js-core/',root))).filter(s=>/^tesseract-core.*\.wasm\.js$/.test(s)).map(s=>['tesseract.js-core/'+s,s])
];
const manifest=[];
for(const [from,to] of files){
 const source=new URL('node_modules/'+from,root),bytes=await readFile(source);
 await copyFile(source,new URL(to,target));
 manifest.push({file:to,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});
}
await writeFile(new URL('manifest.json',target),JSON.stringify({tesseract:'7.0.0',core:'7.0.0',data:'1.0.0',files:manifest},null,2)+'\n');
await writeFile(new URL('NOTICE.txt',target),`On-device equipment text recognition\n\nTesseract.js 7.0.0: https://github.com/naptha/tesseract.js (Apache-2.0)\nTesseract.js-core 7.0.0: https://github.com/naptha/tesseract.js-core (Apache-2.0)\nEnglish/Japanese best_int traineddata: https://github.com/naptha/tessdata (Apache-2.0, derived from tesseract-ocr/tessdata_best).\n@tesseract.js-data/eng and /jpn 1.0.0 packaging: MIT. Copyright (c) Jerome Wu and contributors.\n\nPermission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the \"Software\"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:\nThe above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.\nTHE SOFTWARE IS PROVIDED \"AS IS\", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.\n`);
console.log('Prepared same-origin equipment OCR: '+manifest.length+' files');
