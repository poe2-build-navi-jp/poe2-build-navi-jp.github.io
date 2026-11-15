import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {namedPlanKey} from '../assets/simulator-model.js';
import {newSyncCode, syncKeys, encryptVault, decryptVault, SYNC_LIMIT} from '../assets/simulator-sync-crypto.js';
import {JOURNAL_KEY, collectSyncRecords, recordHashes, mergeVault, applySyncRecords, comparisonConditions, relevantNotices, validateVault} from '../assets/simulator-library-model.js';
import {EncryptedBuildSync, SyncError, SYNC_CREDENTIAL_KEY} from '../assets/simulator-sync.js';

const presets=JSON.parse(await readFile(new URL('../data/simulator-presets.json',import.meta.url)));
const sample=JSON.parse(await readFile(new URL('../data/simulator-examples.json',import.meta.url))).examples[0].saved;
class Storage {
  data=new Map();
  getItem(key){return this.data.get(key)??null;}
  setItem(key,value){this.data.set(key,String(value));}
  removeItem(key){this.data.delete(key);}
}
class Service {
  rooms=new Map(); writes=[]; loseReply=false;
  async request(operation,body){
    let room=this.rooms.get(body.room);
    if(operation==='create'&&!room){room={token:body.token,revision:0,envelope:null,receipts:new Map(),revoked:false};this.rooms.set(body.room,room);}
    if(!room||room.token!==body.token||room.revoked)throw new SyncError(403);
    if(operation==='create')return {revision:room.revision};
    if(operation==='read')return body.revision===room.revision?{revision:room.revision,unchanged:true}:{revision:room.revision,envelope:room.envelope};
    if(operation==='revoke'){room.revoked=true;room.envelope=null;return {revoked:true};}
    assert.equal(operation,'write');this.writes.push(structuredClone(body));
    const receipt=room.receipts.get(body.requestId);
    if(receipt){assert.equal(receipt.payload,JSON.stringify(body));return {revision:receipt.revision};}
    if(body.revision!==room.revision)throw new SyncError(409);
    room.envelope={iv:body.iv,ciphertext:body.ciphertext};++room.revision;
    room.receipts.set(body.requestId,{revision:room.revision,payload:JSON.stringify(body)});
    if(this.loseReply){this.loseReply=false;throw new SyncError(503);}
    return {revision:room.revision};
  }
}
const planKey=namedPlanKey(sample.preset),get=storage=>JSON.parse(storage.getItem(planKey)||'{"plans":[]}').plans;
const set=(storage,plans)=>storage.setItem(planKey,JSON.stringify({version:1,plans}));
const entry={id:'original-plan',name:'私の構成',saved:structuredClone(sample)};
const code=newSyncCode(),keys=await syncKeys(code);
assert.equal(code.length,43);
const envelope=await encryptVault({version:1,records:{},label:'private-vault'},keys);
assert(!JSON.stringify(envelope).includes('private-vault'));
assert.equal((await decryptVault(envelope,keys)).label,'private-vault');
await assert.rejects(()=>decryptVault(envelope,awaitKeys()));
function awaitKeys(){return {key:keys.key,room:'wrong-associated-room'};}
await assert.rejects(()=>encryptVault({padding:'x'.repeat(SYNC_LIMIT)},keys),/SYNC_CAPACITY/);
await assert.rejects(()=>syncKeys('wrong-code'));

const service=new Service(),a=new Storage(),b=new Storage();set(a,[entry]);
const autosave='poe2-simulator:v1:'+sample.preset;a.setItem(autosave,'ACTIVE DRAFT MUST STAY');
const client=storage=>new EncryptedBuildSync({storage,presets,transport:service});
const ca=client(a),cb=client(b);
await ca.connect(code,true);await cb.connect(code);
assert.deepEqual(get(b),get(a));assert.equal(a.getItem(autosave),'ACTIVE DRAFT MUST STAY');
let edit=get(b);edit[0].name='スマホで更新';set(b,edit);await cb.sync();await ca.sync();assert.equal(get(a)[0].name,'スマホで更新');
edit=get(a);edit[0].saved.notes='PCの編集';set(a,edit);
edit=get(b);edit[0].saved.notes='スマホの編集';set(b,edit);
await ca.sync();await cb.sync();await ca.sync();
assert.equal(get(a).length,2);assert.deepEqual(new Set(get(a).map(p=>p.saved.notes)),new Set(['PCの編集','スマホの編集']));
const count=get(a).length;await cb.sync();await ca.sync();assert.equal(get(a).length,count,'stable conflicts do not create repeated copies');
set(b,get(b).filter(p=>p.id!=='original-plan'));await cb.sync();await ca.sync();assert(!get(a).some(p=>p.id==='original-plan'),'deletions propagate');
await ca.sync();assert(!get(a).some(p=>p.id==='original-plan'),'old copies cannot resurrect a deleted identity');

edit=get(a);edit[0].name='応答を失った保存';set(a,edit);service.loseReply=true;
await assert.rejects(()=>ca.sync(),cause=>cause.status===503);
const request=service.writes.at(-1);await ca.sync();
assert.equal(service.writes.at(-1).requestId,request.requestId,'uncertain commits reuse the same request id');
assert.equal(service.writes.at(-1).ciphertext,request.ciphertext,'uncertain commits retry identical ciphertext');
await cb.sync();assert.equal(get(b)[0].name,'応答を失った保存');
const disk=client(a);assert(await disk.restore());assert.equal(disk.code,code);
const bad=client(new Storage());await assert.rejects(()=>bad.connect(newSyncCode()),cause=>cause.status===403);assert.equal(bad.keys,null);
const beforeDisconnect=a.getItem(planKey);ca.disconnect();assert.equal(a.getItem(SYNC_CREDENTIAL_KEY),null);assert.equal(a.getItem(planKey),beforeDisconnect);
await cb.revoke();await assert.rejects(()=>disk.sync(),cause=>cause.status===403);assert.equal(a.getItem(planKey),beforeDisconnect);

// Concurrent local writes after network reconciliation remain untouched.
const snapshot=collectSyncRecords(a,presets),records=snapshot.records;
a.setItem(planKey,'CHANGED AFTER READING');assert.equal(applySyncRecords(a,records,snapshot.expected,presets),false);assert.equal(a.getItem(planKey),'CHANGED AFTER READING');
set(a,[entry]);const original=collectSyncRecords(a,presets),base=await recordHashes(original.records);
const remote=structuredClone(original.records),remoteKey=Object.keys(remote)[0];remote[remoteKey].value.saved.notes='remote edit';
const deleted=await mergeVault({},remote,base,{newId:()=> 'safe-copy'});
assert(deleted.records[remoteKey].deleted);assert.equal(deleted.records['plan:'+sample.preset+':safe-copy'].value.saved.notes,'remote edit');
assert.throws(()=>validateVault({version:1,records:{'plan:unknown:x':{kind:'plan',preset:'unknown',id:'x',value:entry}}},presets));
const comparisons=JSON.parse(await readFile(new URL('../data/simulator-examples.json',import.meta.url))).comparisons;
const conditions=comparisonConditions(comparisons[0]);assert.deepEqual(conditions.differences,[]);
const changed=structuredClone(comparisons[0]);changed.b.request.character.level=70;
assert(comparisonConditions(changed).differences.includes('level'));
const notices=[{id:'a',revision:2,presets:[sample.preset]},{id:'b',revision:1,presets:['unrelated']}];
assert.deepEqual(relevantNotices(notices,Object.values(original.records),{a:1}).map(n=>[n.id,n.unread]),[['a',true]]);
assert.equal(relevantNotices(notices,Object.values(original.records),{a:2})[0].unread,false);
console.log('PASS: encryption, authorization, cross-device persistence, preserved drafts, conflict copies, deletion, replay, revocation, save guards, comparison conditions and notice relevance');
