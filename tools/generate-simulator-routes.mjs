import{readFile,writeFile}from'node:fs/promises';import{gunzipSync}from'node:zlib';
const folder=new URL('../assets/simulator-engine/v0.0.46/',import.meta.url),manifest=JSON.parse(await readFile(new URL('runtime.json',folder)));
const chunks=await Promise.all(manifest.data.parts.map(p=>readFile(new URL(p.file,folder))));const files=JSON.parse(gunzipSync(Buffer.concat(chunks))).files;
const tree=JSON.parse(files['base/passive_tree.json']),byId=new Map(tree.map(n=>[n.skill,n])),adj=new Map(tree.map(n=>[n.skill,new Set(n.connections || [])]));
for(const n of tree)for(const other of n.connections || [])adj.get(other)?.add(n.skill);
const starts=new Set([44683,50986,47175,50459,54447,61525]);
// Site-authored learning routes. These are not copies of a ninja character or a finished build.
const specs={
'monk-whirling-assault':[44683,[49220,62984,32683,17548,35987]],
'mercenary-twister-gemling':[50986,[44605,50609,50795,42177,57204]],
'warrior-shield-wall-smith':[47175,[7721,32416,64327,48006,27950]],
'sorceress-sand-fire':[54447,[2254,5777,48565,49153,9642]],
'huntress-companion':[50459,[1448,37266,5191,52568,33585]],
'ranger-ice-shot-deadeye':[50459,[42781,50795,32683,35987,57204]],
'witch-minion-infernalist':[54447,[2254,5777,48565,49153,9642]],
'druid-plant-oracle':[61525,[51184,15114,58096,36302,2254]],
'witch-ed-contagion-lich':[54447,[2138,36302,2254,56063,3215]],
'mercenary-grenade-gemling':[50986,[50609,58714,17882,65468,7721]],
'huntress-twister-spirit-walker':[50459,[42177,32683,62984,57204,35987]],
'sorceress-spark-stormweaver':[54447,[2254,36302,116,5703,38535]]};
const templates={};
for(const[id,[root,targets]]of Object.entries(specs)){
 const allocated=new Set([root]),steps=[];
 for(const target of targets){
  const queue=[...allocated],parent=new Map(queue.map(i=>[i,null]));
  for(let index=0;index<queue.length&&!parent.has(target);index++)for(const next of [...(adj.get(queue[index]) || [])].sort((a,b)=>a-b)){
   const node=byId.get(next);if(parent.has(next)||!node||node.ascendancy_id||['mastery','keystone','jewel_socket'].includes(node.kind)||starts.has(next)&&next!==root)continue;
   parent.set(next,queue[index]);queue.push(next);
  }
  if(!parent.has(target))throw Error(`Unreachable target ${id}: ${target}`);
  const path=[];for(let n=target;n!==null;n=parent.get(n))path.unshift(n);
  for(const n of path)allocated.add(n);
  if(allocated.size-1>79)throw Error(`Route exceeds level 80 budget: ${id}`);
  steps.push({target,path,nodes:[...allocated].filter(n=>n!==root)});
 }
 templates[id]={root,steps};
}
await writeFile(new URL('../data/simulator-routes.json',import.meta.url),JSON.stringify({dataVersion:manifest.dataVersion,source:'site-authored',templates})+'\n');
console.log(Object.entries(templates).map(([id,t])=>`${id}: ${t.steps.at(-1).nodes.length} nodes`).join('\n'));
