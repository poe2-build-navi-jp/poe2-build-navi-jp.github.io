import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {reviewPlans, noticeParts} from '../assets/simulator-impact-model.js';
import {namedPlanKey} from '../assets/simulator-model.js';
const json = async file => JSON.parse(await readFile(new URL('../' + file, import.meta.url)));
const [index, examples, presets, catalog] = await Promise.all([
  json('data/simulator-index.json'), json('data/simulator-examples.json'),
  json('data/simulator-presets.json'), json('data/saved-build-updates.json'),
]);
const saved = structuredClone(examples.examples.find(example => example.id === 'complete-mercenary-twister-gemling').saved);
const reload = catalog.notices.find(notice => notice.id === 'one-zero-mercenary-reload');
assert.equal(noticeParts(reload, saved, index).parts.length, 0, 'a spear Twister does not become a crossbow change');
const crossbow = Object.keys(index.bases).find(name => index.bases[name] === 'Crossbow');
saved.request.items = saved.request.items.filter(item => !item.slot.startsWith('weapon'));
saved.request.items.push({slot: 'weapon1', text: 'Rarity: RARE\nQA crossbow\n' + crossbow});
saved.weaponSets = null;
const report = noticeParts(reload, saved, index);
assert(report.parts.some(part => part.kind === 'equipment' && part.itemClass === 'Crossbow'));
assert(!report.parts.some(part => part.id === 'TwisterPlayer'), 'an unrelated active skill is not highlighted');
assert.equal(report.basis, 'review', 'an announcement review is not presented as a confirmed stat change');
const infernalist = Object.entries(index.nodes).find(([, node]) => node.ascendancy === 'Witch1' && node.kind !== 'ascendancy_start');
saved.request.allocated_nodes = [Number(infernalist[0]), 4];
const infernal = catalog.notices.find(notice => notice.id === 'one-zero-infernalist-review');
assert.deepEqual(noticeParts(infernal, saved, index).parts.map(part => part.id), [Number(infernalist[0])]);
const unknown = noticeParts({presets: [saved.preset]}, saved, index);
assert(unknown.unknownScope);
assert(unknown.parts.some(part => part.kind === 'gem'));
const records = {version: 1, plans: [{id: 'qa-original', name: '<img src=x>', saved: {...saved, engine: '0.0.45'}}]};
const raw = JSON.stringify(records), key = namedPlanKey(saved.preset);
const storage = {getItem: name => name === key ? raw : null};
const read = reviewPlans(storage, presets);
assert.equal(read.plans.length, 1);
assert.equal(read.plans[0].saved.engine, '0.0.45');
assert.equal(storage.getItem(key), raw, 'review never upgrades or rewrites a save');
const broken = reviewPlans({getItem: name => name === key ? '{broken' : null}, presets);
assert.deepEqual(broken.unreadable, [saved.preset]);
console.log('PASS: exact update selectors, no spear/crossbow false positives, ascendancy nodes, unknown scope and read-only legacy saves');
