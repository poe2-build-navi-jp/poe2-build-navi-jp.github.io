import * as engine from './simulator-engine/v0.0.46/pobr_wasm.js';
import {validRequest} from './simulator-model.js?v=0194a81d11';

const base = new URL('./simulator-engine/v0.0.46/', import.meta.url);
let ready, dataFiles, runtime, gems, uniques, minions;
const digest = async bytes => [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(n=>n.toString(16).padStart(2,'0')).join('');
async function get(name) {
  const response = await fetch(new URL(name,base));
  if (!response.ok) throw new Error(`計算データの取得に失敗しました（${response.status}）。再読み込みしてください。`);
  return response;
}
async function unpack(bundle) {
  const chunks = await Promise.all(bundle.parts.map(async part => {
    const bytes = new Uint8Array(await (await get(part.file)).arrayBuffer());
    if (bytes.length !== part.bytes || await digest(bytes) !== part.sha256) throw new Error('計算データの整合性を確認できません。再読み込みしてください。');
    return bytes;
  }));
  const compressed = new Uint8Array(bundle.bytes);
  let offset = 0; for (const chunk of chunks) {compressed.set(chunk,offset); offset += chunk.length;}
  if (await digest(compressed) !== bundle.sha256) throw new Error('計算データが欠けています。');
  return new Response(new Blob([compressed]).stream().pipeThrough(new DecompressionStream('gzip')));
}
async function boot() {
  postMessage({progress:'計算エンジンとゲームデータを読み込んでいます（初回約9.3MB）…'});
  runtime = await (await get('runtime.json')).json();
  const [wasm,dataResponse] = await Promise.all([unpack(runtime.wasm),unpack(runtime.data)]);
  engine.initSync({module:await wasm.arrayBuffer()});
  if (engine.schemaVersion() !== 19 || runtime.schema !== 19) throw new Error('計算エンジンの版が一致しません。');
  const data = await dataResponse.json();
  if (data.version !== runtime.dataVersion) throw new Error('ゲームデータの版が一致しません。');
  dataFiles = data.files;
  for (const [path,content] of Object.entries(dataFiles)) engine.stageDataFile(path,content);
  engine.initStagedData();
  dataFiles = Object.fromEntries(Object.entries(dataFiles).filter(([path])=>path.includes('passive_tree')));
  gems = JSON.parse(engine.gemCatalogJson());
  uniques = JSON.parse(engine.uniqueCatalogJson());
  minions = JSON.parse(engine.minionCatalogJson());
}
function tree(version) {
  const path = version && version !== '0_5' ? `base/passive_trees/${version}.json` : 'base/passive_tree.json';
  if (!dataFiles[path]) throw new Error(`このパッシブツリーの版には対応していません：${version}`);
  return JSON.parse(dataFiles[path]).map(n => ({skill:n.skill,name:n.name || n.id,kind:n.kind,x:n.x,y:n.y,connections:n.connections || [],stats:n.stats || [],ascendancy_id:n.ascendancy_id}));
}
const calculate = request => {
  if (!validRequest(request)) throw new Error('構成の形式が正しくありません。');
  return JSON.parse(engine.calculateBuildJson(JSON.stringify(request)));
};
self.onmessage = async ({data:{id,action,payload}}) => {
  try {
    ready ||= boot(); await ready;
    let result;
    if (action === 'boot') result = {gems, uniques:uniques.map(({raw,...item})=>item), minions,
      meta:JSON.parse(dataFiles['base/passive_tree_meta.json']), tree:tree(), runtime:{release:runtime.release,dataVersion:runtime.dataVersion}};
    else if (action === 'calculate') result = calculate(payload);
    else if (action === 'tree') result = tree(payload);
    else if (action === 'edit') result = JSON.parse(engine.previewTreeEditJson(JSON.stringify(payload)));
    else if (action === 'unique') {
      const raw=uniques.find(item=>item.id===payload.id)?.raw;
      if(!raw)throw new Error('ユニークが見つかりません。');
      const lines=raw.trimEnd().split('\n');
      const variants=lines.filter(line=>line.startsWith('Variant:')).length;
      const rolls=Object.fromEntries(lines.map((_,index)=>[index,Math.min(1,Math.max(0,payload.roll ?? .5))]));
      result = JSON.parse(engine.uniqueItemDraftJson(JSON.stringify({id:payload.id,...(variants?{variant:variants}:{}),rolls})));
    }
    else throw new Error('不明な操作です。');
    postMessage({id,result});
  } catch (error) {
    let message = error.message || String(error);
    try {message = JSON.parse(message).message || message;} catch {}
    postMessage({id,error:message});
  }
};
