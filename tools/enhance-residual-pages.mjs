import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const updateOnce = async (path, marker, before, addition) => {
  const file = resolve(root, path);
  let html = await readFile(file, "utf8");
  if (!html.includes(marker)) {
    html = html.replace(before, `${addition}${before}`);
    await writeFile(file, html);
  }
};

await updateOnce(
  "gear-check/index.html",
  'id="gear-example-title"',
  "</main>",
  `<section class="section compact-section gear-example" aria-labelledby="gear-example-title"><div class="section-head"><p class="section-kicker">確認済みデータの表示例</p><h2 id="gear-example-title">アイスショット・デッドアイ / Lv37 / 火力が出ない</h2><p>実際のLv31〜40ロードマップを使った診断例です。固定相場や未確認の数値は使いません。</p></div><ol class="gear-action-list"><li><b>最優先</b><div><strong>弓と矢筒</strong><p>切替後に通常敵を処理できない場合は、サポートより先に弓と矢筒を比較します。確認する能力は、冷気または物理の追加アタックダメージ、弓DPS、矢筒、ライフ、耐性です。</p></div></li><li><b>次</b><div><strong>アイスショットとスナイプ</strong><p>周回用のアイスショットと単体用のスナイプを使い分けられているか確認します。</p></div></li><li><b>その次</b><div><strong>切替条件</strong><p>Lv31直後はSpiritジェム条件を確認し、揃わない場合は切替を数レベル遅らせます。</p></div></li></ol><a class="button" href="/gear-check/?build=ranger-ice-shot-deadeye&amp;level=37&amp;concern=damage">この条件で診断する</a></section>`
);

await updateOnce(
  "poe2-1-0/index.html",
  'id="one-build-impact"',
  '<section><h2>正式版前にできること</h2>',
  `<section id="one-build-impact"><h2>現在のビルドへの影響</h2><p>掲載中の10ビルドは0.5.5向けです。1.0向けに再確認済みのビルドはまだありません。公式パッチノートと段階別資料を確認するまで、0.5.5の手順を1.0対応とは表示しません。</p></section><section><h2>更新履歴</h2><ul><li>2026-09-13：0.5.5ビルドとの区別と再確認状況を追記</li><li>2026-09-12：公開予定日とDuelistの公式確認ページを追加</li></ul></section>`
);

console.log("Enhanced gear example and 1.0 update hub.");
