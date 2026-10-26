// Optional, article-specific provenance for the legacy guide templates.
const esc=v=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
export const evidenceStyles=e=>e?'<link rel="stylesheet" href="/assets/guide-verification.css">':'';
export function evidenceBlock(e){
 if(!e)return '';
 for(const k of ['method','confirmed','unverified','version'])if(!e[k]?.trim())throw Error(`Missing guide evidence ${k}`);
 return `<section class="guide-verification" aria-labelledby="verification-title"><h2 id="verification-title">確認できたこと・未確認の範囲</h2><dl>${[['確認方法',e.method],['確認できたこと',e.confirmed],['未確認の範囲',e.unverified],['参照する版・資料',e.version]].map(([label,value])=>`<div><dt>${label}</dt><dd>${esc(value)}</dd></div>`).join('')}</dl><p><a href="#guide-evidence-sources">根拠と資料別の確認日を見る</a></p></section>`;
}
