import {growthMarkup} from './my-build-growth-layout.mjs';
// compact: the home page shows a small square tile that opens and closes the full panel.
export function myBuildHomeMarkup(presets,en=false,{compact=false}={}){
 const t=(ja,english)=>en?english:ja;
 const catalog=presets.map(({id,name,class:classId,className,path,contentRevision})=>({id,name,class:classId,className,path,contentRevision}));
 const json=JSON.stringify(catalog).replaceAll('<','\\u003c');
 return `<!-- my-build-home:start --><section id="my-build-home" class="my-build-home${compact?' is-compact':''}" aria-labelledby="my-build-title" hidden>${compact?`
 <button type="button" class="my-build-tile" data-my-build-toggle aria-expanded="false" aria-controls="my-build-panel"><span class="my-build-tile-eyebrow" aria-hidden="true">MY BUILDS</span><b>${t('マイビルド','My builds')}</b><span class="my-build-tile-meta" data-my-build-tile-meta></span><span class="my-build-tile-state" data-my-build-tile-state>${t('開く','Open')}</span></button><div id="my-build-panel" class="my-build-panel" data-my-build-panel hidden>`:''}
 <header class="my-build-head"><div><p class="my-build-eyebrow">MY BUILDS</p><h2 id="my-build-title">${t('マイビルド','My builds')}</h2></div><a href="${en?'/en':''}/simulator/">${t('ビルド一覧','All presets')}</a></header>
 <p class="my-build-intro">${t('前回の続きと、目標までの残りをここから。','Pick up where you left off and review what is left to reach your target.')}</p>
 <label class="my-build-picker" for="my-build-select">${t('表示する構成','Saved configuration')}<select id="my-build-select"></select></label>
 <div class="my-build-grid" data-my-build-grid>
 <div class="my-build-column">
  <article class="my-build-current" aria-labelledby="my-build-name"><p class="my-build-kind" data-my-build-kind></p><h3 id="my-build-name"></h3><p data-my-build-preset></p><dl class="my-build-metrics"><div><dt>Lv</dt><dd data-my-build-level></dd></div><div><dt>${t('装備','Gear')}</dt><dd data-my-build-equipment></dd></div></dl><p class="my-build-date" data-my-build-date></p><a class="my-build-resume" data-my-build-resume>${t('続きから編集','Continue editing')} <span aria-hidden="true">→</span></a></article>
  <section class="my-build-actions" data-my-build-actions aria-labelledby="my-build-actions-title">
   <div class="my-build-actions-head"><h3 id="my-build-actions-title">${t('次にやること','Next steps')}</h3><span data-actions-count></span></div>
   <p class="my-build-help">${t('この構成で次に試すことを、3件まで。','Keep up to three things to try with this configuration.')}</p>
   <ul class="my-build-tasks" data-actions-list></ul><p class="my-build-help" data-actions-empty>${t('小さな目標をひとつ、残しておきましょう。','Leave yourself one small next step.')}</p>
   <form class="my-build-action-form" novalidate>
    <label for="my-build-action-input" data-actions-label>${t('やることを追加','Add a next step')}</label>
    <div class="my-build-action-entry"><input id="my-build-action-input" data-actions-input type="text" maxlength="80" autocomplete="off" placeholder="${t('例：火耐性を75%にする','e.g. Reach 75% fire resistance')}" aria-describedby="my-build-action-help my-build-action-status"><button type="submit" data-actions-submit>${t('追加','Add')}</button></div>
    <button type="button" class="my-build-action-cancel" data-actions-cancel hidden>${t('編集をやめる','Cancel edit')}</button>
   </form>
   <p class="my-build-help" data-actions-limit hidden>${t('3件まで保存できます。項目を削除するか、完了した項目を片付けると追加できます。','Your three slots are full. Remove an item or clear completed items to add another.')}</p>
   <div class="my-build-action-tools"><button type="button" data-actions-clear hidden>${t('完了した項目を片付ける','Clear completed')}</button><button type="button" data-actions-undo hidden>${t('削除を戻す','Undo removal')}</button><button type="button" data-actions-retry hidden>${t('再読み込み','Reload list')}</button></div>
   <p id="my-build-action-status" data-actions-status class="my-build-action-status" role="status" aria-live="polite"></p>
   <p id="my-build-action-help" class="my-build-action-help">${t('このブラウザーに、構成ごとに保存します。入力は80文字まで。','Saved per configuration in this browser. Up to 80 characters per item.')}</p>
  </section>
 </div><div class="my-build-column">
  <section class="my-build-goal" aria-labelledby="my-build-goal-title"><h3 id="my-build-goal-title">${t('目標までの残り','Your target')}</h3><div data-my-build-goal></div><a class="my-build-secondary" data-my-build-goal-open>${t('目標を確認・設定','Review or set a target')}</a></section>
  ${growthMarkup(en)}
  <section class="my-build-updates" aria-labelledby="my-build-updates-title"><h3 id="my-build-updates-title">${t('この構成に関係する更新','Updates for this build')} <span data-my-build-update-count></span></h3><div data-my-build-updates aria-live="polite"></div><div class="my-build-update-actions"><button type="button" data-my-build-seen hidden>${t('表示した案内を既読にする','Mark shown updates as read')}</button><button type="button" data-my-build-retry hidden>${t('再読み込み','Retry')}</button></div></section>
 </div></div><p class="my-build-warning" data-my-build-warning role="status"></p><p class="my-build-device">${t('このブラウザーにある保存構成を表示しています。','Showing configurations saved in this browser.')}</p>${compact?'</div>':''}
 </section><script id="my-build-presets" type="application/json">${json}</script><!-- my-build-home:end -->`;
}
