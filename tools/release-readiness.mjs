// Read-only report of what still has to change for a game version (default:
// data/site.json nextGameVersion). Usage:
//   node tools/release-readiness.mjs            # report for nextGameVersion
//   node tools/release-readiness.mjs 1.0 --strict   # exit 1 while anything is pending
import {readFile,readdir} from 'node:fs/promises';
import {resolve} from 'node:path';
const root=resolve(import.meta.dirname,'..');
const read=p=>readFile(resolve(root,p),'utf8');
const site=JSON.parse(await read('data/site.json'));
const builds=JSON.parse(await read('data/builds.json')).filter(b=>b.status!=='draft');
const classes=JSON.parse(await read('data/classes.json'));
const args=process.argv.slice(2);
const target=args.find(a=>!a.startsWith('--'))||site.nextGameVersion;
const strict=args.includes('--strict');
const release=site.nextGameVersion===target?site.nextGameVersionReleaseDate:null;
const current=site.siteVersion;
const pending=[];
const line=s=>console.log(s);

line(`# PoE2 ${target} リリース準備チェック`);
line('');
line(`- サイトの対応版（siteVersion）: ${current}`);
line(`- 公開中のゲーム版（gameVersion）: ${site.gameVersion}${site.gameVersion===target?' ✓':` → リリース当日に "${target}" へ変更`}`);
if(release)line(`- リリース予定日: ${release}`);
if(site.gameVersion!==target)pending.push('site.gameVersion');

line('');
line(`## ビルド（${builds.filter(b=>b.version===target).length}/${builds.length} 件が ${target} 確認済み）`);
line('');
line('| ビルド | version | 資料確認日 | リリース後に確認した資料 | 状態 |');
line('|---|---|---|---|---|');
for(const b of builds){
 const fresh=release?b.sources.filter(s=>s.checkedAt>=release).length:0;
 const done=b.version===target;
 if(!done)pending.push(b.id);
 line(`| ${b.id} | ${b.version} | ${b.updatedAt} | ${release?`${fresh}/${b.sources.length}`:'—'} | ${done?'✓ 確認済み':'要再確認'} |`);
}

line('');
line('## 職業');
const hasDuelist=classes.some(c=>c.slug==='duelist');
line(`- 職業数: ${classes.length}${hasDuelist?'（Duelistあり ✓）':'（Duelist未追加。1.0で追加予定の公式発表あり）'}`);
if(target.startsWith('1')&&!hasDuelist)pending.push('duelist');

// Version strings that were written by hand and will not follow data/site.json.
const escaped=current.replaceAll('.','\\.');
const pattern=new RegExp(`(?<![\\d.])${escaped}(?![\\d])`,'g');
const ignored=new Set(['.git','node_modules','company','images','scripts','tests']);
const hits=[];
async function walk(dir=''){
 for(const e of await readdir(resolve(root,dir),{withFileTypes:true})){
  if(e.name.startsWith('.')||ignored.has(e.name))continue;
  const path=dir?`${dir}/${e.name}`:e.name;
  if(e.isDirectory()){await walk(path);continue;}
  if(!/\.(html|mjs|js|json)$/.test(e.name)||/^package(-lock)?\.json$/.test(e.name))continue;
  const text=await read(path);
  const count=(text.match(pattern)||[]).length;
  const title=/\.html$/.test(e.name)&&(text.match(/<title>[^<]*<\/title>/)?.[0]||'').match(pattern);
  if(count)hits.push({path,count,title:!!title});
 }
}
await walk();
line('');
line(`## 手書きの「${current}」表記（${hits.length}ファイル・${hits.reduce((n,h)=>n+h.count,0)}箇所）`);
line('');
line(`${target}の確認が済んだページから書き換える。タイトルに含むページは検索結果に直接出るため優先する。`);
line('');
for(const group of [['tools','tools/'],['data','data/'],['assets','assets/'],['HTML',null]]){
 const list=hits.filter(h=>group[1]?h.path.startsWith(group[1]):h.path.endsWith('.html')).sort((a,b)=>b.title-a.title||b.count-a.count);
 if(!list.length)continue;
 line(`- ${group[0]}: ${list.length}ファイル（タイトルに含む: ${list.filter(h=>h.title).length}）`);
 for(const h of list.slice(0,group[0]==='HTML'?12:50))line(`  - ${h.path}: ${h.count}${h.title?'（タイトル）':''}`);
 if(list.length>12&&group[0]==='HTML')line(`  - …ほか${list.length-12}ファイル`);
}

line('');
line(pending.length?`**未完了: ${pending.length}項目**（${pending.slice(0,5).join(', ')}${pending.length>5?' …':''}）`:'**すべて完了**');
if(strict&&pending.length)process.exit(1);
