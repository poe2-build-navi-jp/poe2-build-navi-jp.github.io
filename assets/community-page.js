import {mountCommunity} from './community-ui.js?v=a820c781a7';
import {PublicBuildTransport} from './community-transport.js?v=4d1ed0596b';
import {parseNamedPlans, namedPlanKey} from './simulator-model.js?v=fdda84f09b';
const en = document.documentElement.lang === 'en';
const t = (ja, english) => en ? english : ja;
const HANDOFF_KEY = 'poe2-community-compose:v1';
const root = document.getElementById('community-app');
try {
  const response = await fetch('/data/community-catalog.json?v=d81a252241');
  if (!response.ok) throw Error('PUBLIC_CATALOG');
  const catalog = await response.json();
  const transport = new PublicBuildTransport();
  await mountCommunity(root, {
    api: (operation, body) => transport.request(operation, body), catalog, en,
    publicBase: location.origin + (en ? '/en' : '') + '/community/',
    simulatorBase: location.origin + (en ? '/en' : '') + '/simulator/',
    getSources: async () => {
      const sources = [];
      try {
        const handoff = JSON.parse(localStorage.getItem(HANDOFF_KEY) || 'null');
        if (handoff?.saved && handoff.version === 1) sources.push({id: 'prepared-draft', name: t('シミュレーターから準備した構成', 'Prepared in the simulator'), saved: handoff.saved});
      } catch { /* Keep invalid local data intact and allow file import. */ }
      for (const preset of catalog.presets) {
        try {
          for (const plan of parseNamedPlans(localStorage.getItem(namedPlanKey(preset.id)), preset.id)) {
            sources.push({id: preset.id + ':' + plan.id, name: t('保存：', 'Saved: ') + plan.name, saved: plan.saved});
          }
        } catch { /* One unreadable save must not hide the other saved builds. */ }
      }
      const examplesResponse = await fetch('/data/simulator-examples' + (en ? '-en' : '') + '.json');
      if (examplesResponse.ok) {
        const examples = await examplesResponse.json();
        for (const example of examples.examples.filter(entry => entry.verification?.inputComplete)) sources.push({
          id: 'reference:' + example.id, name: t('参考見本：', 'Reference: ') + example.title, saved: example.saved,
        });
      }
      return sources;
    },
  });
} catch {
  root.textContent = t('投稿用のデータを読み込めませんでした。再読み込みで再試行できます。端末の保存構成は保持しています。', 'Build data could not load. Reload to retry. Your local saves are intact.');
}
