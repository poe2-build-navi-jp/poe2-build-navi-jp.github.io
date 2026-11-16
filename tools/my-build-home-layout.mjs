export function myBuildHomeMarkup(presets,en=false){
 const t=(ja,english)=>en?english:ja;
 const catalog=presets.map(({id,name,class:classId,className,path,contentRevision})=>({id,name,class:classId,className,path,contentRevision}));
 const json=JSON.stringify(catalog).replaceAll('<','\\u003c');
 return `<!-- my-build-home:start --><section id="my-build-home" class="my-build-home" aria-labelledby="my-build-title" hidden>
 <header class="my-build-head"><div><p class="my-build-eyebrow">MY BUILDS</p><h2 id="my-build-title">${t('マイビルド','My builds')}</h2></div><a href="${en?'/en':''}/simulator/">${t('ビルド一覧','All presets')}</a></header>
 <p class="my-build-intro">${t('前回の続きと、目標までの残りをここから。','Pick up where you left off and review what is left to reach your target.')}</p>
 <label class="my-build-picker" for="my-build-select">${t('表示する構成','Saved configuration')}<select id="my-build-select"></select></label>
 <div class="my-build-grid" data-my-build-grid>
  <article class="my-build-current" aria-labelledby="my-build-name"><p class="my-build-kind" data-my-build-kind></p><h3 id="my-build-name"></h3><p data-my-build-preset></p><dl class="my-build-metrics"><div><dt>Lv</dt><dd data-my-build-level></dd></div><div><dt>${t('装備','Gear')}</dt><dd data-my-build-equipment></dd></div></dl><p class="my-build-date" data-my-build-date></p><a class="my-build-resume" data-my-build-resume>${t('続きから編集','Continue editing')} <span aria-hidden="true">→</span></a></article>
  <section class="my-build-goal" aria-labelledby="my-build-goal-title"><h3 id="my-build-goal-title">${t('目標までの残り','Your target')}</h3><div data-my-build-goal></div><a class="my-build-secondary" data-my-build-goal-open>${t('目標を確認・設定','Review or set a target')}</a></section>
  <section class="my-build-updates" aria-labelledby="my-build-updates-title"><h3 id="my-build-updates-title">${t('この構成に関係する更新','Updates for this build')} <span data-my-build-update-count></span></h3><div data-my-build-updates aria-live="polite"></div><div class="my-build-update-actions"><button type="button" data-my-build-seen hidden>${t('表示した案内を既読にする','Mark shown updates as read')}</button><button type="button" data-my-build-retry hidden>${t('再読み込み','Retry')}</button></div></section>
 </div><p class="my-build-warning" data-my-build-warning role="status"></p><p class="my-build-device">${t('このブラウザーにある保存構成を表示しています。','Showing configurations saved in this browser.')}</p>
 </section><script id="my-build-presets" type="application/json">${json}</script><!-- my-build-home:end -->`;
}
