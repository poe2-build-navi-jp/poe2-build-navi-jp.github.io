// Publication metadata is deliberately separate from source verification dates.
const esc=v=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
export const sourceDate=g=>g?.checkedAt||(g?.sources||[]).map(s=>s.checkedAt).filter(Boolean).sort().at(-1);
export function guideReview(g,site){
 const reviewed=sourceDate(g), v=g.verification;
 if(!reviewed)throw Error(`${g.slug}: source verification date missing`);
 const method=v?.method||(g.firstHand?'運営者の実機記録と、各項目の参照資料を分けて掲載。':'出典欄に記載した原典・データを参照し、確認した仕様と編集上の案内を整理。');
 const scope=v?.confirmed||g.scope||'各項目に示した参照資料の範囲。詳細は出典欄で確認してください。';
 const limits=v?.unverified||(g.firstHand?'本文に記録のない試行条件・成功率・再現性は未確認です。':'本文に実機記録の明示がない項目は、運営者による実測結果として扱いません。');
 const history=(g.revisionNotes||[]).map(n=>`<li><time datetime="${esc(n.date)}">${esc(n.date)}</time> ${esc(n.summary)}</li>`).join('');
 return `<section class="guide-verification" aria-labelledby="verification-title"><h2 id="verification-title">根拠と確認範囲</h2><dl class="guide-review-dates"><div><dt>掲載対象</dt><dd>${esc(g.version||site.siteVersion)}</dd></div><div><dt>資料の照合日</dt><dd><time datetime="${reviewed}">${reviewed}</time></dd></div>${g.updatedAt?`<div><dt>本文の編集日</dt><dd><time datetime="${esc(g.updatedAt)}">${esc(g.updatedAt)}</time></dd></div>`:''}</dl><details class="guide-review-detail"><summary>確認内容・根拠・変更履歴を開く</summary><dl>${[['確認方法',method],['確認した範囲',scope],['未確認の範囲',limits]].map(([label,value])=>`<div><dt>${label}</dt><dd>${esc(value)}</dd></div>`).join('')}</dl>${history?`<h3>この記事の変更点</h3><ul>${history}</ul>`:''}<p>本文の編集日は、仕様の再検証日ではありません。資料ごとの確認日・対象版は<a href="#sources">出典欄</a>に記載しています。</p><p><a href="/editorial-policy/">情報の確認方法</a>。確認日と変更点の表示は2026-11-03に整備しました。各資料の照合日は変更していません。</p></details></section>`;
}
