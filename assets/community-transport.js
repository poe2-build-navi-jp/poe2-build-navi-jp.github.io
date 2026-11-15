export const PUBLIC_SERVICE_ORIGIN = 'https://poe2-bcr97h.v2.appdeploy.ai';
const channel = 'poe2-public-v1';
const operations = new Set(['list', 'read', 'publish', 'mine', 'withdraw', 'report', 'ping']);
export class PublicBuildTransport {
  constructor() { this.pending = new Map(); this.frame = null; this.ready = null; }
  async init() {
    if (this.ready) return this.ready;
    this.ready = new Promise((resolve, reject) => {
      const frame = document.createElement('iframe');
      this.frame = frame;
      frame.hidden = true; frame.title = 'POE2 public build service'; frame.referrerPolicy = 'no-referrer';
      frame.src = PUBLIC_SERVICE_ORIGIN + '/';
      const timeout = setTimeout(() => reject(this.failure('PUBLIC_TIMEOUT')), 30000);
      window.addEventListener('message', event => {
        if (event.origin !== PUBLIC_SERVICE_ORIGIN || event.source !== frame.contentWindow || event.data?.channel !== channel) return;
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
      this.frame.contentWindow.postMessage({channel, id, operation, body}, PUBLIC_SERVICE_ORIGIN);
    });
  }
  async request(operation, body) { await this.init(); return this.send(operation, body); }
}
