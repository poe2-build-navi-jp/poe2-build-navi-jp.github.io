import {syncKeys, encryptVault, decryptVault} from './simulator-sync-crypto.js?v=6d43b0469b';
import {collectSyncRecords, validateVault, mergeVault, recordHashes, canonical, applySyncRecords, prepareSyncWrites} from './simulator-library-model.js?v=3c9638fed8';
import {SyncHttpTransport, SERVICE_ORIGIN, SERVICE_PROVIDER, legacyAvailable} from './simulator-service.js?v=44af0fc40f';

export const SYNC_ORIGIN = SERVICE_ORIGIN;
export const LEGACY_SYNC_ORIGIN = 'https://poe2-olc5ko.v2.appdeploy.ai';
export const SYNC_CREDENTIAL_KEY = 'poe2-build-sync:code:v1';
export const SYNC_META_KEY = 'poe2-build-sync:state:v1';
export class SyncError extends Error {
  constructor(status, message = 'SYNC_SERVICE') { super(message); this.status = status; }
}
// Retain the export used by existing clients and QA; current traffic uses HTTPS directly.
export class IframeTransport extends SyncHttpTransport {}
export class LegacySyncTransport {
  constructor() { this.pending = new Map(); this.frame = null; this.ready = null; }
  async init() {
    if (this.ready) return this.ready;
    this.ready = new Promise((resolve, reject) => {
      const frame = document.createElement('iframe');
      this.frame = frame;
      frame.hidden = true; frame.title = 'POE2 encrypted sync'; frame.referrerPolicy = 'no-referrer';
      frame.src = LEGACY_SYNC_ORIGIN + '/';
      const timeout = setTimeout(() => reject(new SyncError(503, 'SYNC_FRAME_BLOCKED')), 30000);
      window.addEventListener('message', event => {
        if (event.origin !== LEGACY_SYNC_ORIGIN || event.source !== frame.contentWindow || event.data?.channel !== 'poe2-sync-v1') return;
        const item = this.pending.get(event.data.id);
        if (!item) return;
        this.pending.delete(event.data.id); clearTimeout(item.timeout);
        event.data.ok ? item.resolve(event.data.data) : item.reject(new SyncError(event.data.error?.status || 503));
      });
      frame.addEventListener('load', () => {
        void this.send('ping', {}).then(() => {clearTimeout(timeout); resolve();}, reject);
      });
      frame.addEventListener('error', () => {clearTimeout(timeout); reject(new SyncError(503, 'SYNC_FRAME_BLOCKED'));});
      document.body.append(frame);
    }).catch(cause => { this.frame?.remove(); this.frame = null; this.ready = null; throw cause; });
    return this.ready;
  }
  send(operation, body) {
    return new Promise((resolve, reject) => {
      const id = crypto.randomUUID();
      const timeout = setTimeout(() => {this.pending.delete(id); reject(new SyncError(503, 'SYNC_TIMEOUT'));}, 30000);
      this.pending.set(id, {resolve, reject, timeout});
      this.frame.contentWindow.postMessage({channel:'poe2-sync-v1', id, operation, body}, LEGACY_SYNC_ORIGIN);
    });
  }
  async request(operation, body) { await this.init(); return this.send(operation, body); }
}

export class EncryptedBuildSync {
  constructor({storage, presets, transport, onStatus = () => {}, onApplied = () => {}, conflictSuffix}) {
    Object.assign(this, {storage, presets, transport, onStatus, onApplied, conflictSuffix});
    this.keys = null; this.code = ''; this.meta = {baseline:{}}; this.cache = null;
    this.running = null; this.pending = null; this.epoch = 0; this.paused = false;
    this.provider = transport.provider || SERVICE_PROVIDER; this.needsSeed = false;
  }
  async restore() {
    const code = this.storage.getItem(SYNC_CREDENTIAL_KEY);
    if (!code) return false;
    const keys = await syncKeys(code);
    let meta = {baseline:{}}; this.needsSeed = false;
    const raw = this.storage.getItem(SYNC_META_KEY);
    if (raw) {
      if (raw.length > 600000) throw Error('SYNC_FORMAT');
      const candidate = JSON.parse(raw);
      if (candidate.room === keys.room && candidate.baseline && typeof candidate.baseline === 'object') {
        if (candidate.provider === this.provider) meta = candidate;
        else {meta = {baseline:{},legacy:true}; this.needsSeed = true;}
      }
    }
    this.code = code; this.keys = keys; this.meta = meta; this.cache = null; this.pending = null;
    return true;
  }
  async connect(code, create = false) {
    if (this.keys) throw Error('SYNC_ALREADY_CONNECTED');
    const keys = await syncKeys(code);
    const auth = {room:keys.room, token:keys.token};
    if (create) await this.transport.request('create', auth);
    const data = await this.transport.request('read', auth);
    const vault = data.envelope ? validateVault(await decryptVault(data.envelope, keys), this.presets) : {version:1, records:{}};
    this.storage.setItem(SYNC_CREDENTIAL_KEY, code);
    this.code = code; this.keys = keys; this.meta = {room:keys.room, provider:this.provider, baseline:{}}; this.needsSeed = false;
    this.cache = {revision:data.revision, vault}; this.paused = false; ++this.epoch;
    this.persist();
    return this.sync();
  }
  persist() { this.storage.setItem(SYNC_META_KEY, JSON.stringify({...this.meta, room:this.keys.room, provider:this.provider})); }
  async sync({manual = false} = {}) {
    if (!this.keys || this.paused && !manual) return;
    if (this.running) return this.running;
    if (manual) this.paused = false;
    const execute = () => this.cycle();
    this.running = (globalThis.navigator?.locks ? navigator.locks.request('poe2-build-sync-v1', execute) : execute())
      .catch(cause => {
        if ([402,403,429].includes(cause.status)) this.paused = true;
        this.onStatus({state:'error', cause, paused:this.paused});
        throw cause;
      }).finally(() => {this.running = null;});
    return this.running;
  }
  async cycle() {
    const epoch = this.epoch, keys = this.keys;
    const current = () => epoch === this.epoch && this.keys === keys;
    const auth = {room:keys.room, token:keys.token};
    this.onStatus({state:'syncing'});
    if (this.needsSeed) {
      const local = collectSyncRecords(this.storage, this.presets);
      if (!Object.keys(local.records).length) throw Error('SYNC_LEGACY_EMPTY');
      // Only a restored, previously stored connection may seed local saves.
      // A manually entered join code still never creates a vault.
      await this.transport.request('create', auth);
      if (!current()) return;
      this.needsSeed = false;
    }
    // Retry exactly the same ciphertext/request ID after an ambiguous transport outcome.
    if (this.pending) {
      const pending = this.pending;
      try {
        const data = await this.transport.request('write', pending.body);
        if (!current()) return;
        this.cache = {revision:data.revision, vault:pending.vault};
        this.meta.baseline = pending.localHashes;
        this.persist(); this.pending = null;
      } catch (cause) { if (cause.status === 409) this.pending = null; throw cause; }
    }
    const local = collectSyncRecords(this.storage, this.presets);
    const data = await this.transport.request('read', {...auth, ...(this.cache ? {revision:this.cache.revision} : {})});
    if (!current()) return;
    let remote = data.unchanged ? this.cache?.vault : data.envelope
      ? validateVault(await decryptVault(data.envelope, keys), this.presets) : {version:1, records:{}};
    if (!remote) throw Error('SYNC_FORMAT');
    const merged = await mergeVault(local.records, remote.records, this.meta.baseline,
      {suffix:this.conflictSuffix});
    const vault = validateVault({...remote, records:merged.records}, this.presets);
    prepareSyncWrites(vault.records, this.presets);
    if (!current()) return;
    if ([...local.expected].some(([key, value]) => this.storage.getItem(key) !== value)) {
      this.onStatus({state:'changed'}); return;
    }
    let revision = data.revision;
    if (canonical(vault) !== canonical(remote)) {
      const envelope = await encryptVault(vault, keys);
      if (!current()) return;
      this.pending = {body:{...auth, revision, requestId:crypto.randomUUID(), ...envelope}, vault,
        localHashes:await recordHashes(local.records)};
      try {
        const written = await this.transport.request('write', this.pending.body);
        revision = written.revision;
      } catch (cause) { if (cause.status === 409) this.pending = null; throw cause; }
      if (!current()) return;
    }
    const hasChanges = [...prepareSyncWrites(vault.records, this.presets)].some(([key,value]) => this.storage.getItem(key)!==value);
    const applied = applySyncRecords(this.storage, vault.records, local.expected, this.presets);
    this.meta.baseline = await recordHashes(applied ? vault.records : local.records);
    this.meta.syncedAt = new Date().toISOString();
    this.cache = {revision, vault};
    this.pending = null; this.persist();
    if (applied && hasChanges) this.onApplied({conflicts:merged.conflicts.length});
    this.onStatus({state:applied ? 'synced' : 'changed', at:this.meta.syncedAt, conflicts:merged.conflicts.length,
      count:Object.values(vault.records).filter(r => !r.deleted).length});
  }
  disconnect() {
    ++this.epoch; this.keys = null; this.code = ''; this.cache = null; this.pending = null;
    this.storage.removeItem(SYNC_CREDENTIAL_KEY); this.storage.removeItem(SYNC_META_KEY);
    this.meta = {baseline:{}}; this.paused = false;
    this.needsSeed = false;
    this.onStatus({state:'disconnected'});
  }
  async revoke() {
    const keys = this.keys;
    ++this.epoch;
    if (this.running) try { await this.running; } catch {}
    if (!keys) return;
    await this.transport.request('revoke', {room:keys.room, token:keys.token});
    this.disconnect();
    this.onStatus({state:'revoked'});
  }
  async importLegacy(code = this.code, transport = new LegacySyncTransport()) {
    if (!legacyAvailable()) throw Error('SYNC_LEGACY_PAUSED');
    if (this.keys && code !== this.code) throw Error('SYNC_ALREADY_CONNECTED');
    const initialEpoch = this.epoch, initialKeys = this.keys;
    const initialCurrent = () => initialEpoch === this.epoch && initialKeys === this.keys;
    const keys = await syncKeys(code);
    if (!initialCurrent()) return;
    const data = await transport.request('read',{room:keys.room,token:keys.token});
    const legacy = data.envelope ? validateVault(await decryptVault(data.envelope,keys),this.presets) : {version:1,records:{}};
    if (!initialCurrent()) return;
    // Authenticate with the old vault before a manually entered legacy code can create anything.
    if (!this.keys) await this.connect(code,true);
    const epoch = this.epoch, currentKeys = this.keys;
    const current = () => !!currentKeys && epoch === this.epoch && currentKeys === this.keys;
    await this.sync({manual:true});
    const execute = async () => {
      if (!current()) return;
      const local = collectSyncRecords(this.storage,this.presets);
      const auth = {room:currentKeys.room,token:currentKeys.token};
      const data = await this.transport.request('read',auth);
      const remote = data.envelope ? validateVault(await decryptVault(data.envelope,currentKeys),this.presets) : {version:1,records:{}};
      const reconciled = await mergeVault(local.records,remote.records,this.meta.baseline,{suffix:this.conflictSuffix});
      const merged = await mergeVault(legacy.records,reconciled.records,{}, {suffix:this.conflictSuffix});
      const vault = validateVault({...remote,records:merged.records},this.presets);
      prepareSyncWrites(vault.records,this.presets);
      const envelope = await encryptVault(vault,currentKeys);
      if (!current() || [...local.expected].some(([key,value])=>this.storage.getItem(key)!==value)) throw Error('SYNC_LOCAL_CHANGED');
      this.pending = {body:{...auth,revision:data.revision,requestId:crypto.randomUUID(),...envelope},vault,localHashes:await recordHashes(local.records)};
      try { await this.transport.request('write',this.pending.body); }
      catch(cause) {if(cause.status===409)this.pending=null;throw cause;}
      // The ordinary cycle reconciles the durable receipt and preserves any edits made in flight.
      if (current()) this.meta.legacy = true;
    };
    if (!current()) return;
    if (this.running) await this.running;
    this.running = (globalThis.navigator?.locks ? navigator.locks.request('poe2-build-sync-v1',execute) : execute()).finally(()=>{this.running=null;});
    await this.running;
    await this.sync({manual:true});
  }
}
