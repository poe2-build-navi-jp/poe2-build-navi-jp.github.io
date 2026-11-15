import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {publicSnapshot, publicPost, postSummary, matchesPost} from '../assets/community-model.js';
const catalog = JSON.parse(await readFile(new URL('../data/community-catalog.json', import.meta.url)));
const samples = JSON.parse(await readFile(new URL('../tools/community-service/src/samples.json', import.meta.url)));
const source = structuredClone(samples[0].saved);
source.notes = 'PRIVATE_NOTE_DO_NOT_PUBLISH';
source.equipmentDrafts = {helmet: 'PRIVATE_DRAFT_DO_NOT_PUBLISH'};
source.weaponSets.sets[0].drafts = {weapon1: 'PRIVATE_WEAPON_DRAFT'};
source.origin = {kind: 'sample', id: 'qa-source', secret: 'PRIVATE_ORIGIN'};
source.request.character.secret = 'PRIVATE_NESTED_VALUE';
const before = JSON.stringify(source);
const snapshot = publicSnapshot(source, catalog);
const encoded = JSON.stringify(snapshot);
assert(!encoded.includes('PRIVATE_'));
assert.equal(JSON.stringify(source), before, 'publication never mutates a saved source');
assert.equal(snapshot.request.items.length, source.request.items.length);
assert.equal(snapshot.weaponSets.sets[0].items.length, source.weaponSets.sets[0].items.length);
assert.equal(snapshot.request.socket_groups[0].gems.length, 4);
assert(snapshot.request.allocated_nodes.length > 100);
const input = {version: 1, title: '<QA title>', nickname: 'Test author', description: 'Public explanation', purpose: 'boss', budget: {amount: 4, currency: 'divine'}, snapshot: source, token: 'PRIVATE_TOKEN'};
const post = publicPost(input, catalog);
assert.equal(post.primarySkill, 'TwisterPlayer');
assert(!JSON.stringify(post).includes('PRIVATE_'));
assert.deepEqual(publicPost(post, catalog), post, 'server projection is stable on replay');
const summary = postSummary(post);
assert(!('snapshot' in summary));
assert(matchesPost(summary, {skill: 'TwisterPlayer', purpose: 'boss', maximum: 5, currency: 'divine', query: 'qa TITLE'}));
assert(!matchesPost(summary, {maximum: 5, currency: 'chaos'}));
assert(!matchesPost({...summary, budget: {amount: null, currency: 'divine'}}, {maximum: 5, currency: 'divine'}));
assert.throws(() => publicPost({...input, title: ''}, catalog));
assert.throws(() => publicPost({...input, budget: {amount: -1, currency: 'divine'}}, catalog));
assert.throws(() => publicPost({...input, budget: {amount: 1, currency: 'dollars'}}, catalog));
for (const mutate of [
  saved => {saved.request.socket_groups[0].gems[0].skill_id = 'MadeUpSkill';},
  saved => {saved.request.allocated_nodes.push(99999999);},
  saved => {saved.request.config_inputs.secretNote = 'PRIVATE';},
  saved => {saved.request.jewels = [{text: 'Unsupported jewel'}];},
  saved => {saved.request.items[0].text = 'A'.repeat(8001);},
  saved => {saved.request.tree_version = '0_4';},
]) {
  const copy = structuredClone(source); mutate(copy);
  assert.throws(() => publicSnapshot(copy, catalog));
}
for (const sample of samples) assert(publicPost({...input, snapshot: sample.saved}, catalog));
console.log('PASS: public projection removes private data, preserves inputs, validates supported snapshots and filters equal-currency budgets');
