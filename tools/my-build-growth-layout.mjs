export function growthMarkup(en=false,editor=false){
 const t=(ja,english)=>en?english:ja;
 const heading=t('成長履歴','Growth history'),count='<span data-growth-count></span>';
 const inside=`<p class="growth-help">${t('レベル・火力・耐性の変化を、記録した時点の計算値で振り返れます。','Review level, damage and resistance changes using values frozen when you recorded them.')}</p>
 ${editor?`<p class="growth-help">${t('編集画面で反映済みの計算結果を記録します。未反映の入力は含めません。','Records the applied calculation result. Unapplied input is excluded.')}</p><label class="growth-label">${t('ひとことメモ（任意）','Short note (optional)')}<input type="text" data-growth-label maxlength="40" autocomplete="off" placeholder="${t('例：指輪交換後','e.g. After replacing my ring')}"></label><button type="button" data-growth-save disabled>${t('今の状態を記録','Record current state')}</button>`:''}
 <div data-growth-view></div><div class="growth-tools"><button type="button" data-growth-undo hidden>${t('削除を戻す','Undo removal')}</button><button type="button" data-growth-retry hidden>${t('再読み込み','Reload history')}</button></div><p class="growth-status" data-growth-status role="status" aria-live="polite"></p>
 ${editor?'':`<a class="my-build-secondary" data-my-build-growth-open>${t('今の状態を記録しに行く','Open simulator to record a state')}</a>`}
 <p class="growth-help growth-device">${t('このブラウザーにビルドごと30件まで保存。名前付き構成も同じビルドの履歴に含めます。記録は実測値ではありません。','Up to 30 records per build in this browser. Named configurations share the build’s history. Values are calculated, not gameplay measurements.')}</p>`;
 return (editor?`<details id="sim-growth-panel" class="sim-workspace my-build-growth" hidden><summary>${heading} ${count}</summary>${inside}</details>`:`<section id="my-build-growth" class="my-build-growth" aria-labelledby="my-build-growth-title"><div class="growth-head"><h3 id="my-build-growth-title">${heading}</h3>${count}</div>${inside}</section>`).replace(/^[ \t]+$/gm,'');
}
