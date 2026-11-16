export const SERVICE_ORIGIN = 'https://poe2-build-services-20261116.ponyoaqua143.chatgpt.site';
export const SERVICE_PROVIDER = 'd1-20261116';
export const LEGACY_RETRY_AT = Date.parse('2026-11-17T00:00:00Z');
export const legacyAvailable = () => Date.now() >= LEGACY_RETRY_AT;
export async function serviceRequest(path, body, origin = SERVICE_ORIGIN) {
  const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 30000);
  try {
    const response = await fetch(origin + path, {method:'POST', credentials:'omit', cache:'no-store', referrerPolicy:'no-referrer',
      headers:{'Content-Type':'application/json'}, body:JSON.stringify(body), signal:controller.signal});
    let data; try { data = await response.json(); } catch { throw Object.assign(Error('SERVICE_RESPONSE'),{status:503}); }
    if (!response.ok) throw Object.assign(Error(data.message || data.error || data.code || 'SERVICE_RETRY'),{status:response.status});
    return data;
  } catch (cause) { if (!cause.status) cause.status = 503; throw cause; }
  finally { clearTimeout(timeout); }
}
const sha256 = async value => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))),byte=>byte.toString(16).padStart(2,'0')).join('');
export class SyncHttpTransport {
  provider = SERVICE_PROVIDER;
  async request(operation, body) {
    if (!['create','read','write','revoke'].includes(operation)) throw Object.assign(Error('SYNC_INPUT'),{status:400});
    const call = (op, input) => serviceRequest('/api/v1/' + op, input);
    if (operation === 'write' && body.ciphertext?.length > 600000) {
      const {ciphertext,...request} = body;
      const upload = {...request,hash:await sha256(JSON.stringify([body.revision,body.iv,ciphertext])),count:Math.ceil(ciphertext.length/150000)};
      const started = await call('upload-start',upload);
      if (started.committed) return {revision:started.revision};
      for (let index=0;index<upload.count;index++) await call('upload-chunk',{...upload,index,ciphertext:ciphertext.slice(index*150000,(index+1)*150000)});
      return call('upload-commit',upload);
    }
    const data = await call(operation,body);
    if (operation !== 'read' || !data.envelope?.chunked) return data;
    const envelope = data.envelope;
    if (!Number.isInteger(envelope.count) || envelope.count<1 || envelope.count>19) throw Error('SYNC_FORMAT');
    let ciphertext = '';
    for(let index=0;index<envelope.count;index++) {
      const chunk = await call('read-chunk',{...body,revision:data.revision,index});
      if(chunk.revision!==data.revision || typeof chunk.ciphertext!=='string' || chunk.ciphertext.length>150000) throw Error('SYNC_FORMAT');
      ciphertext += chunk.ciphertext;
    }
    if(ciphertext.length>2800000 || await sha256(ciphertext)!==envelope.hash) throw Error('SYNC_FORMAT');
    const latest = await call('read',{...body,revision:data.revision});
    if(!latest.unchanged) throw Object.assign(Error('SYNC_CONFLICT'),{status:409});
    return {revision:data.revision,envelope:{iv:envelope.iv,ciphertext}};
  }
}
