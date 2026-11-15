// Reproducible names and official planner IDs from the exact shipped game package.
import {readFile, writeFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {Worker} from 'node:worker_threads';
const root = new URL('../', import.meta.url);
const base = new URL('assets/simulator-engine/v0.0.46/', root);
const runtime = JSON.parse(await readFile(new URL('runtime.json', base)));
const packed = Buffer.concat(await Promise.all(runtime.data.parts.map(part => readFile(new URL(part.file, base)))));
const data = JSON.parse(gunzipSync(packed));
const sourceGems = JSON.parse(data.files['base/skill_gems.json']);
const nodes = JSON.parse(data.files['base/passive_tree.json']);
const meta = JSON.parse(data.files['base/passive_tree_meta.json']);
const bases = JSON.parse(data.files['base/base_items.json']);
const worker = new Worker(new URL('../scripts/fixtures/simulator-worker-node.mjs', import.meta.url));
const boot = await new Promise((resolve, reject) => {
  worker.on('error', reject);
  worker.on('message', message => {
    if (message.id !== 1) return;
    message.error ? reject(Error(message.error)) : resolve(message.result);
  });
  worker.postMessage({id: 1, action: 'boot'});
});
await worker.terminate();
const gems = {};
for (const gem of boot.gems.filter(gem => !gem.ui_hidden)) {
  const matches = sourceGems.filter(source => source.granted_effect_id === gem.skill_id);
  const ids = [...new Set(matches.map(source => source.id))];
  gems[gem.skill_id] = {
    name: gem.name,
    itemId: ids.length === 1 ? ids[0] : null,
    support: gem.is_support,
    meta: gem.tags.some(tag => /^meta$/i.test(tag)),
    tags: gem.tags,
  };
}
const index = {
  version: 1, dataVersion: data.version, treeVersion: '0_5',
  source: {
    dataSha256: runtime.data.sha256,
    format: 'https://www.pathofexile.com/developer/docs/game#build-planner',
  },
  classes: meta.classes.map(entry => ({name: entry.name, ascendancies: entry.ascendancies || []})),
  gems,
  nodes: Object.fromEntries(nodes.map(node => [node.skill, {
    id: node.id, name: node.name || node.id, kind: node.kind,
    ...(node.ascendancy_id ? {ascendancy: node.ascendancy_id} : {}),
  }])),
  bases: Object.fromEntries(bases.map(item => [item.name, item.item_class])),
};
await writeFile(new URL('data/simulator-index.json', root), JSON.stringify(index) + '\n');
console.log('Generated official planner IDs for ' + Object.keys(gems).length + ' gems and ' + nodes.length + ' passives');
