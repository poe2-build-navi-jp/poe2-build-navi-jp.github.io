// Editorial SEO pass. Run after article generators; does not change source-check dates.
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const root=resolve(import.meta.dirname,'..');
const esc=value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const json=value=>JSON.stringify(value).replaceAll('<','\\u003c');
const answerMarker=/<!-- guide-search-answer:start -->[\s\S]*?<!-- guide-search-answer:end -->/g;
const schemaMarker=/<!-- guide-search-schema:start -->[\s\S]*?<!-- guide-search-schema:end -->/g;
function setMeta(html,key,value,kind='name'){
 const expression=new RegExp(`<meta\\b(?=[^>]*\\b${kind}=["']${key.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}["'])[^>]*>`, 'i');
 const tag=`<meta ${kind}="${key}" content="${esc(value)}">`;
 return expression.test(html)?html.replace(expression,()=>tag):html.replace('</head>',`${tag}</head>`);
}
export function enhanceHtml(original,intent,site,pageDate={}){
 if(!/^\/guides\/[a-z0-9-]+\/$/.test(intent.path))throw Error(`Invalid intent route ${intent.path}`);
 if((original.match(/<h1\b/g)||[]).length!==1)throw Error(`${intent.path}: expected one H1`);
 const url=site.baseUrl+intent.path;
 let html=original.replace(answerMarker,'').replace(schemaMarker,'');
 if(!/<title>[^<]*<\/title>/.test(html))throw Error(`${intent.path}: missing title`);
 html=html.replace(/<title>[^<]*<\/title>/,()=>`<title>${esc(intent.title)}</title>`);
 html=html.replace(/(<h1\b[^>]*>)[\s\S]*?(<\/h1>)/,(_,start,end)=>`${start}${esc(intent.h1)}${end}<!-- guide-search-answer:start --><p class="guide-direct-answer">${esc(intent.answer)}</p><!-- guide-search-answer:end -->`);
 html=setMeta(html,'description',intent.description);
 for(const [key,value] of [['og:title',intent.title],['og:description',intent.description]])html=setMeta(html,key,value,'property');
 // Do not add unrelated social cards, but keep any existing text metadata aligned.
 for(const [key,value] of [['twitter:title',intent.title],['twitter:description',intent.description]])if(html.includes(`name="${key}"`))html=setMeta(html,key,value);
 let articles=0;
 function update(node){
  if(Array.isArray(node)){node.forEach(update);return;}
  if(!node||typeof node!=='object')return;
  if(node['@type']==='Article'||(Array.isArray(node['@type'])&&node['@type'].includes('Article'))){
   articles++;node.headline=intent.h1;node.description=intent.description;
   if(intent.editedAt&&(!node.dateModified||node.dateModified<intent.editedAt))node.dateModified=intent.editedAt;
  }
  if(node['@graph'])update(node['@graph']);
 }
 html=html.replace(/(<script\b[^>]*type=["']application\/ld\+json["'][^>]*>)([\s\S]*?)(<\/script>)/g,(_,start,body,end)=>{
  const node=JSON.parse(body);update(node);return start+json(node)+end;
 });
 if(articles>1)throw Error(`${intent.path}: duplicate Article schema`);
 if(!articles){
  const article={'@context':'https://schema.org','@type':'Article',headline:intent.h1,description:intent.description,inLanguage:'ja',mainEntityOfPage:url,author:{'@type':'Organization',name:site.operatorName,url:site.baseUrl+'/about/'},publisher:{'@type':'Organization',name:site.siteName,url:site.baseUrl+'/'}};
  // page-dates.date records a change, not publication. Never relabel it as publication.
  const published=intent.publishedAt||pageDate.datePublished||pageDate.publishedAt;
  if(published)article.datePublished=published;
  if(intent.editedAt||pageDate.dateModified||pageDate.date)article.dateModified=intent.editedAt||pageDate.dateModified||pageDate.date;
  html=html.replace('</head>',`<!-- guide-search-schema:start --><script type="application/ld+json">${json(article)}</script><!-- guide-search-schema:end --></head>`);
 }
 return html;
}
export async function main(){
 const [intents,site,dates]=await Promise.all(['guide-search-intents','site','page-dates'].map(async name=>JSON.parse(await readFile(resolve(root,`data/${name}.json`),'utf8'))));
 if(new Set(intents.map(g=>g.path)).size!==intents.length)throw Error('Duplicate search-intent route');
 for(const intent of intents){const file=resolve(root,intent.path.slice(1),'index.html');const html=await readFile(file,'utf8');const next=enhanceHtml(html,intent,site,dates[intent.path]);if(next!==html)await writeFile(file,next);}
 console.log(`Aligned ${intents.length} guide search intents; existing bodies, TOCs, sources and publication dates preserved.`);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)await main();
