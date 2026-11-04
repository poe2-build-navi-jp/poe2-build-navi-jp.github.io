// Editorial purchase guidance. Patch-note review and live item testing are separate.
export function uniqueGearShopping(data, site, {esc, refs}){
 const {review, items, orders}=data;
 const trade='https://www.pathofexile.com/trade2';
 const labels=['先に整える','条件が揃ったら買う','後回し・完成後'];
 const stale=review.version!==site.gameVersion||review.sitePatch!==site.latestPatch;
 const purchaseId=id=>`purchase-${id}`;
 const jump=guide=>{
  const sections=guide.sections.filter(s=>s.buildId);
  return `<details class="unique-gear-jump"><summary>自分のビルドの装備を見る</summary><nav aria-label="ビルド別の装備購入順"><ul>${sections.map(s=>`<li><a href="#${esc(purchaseId(s.id))}">${esc(s.heading.replace('のおすすめユニーク装備',''))}</a></li>`).join('')}</ul></nav></details>`;
 };
 const note=()=>`<p class="unique-gear-review-note"><a href="${esc(review.url)}" target="_blank" rel="noopener noreferrer">${esc(review.noteVersion)} 公式ノート</a>（${esc(review.checkedAt)}照合）。${esc(review.note)}${stale?' その後のサイト対象パッチは再確認待ちです。':''}</p><p>取引では自分のリーグを選び、コピーした英語名を検索欄へ。<a href="/guides/trade/">取引の手順を見る</a>。SSFでは自力入手の候補とレア装備の代替を参照してください。自力入手欄のない装備は入手先未確認です。</p>`;
 const order=(section,guide)=>{
  const steps=orders[section.buildId];
  if(!steps||steps.length!==labels.length||steps.some(s=>!s.trim()))throw Error(`Incomplete purchase order: ${section.buildId}`);
  return `<div class="unique-gear-order" id="${esc(purchaseId(section.id))}" tabindex="-1"><h3>装備を買う順番</h3><p data-unique-level-context hidden></p><ol>${steps.map((step,i)=>`<li><strong>${labels[i]}</strong><span>${esc(step)}</span></li>`).join('')}</ol><p>Lvは目安です。育成段階・要求値・構成の条件を満たしてから比較してください。</p>${refs(section,guide)}<a href="/guides/build-gear-buying-order/#${esc(section.id)}">レア装備も含めた購入順を見る</a></div>`;
 };
 const itemNames=option=>option.name.split(/\s*＋\s*/).map(name=>name.replaceAll('’',"'"));
 const badge=option=>{
  const entries=itemNames(option).map(name=>items[name]);
  const kind=stale||entries.some(item=>item?.pending)?'pending':entries.some(item=>item?.legacy)?'legacy':'reviewed';
  const label={pending:'再確認待ち',legacy:'旧版との差あり',reviewed:'Hotfixで変更記載なし'}[kind];
  return `<p class="unique-gear-state" data-state="${kind}">${label}</p>`;
 };
 const card=(option,guide)=>{
  const names=itemNames(option);
  const parts=names.map(name=>{
   const item=items[name];
   const itemRefs=item?.source?refs({sourceRefs:[item.source]},guide):'';
   const note=[item?.pending,item?.legacy].filter(Boolean).join(' ');
   return `<li><div class="unique-gear-trade-row">${names.length>1?`<span lang="en">${esc(name)}</span>`:""}<button class="button-secondary" type="button" data-copy-gear="${esc(name)}" aria-label="${esc(name)}の英語名をコピー" hidden>英語名をコピー</button></div><input type="text" class="unique-gear-copy-fallback" value="${esc(name)}" aria-label="取引用の英語名" readonly hidden>${note?`<p>${esc(note)}</p>`:''}${item?.obtain?`<p><strong>自力入手の候補：</strong>${esc(item.obtain)}</p>`:''}${item?.guide?`<p><a href="${esc(item.guide)}">効果と個体の選び方を見る</a></p>`:""}${itemRefs}</li>`;
  });
  return `<div class="unique-gear-shopping"><p class="unique-gear-patch">掲載基準：${esc(review.version)}系（${esc(guide.checkedAt)}照合）／<a href="${esc(review.url)}" target="_blank" rel="noopener noreferrer">差分確認：${esc(review.noteVersion)}</a></p><ul>${parts.join('')}</ul><p class="unique-gear-copy-status" data-copy-gear-status role="status" hidden></p><a class="button-secondary" href="${trade}" target="_blank" rel="noopener noreferrer">公式取引で探す</a></div>`;
 };
 return {jump,note,order,badge,card,purchaseId};
}
