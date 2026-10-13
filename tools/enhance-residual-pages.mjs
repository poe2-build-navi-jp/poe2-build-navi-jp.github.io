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

// The fixed example is a separate disclosure, never part of the selected diagnosis.
const gearFile = resolve(root, "gear-check/index.html");
let gearHtml = await readFile(gearFile, "utf8");
const gearExample = `<section class="section compact-section gear-example" aria-labelledby="gear-example-label"><h2 id="gear-example-label">サンプル（選択したビルドの結果ではありません）</h2><p>別のビルド・Lvを使った固定の表示例です。開いても現在の選択は変わりません。</p><details id="gear-example-details"><summary>表示例を見る</summary><div class="gear-example-body"><div class="section-head"><p class="section-kicker">確認済みデータの表示例</p><h3 id="gear-example-title">アイスショット・デッドアイ / Lv37 / 火力が出ない</h3><p>実際のLv31〜40ロードマップを使った診断例です。固定相場や未確認の数値は使いません。</p></div><ol class="gear-action-list"><li><b>最優先</b><div><strong>弓と矢筒</strong><p>切替後に通常敵を処理できない場合は、サポートより先に弓と矢筒を比較します。確認する能力は、冷気または物理の追加アタックダメージ、弓DPS、矢筒、ライフ、耐性です。</p></div></li><li><b>次</b><div><strong>アイスショットとスナイプ</strong><p>周回用のアイスショットと単体用のスナイプを使い分けられているか確認します。</p></div></li><li><b>その次</b><div><strong>切替条件</strong><p>Lv31直後はSpiritジェム条件を確認し、揃わない場合は切替を数レベル遅らせます。</p></div></li></ol><a class="button" href="/gear-check/?build=ranger-ice-shot-deadeye&amp;level=37&amp;concern=damage">サンプルの条件で新しく診断する（現在の選択が変わります）</a></div></details></section>`;
const gearExamplePattern = /<section class="section compact-section gear-example"[^>]*>[\s\S]*?<\/section>/;
gearHtml = gearExamplePattern.test(gearHtml) ? gearHtml.replace(gearExamplePattern, gearExample) : gearHtml.replace("</main>", gearExample + "</main>");
gearHtml = gearHtml
  .replace(/<label class="field">3\. 現在Lv[\s\S]*?<\/label>/, '<label class="field">3. 現在Lv<input id="gear-level" type="number" inputmode="numeric" enterkeyhint="done" min="1" max="100" step="1" value="1" aria-describedby="gear-level-help"><small id="gear-level-help" class="gear-level-help">数字を直接入力できます（1〜100）。Enterまたは欄外をタップして確定します。</small></label>')
  .replace(/<section class="diagnosis-result"[^>]*>/, '<section class="diagnosis-result" aria-live="polite" aria-labelledby="gear-result-label gear-result-title">')
  .replace(/(<section class="diagnosis-result"[^>]*>)<p[^>]*>[^<]*<\/p>/, '$1<p id="gear-result-label" class="section-kicker">あなたの診断結果</p>')
  .replace(/<link rel="stylesheet" href="\/assets\/gear-check\.css[^"]*">/g, "")
  .replace(/(<link rel="stylesheet" href="\/assets\/styles\.css[^"]*">)/, '$1<link rel="stylesheet" href="/assets/gear-check.css">');
await writeFile(gearFile, gearHtml);

await updateOnce(
  "poe2-1-0/index.html",
  'id="one-build-impact"',
  '<section><h2>正式版前にできること</h2>',
  `<section id="one-build-impact"><h2>現在のビルドへの影響</h2><p>現在の掲載ビルドは0.5.5向けです。1.0向けに再確認済みのビルドはまだありません。公式パッチノートと段階別資料を確認するまで、0.5.5の手順を1.0対応とは表示しません。</p></section>`
);

console.log("Enhanced gear example and 1.0 update hub.");
