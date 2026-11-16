import {readFile,writeFile,readdir} from 'node:fs/promises';
import {resolve,relative} from 'node:path';
import {insertBlock} from './block-order.mjs';
const root=resolve(import.meta.dirname,'..');
const esc=value=>String(value).replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;').replaceAll('>','&gt;');
const skip=new Set(['assets','data','images','tools','scripts','tests','company','node_modules','dist']);
async function* files(dir=root){for(const entry of await readdir(dir,{withFileTypes:true})){if(entry.name.startsWith('.')||skip.has(entry.name))continue;const path=resolve(dir,entry.name);if(entry.isDirectory())yield*files(path);else if(entry.name.endsWith('.html'))yield path;}}
let count=0;
for await(const file of files()){
 const before=await readFile(file,'utf8');
 if(!before.includes('class="site-header"')||!before.includes('<main'))continue;
 const path='/'+relative(root,file).replace(/index\.html$/,'');
 const en=/<html\b[^>]*lang="en"/.test(before),simulator=path==='/simulator/'||path==='/en/simulator/';
 let html=before.replace(/<!-- site-tools:start -->[\s\S]*?<!-- site-tools:end -->/g,'').replace(/<!-- site-usability:start -->[\s\S]*?<!-- site-usability:end -->/g,'');
 const readable=/^\/(?:builds|guides|skills|equipment|dictionary)\/[^/]+/.test(path)||path==='/what-is-poe2/';
 const h1=html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/)?.[1].replace(/<[^>]+>/g,'').replaceAll('&amp;','&').replaceAll('&quot;','"').replace(/\s+/g,' ').trim()||'';
 if(!/<button\b[^>]*class="[^"]*menu-button/.test(html))html=html.replace(/(<header\b[^>]*class="site-header"[^>]*>[\s\S]*?)(<nav\b[^>]*class="site-nav)/,'$1<button type="button" id="menu-button" class="menu-button" aria-expanded="false" aria-controls="site-nav">'+(en?'Menu':'メニュー')+'</button>$2');
 html=html.replace(/<nav\b([^>]*class="site-nav[^>]*)(>)/,(_,attrs,end)=>`<nav${attrs.includes('id=')?attrs:attrs+' id="site-nav"'}${end}`);
 const search=en?'Search guides':'記事・装備・スキルを検索';
 const tools=`<!-- site-tools:start --><div class="site-tools" data-site-tools${readable?` data-reading-path="${esc(path)}" data-reading-title="${esc(h1)}"`:''}><form action="/search/" method="get" role="search" aria-label="${search}"><label class="site-tools-label" for="site-quick-query">${search}</label><input id="site-quick-query" type="search" name="q" placeholder="${en?'e.g. Twister, mana, equipment':'例：ツイスター、マナ、装備'}" maxlength="120" enterkeyhint="search"><button type="submit">${en?'Search':'検索'}</button></form><button type="button" data-reading-open aria-haspopup="dialog">${en?'Reading list':'保存記事'}</button>${readable?`<button type="button" data-reading-save aria-pressed="false">${en?'Save this page':'この記事を保存'}</button>`:`<a href="${en?'/en':''}/simulator/#sim-resume">${en?'Resume build':'構成の続き'}</a>`}<p data-reading-status role="status"></p></div><!-- site-tools:end -->`;
 html=html.replace('</header>',`</header>${tools}`);
 const assets=`<!-- site-usability:start --><link rel="stylesheet" href="/assets/site-usability.css"><script type="module" src="/assets/site-usability.js"></script>${simulator?'<link rel="stylesheet" href="/assets/simulator-usability.css"><script type="module" src="/assets/simulator-usability.js"></script><link rel="stylesheet" href="/assets/simulator-flow.css"><script type="module" src="/assets/simulator-flow.js"></script>':''}<!-- site-usability:end -->`;
 html=insertBlock(html,'</head>','site-usability',assets);
 if(html!==before)await writeFile(file,html);count++;
}
console.log(`Usability tools: quick search and reading list on ${count} pages.`);
