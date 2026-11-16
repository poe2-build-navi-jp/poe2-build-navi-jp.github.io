import {SERVICE_ORIGIN, serviceRequest, legacyAvailable} from './simulator-service.js?v=44af0fc40f';
export const PUBLIC_SERVICE_ORIGIN = SERVICE_ORIGIN;
export const LEGACY_PUBLIC_ORIGIN = 'https://poe2-bcr97h.v2.appdeploy.ai';
const channel = 'poe2-public-v1';
const operations = new Set(['list', 'read', 'publish', 'mine', 'withdraw', 'report', 'ping']);
export class LegacyPublicTransport {
  constructor() { this.pending = new Map(); this.frame = null; this.ready = null; }
  async init() {
    if (this.ready) return this.ready;
    this.ready = new Promise((resolve, reject) => {
      const frame = document.createElement('iframe');
      this.frame = frame;
      frame.hidden = true; frame.title = 'POE2 public build service'; frame.referrerPolicy = 'no-referrer';
      frame.src = LEGACY_PUBLIC_ORIGIN + '/';
      const timeout = setTimeout(() => reject(this.failure('PUBLIC_TIMEOUT')), 30000);
      window.addEventListener('message', event => {
        if (event.origin !== LEGACY_PUBLIC_ORIGIN || event.source !== frame.contentWindow || event.data?.channel !== channel) return;
        const pending = this.pending.get(event.data.id);
        if (!pending) return;
        this.pending.delete(event.data.id); clearTimeout(pending.timeout);
        event.data.ok ? pending.resolve(event.data.data) : pending.reject(this.failure(event.data.error?.code, event.data.error?.status));
      });
      frame.addEventListener('load', () => {
        void this.send('ping', {}).then(() => {clearTimeout(timeout); resolve();}, reject);
      });
      frame.addEventListener('error', () => {clearTimeout(timeout); reject(this.failure('PUBLIC_CONNECTION'));});
      document.body.append(frame);
    }).catch(cause => {this.frame?.remove(); this.frame = null; this.ready = null; throw cause;});
    return this.ready;
  }
  failure(code = 'PUBLIC_RETRY', status = 503) { return Object.assign(new Error(code), {status}); }
  send(operation, body) {
    if (!operations.has(operation) || JSON.stringify(body || {}).length > 100000) return Promise.reject(this.failure('PUBLIC_INPUT', 400));
    return new Promise((resolve, reject) => {
      const id = crypto.randomUUID();
      const timeout = setTimeout(() => {this.pending.delete(id); reject(this.failure('PUBLIC_TIMEOUT'));}, 30000);
      this.pending.set(id, {resolve, reject, timeout});
      this.frame.contentWindow.postMessage({channel, id, operation, body}, LEGACY_PUBLIC_ORIGIN);
    });
  }
  async request(operation, body) { await this.init(); return this.send(operation, body); }
}

export class PublicBuildTransport {
  constructor({legacy = new LegacyPublicTransport()} = {}) {this.legacy = legacy; this.sources = new Map();}
  current(operation,body) {return serviceRequest('/api/public/'+operation,body);}
  old(operation,body) {
    if (!legacyAvailable()) return Promise.reject(Object.assign(Error('PUBLIC_LEGACY_PAUSED'),{status:503}));
    return this.legacy.request(operation,body);
  }
  async request(operation,body={}) {
    if(!operations.has(operation)||JSON.stringify(body).length>100000) throw Object.assign(Error('PUBLIC_INPUT'),{status:400});
    if(operation==='ping')return {ready:true};
    if(operation==='read') {
      if(this.sources.get(body.id)==='legacy')return this.old(operation,body);
      try {const post=await this.current(operation,body);this.sources.set(body.id,'current');return post;}
      catch(cause) {
        if(cause.status!==404 || cause.message==='PUBLIC_WITHDRAWN' || this.sources.get(body.id)==='current')throw cause;
        const post=await this.old(operation,body);this.sources.set(body.id,'legacy');return post;
      }
    }
    if(operation==='withdraw'||operation==='report') {
      if(!this.sources.has(body.id))await this.request('read',{id:body.id});
      return this.sources.get(body.id)==='legacy'?this.old(operation,body):this.current(operation,body);
    }
    const response=await this.current(operation,body);
    if(operation==='publish'){this.sources.set(response.id,'current');return response;}
    if(operation==='list') {
      for(const post of response.posts)this.sources.set(post.id,'current');
      // Historical posts are left at their original source until their owner reads or withdraws them.
      return {...response,legacyNotice:true};
    }
    if(operation==='mine') {
      for(const post of response.posts)this.sources.set(post.id,'current');
      try {
        const old=await this.old(operation,body);
        const known=new Set(response.posts.map(post=>post.id));
        for(const post of old.posts)if(!known.has(post.id)){response.posts.push(post);this.sources.set(post.id,'legacy');}
        return response;
      } catch {return {...response,partial:true};}
    }
    return response;
  }
}
