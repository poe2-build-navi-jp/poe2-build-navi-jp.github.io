// Renders favicon.svg (the "P2" brand mark as outlines) to the PNG/ICO icons the pages and
// manifest reference. Needs playwright-core + local Chromium (CHROMIUM_PATH) and ImageMagick.
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {chromium} from 'playwright-core';
const root=resolve(import.meta.dirname,'..');
const svg=await readFile(resolve(root,'favicon.svg'),'utf8');
const browser=await chromium.launch(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{});
const render=async(size,file,{square=false}={})=>{
 const page=await browser.newPage({viewport:{width:size,height:size}});
 // Apple touch icons are masked by the OS, so they get a full-bleed background.
 await page.setContent(`<html><body style="margin:0;background:${square?'#10171e':'transparent'}">${svg.replace('<svg ',`<svg width="${size}" height="${size}" `)}</body></html>`);
 await writeFile(resolve(root,file),await page.screenshot({type:'png',omitBackground:!square}));
 await page.close();
};
for(const size of [16,32,48])await render(size,`.icon-${size}.png`);
await render(180,'apple-touch-icon.png',{square:true});
await render(192,'icon-192.png');
await render(512,'icon-512.png');
await browser.close();
const ico=spawnSync('convert',['.icon-16.png','.icon-32.png','.icon-48.png','favicon.ico'],{cwd:root});
spawnSync('rm',['-f','.icon-16.png','.icon-32.png','.icon-48.png'],{cwd:root});
if(ico.status!==0)throw new Error(`ImageMagick failed: ${ico.stderr}`);
console.log('Site icons: favicon.ico, apple-touch-icon.png, icon-192.png, icon-512.png');
