import {api} from '@appdeploy/client';
import catalog from './catalog.json';
import samples from './samples.json';
import {mountCommunity} from './community-ui.js';
import './styles.css';
import './community.css';

const operations = new Set(['list', 'read', 'publish', 'mine', 'withdraw', 'report']);
const channel = 'poe2-public-v1';
async function request(operation: string, body: unknown) {
  if (!operations.has(operation)) throw new Error('PUBLIC_INPUT');
  const {data} = await api.post('/api/public/' + operation, body);
  return data;
}
const allowedParents = new Set([
  'https://poe2-build-navi-jp.github.io',
  'http://127.0.0.1:4173',
  'http://localhost:4173',
]);
if (window.parent !== window) {
  window.addEventListener('message', async event => {
    const message = event.data;
    if (event.source !== parent || !allowedParents.has(event.origin) ||
        message?.channel !== channel || typeof message.id !== 'string' || message.id.length > 80) return;
    const respond = (result: object) => parent.postMessage({channel, id: message.id, ...result}, event.origin);
    if (message.operation === 'ping') {respond({ok: true, data: {version: 1}}); return;}
    if (!operations.has(message.operation) || JSON.stringify(message.body || {}).length > 100000) return;
    try { respond({ok: true, data: await request(message.operation, message.body)}); }
    catch (cause: any) {
      const code = cause?.response?.data?.error || cause?.response?.data?.message || cause?.message || 'PUBLIC_RETRY';
      respond({ok: false, error: {status: cause?.response?.status || cause?.status || 503, code}});
    }
  });
} else {
  const en = new URLSearchParams(location.search).get('lang') === 'en';
  document.documentElement.lang = en ? 'en' : 'ja';
  document.getElementById('app')!.innerHTML = '<header class="service-header"><a href="https://poe2-build-navi-jp.github.io/">POE2 BUILD NAVI</a></header>' +
    '<main class="community-page"><div class="community-intro"><p class="community-eyebrow">COMMUNITY BUILDS</p><h1>' +
    (en ? 'Builds from the community' : 'みんなのビルド') + '</h1><p>' +
    (en ? 'Find configurations by skill, budget and purpose. Review a snapshot in the simulator and share the post.' : 'スキル・予算・用途で構成を探す。気になる投稿はシミュレーターで確認して、そのまま共有できます。') +
    '</p></div><div id="community-app"></div><p><a href="https://poe2-build-navi-jp.github.io/privacy/#community-privacy">' +
    (en ? 'Privacy and public sharing' : '公開内容と個人情報の取り扱い') + '</a></p></main>';
  void mountCommunity(document.getElementById('community-app'), {
    api: async (operation: string, body: unknown) => {
      try { return await request(operation, body); }
      catch (cause: any) {
        const failure = new Error(cause?.response?.data?.error || cause?.message || 'PUBLIC_RETRY') as Error & {status: number};
        failure.status = cause?.response?.status || cause?.status || 503;
        throw failure;
      }
    },
    catalog, getSources: async () => samples.map(sample => ({...sample, name: (en ? 'Reference: ' : '参考見本：') + sample.name})),
    publicBase: 'https://poe2-build-navi-jp.github.io/' + (en ? 'en/' : '') + 'community/',
    simulatorBase: 'https://poe2-build-navi-jp.github.io/' + (en ? 'en/' : '') + 'simulator/',
    en,
  });
}
