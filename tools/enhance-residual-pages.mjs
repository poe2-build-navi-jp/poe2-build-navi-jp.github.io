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

// Explanatory blocks for the hub and tool pages, built only from data the site already verifies
// (builds, classes, glossary, guide answers and the diagnosis rules in gear-check.js), so the pages
// explain themselves without JavaScript and stay in step with that data.
{
  const json = async (p) => JSON.parse(await readFile(resolve(root, p), "utf8"));
  const [builds, classes, dictRaw, intents] = await Promise.all(["data/builds.json", "data/classes.json", "data/dictionary.json", "data/guide-search-intents.json"].map(json));
  const terms = Array.isArray(dictRaw) ? dictRaw : dictRaw.terms;
  const esc = (v) => String(v ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
  const live = builds.filter((b) => b.status !== "draft");
  const buildLink = (b) => `<a href="/builds/${b.classSlug}/${b.slug}/">${esc(b.name)}</a>`;
  const put = async (path, block) => {
    const file = resolve(root, path);
    let html = (await readFile(file, "utf8")).replace(/<!-- hub-content:start -->[\s\S]*?<!-- hub-content:end -->/g, "");
    if (!html.includes("</main>")) throw Error(`Missing main: ${path}`);
    const blockHtml = `<!-- hub-content:start --><div class="hub-content">${block}</div><!-- hub-content:end -->`;
    // Before the shared 1.0 box when it is already there, so a rebuild keeps the same order.
    html = html.includes("<!-- one-link:start -->") ? html.replace("<!-- one-link:start -->", blockHtml + "<!-- one-link:start -->") : html.replace("</main>", blockHtml + "</main>");
    await writeFile(file, html);
  };

  // gear-check: the stage boundaries and per-problem checks come straight from the diagnosis script.
  const js = await readFile(resolve(root, "assets/gear-check.js"), "utf8");
  const stages = JSON.parse(js.match(/const STAGES = (\[[^;]*\]);/)[1]);
  const labels = Object.fromEntries([...js.match(/const concernLabels = \{([^}]*)\}/)[1].matchAll(/(\w+):"([^"]*)"/g)].map((m) => [m[1], m[2]]));
  const common = Object.fromEntries([...js.match(/const common = \{([\s\S]*?)\n\};/)[1].matchAll(/(\w+):\[([^\]]*)\]/g)].map((m) => [m[1], JSON.parse(`[${m[2]}]`)]));
  const concernGuide = { death: "why-i-die", damage: "increase-damage", mana: "mana-problem", boss: "cant-beat-boss", speed: "slow-mapping", purchase: "gear-upgrade" };
  for (const key of Object.keys(concernGuide)) if (!labels[key] || !common[key]) throw Error(`gear-check concern missing: ${key}`);
  await put("gear-check/index.html", `<section class="section compact-section"><h2>装備診断の仕組み</h2><p>入力した現在Lvを、掲載ビルドの育成手順と同じ${stages.length}つのレベル帯に当てはめます。そのレベル帯で原典が挙げている「更新する装備」と「確認する能力」を最優先に表示し、次に主力スキルと装備条件、最後に選んだ困りごとの確認点を並べます。</p><p>装備の相場や価格は変動が大きいため使いません。予算の選択は、手持ちで直すか購入を検討するかの目安として表示に反映するだけです。</p><div class="table-scroll"><table class="hub-table"><caption>診断で使うレベル帯</caption><thead><tr><th scope="col">レベル帯</th><th scope="col">対象Lv</th></tr></thead><tbody>${stages.map(([min, max, label]) => `<tr><th scope="row">${esc(label)}</th><td>Lv${min}〜${max}</td></tr>`).join("")}</tbody></table></div></section><section class="section compact-section"><h2>困りごと別：最初に確認すること</h2><p>ビルドを選ばなくても、困りごとごとに最初に見る場所は共通です。詳しい確認順は各ガイドで解説しています。</p>${Object.entries(concernGuide).map(([key, slug]) => { const g = intents.find((i) => i.slug === slug); return `<h3>${esc(labels[key])}</h3><p><strong>最初に見る場所：${esc(common[key][0])}</strong>（${esc(common[key][1])}。次に${esc(common[key][2])}）</p>${g ? `<p>${esc(g.answer)}</p><p><a href="${esc(g.path)}">${esc(g.h1)}</a></p>` : ""}`; }).join("")}</section>`);

  // classes: one comparison row per class with its published builds.
  const classRows = classes.map((c) => { const bs = live.filter((b) => b.classSlug === c.slug); return `<tr><th scope="row"><a href="/classes/${c.slug}/">${esc(c.name)}</a></th><td data-label="戦い方">${c.combatStyle.map(esc).join("・")}</td><td data-label="掲載ビルド">${bs.length ? bs.map((b) => `${buildLink(b)}<br><small>主力：${esc(b.mainSkill)}／操作：${esc(b.difficulty)}</small>`).join("<br>") : "準備中"}</td><td data-label="気をつける点">${esc(c.caution)}</td></tr>`; }).join("");
  await put("classes/index.html", `<section class="section"><h2>8職業と掲載ビルドの比較</h2><p>各職業の戦い方、掲載中のビルドと主力スキル、操作で気をつける点を一覧にしました。どの職業が強いかの順位ではありません。ビルドの比較方法は<a href="/rating-criteria/">比較項目と原典の確認方法</a>で説明しています。</p><div class="table-scroll"><table class="hub-table hub-stack"><thead><tr><th scope="col">職業</th><th scope="col">戦い方</th><th scope="col">掲載ビルド（主力・操作）</th><th scope="col">気をつける点</th></tr></thead><tbody>${classRows}</tbody></table></div></section><section class="section"><h2>迷ったときの決め方</h2><ol><li>まず「近接・遠距離・魔法・召喚」のうち、続けやすそうな戦い方を1つ決めます。</li><li>その戦い方の職業から、掲載ビルドの主力スキルと操作の注意を見比べます。</li><li>決めたらビルドページで現在Lvを入力し、「今やること3つ」から始めます。途中で職業を変えたくなったら、<a href="/class-check/">4問の職業診断</a>で候補を絞り直せます。</li></ol></section>`);

  // class-check: what each possible result means.
  await put("class-check/index.html", `<section class="section"><h2>診断結果に出る8職業の特徴</h2><p>診断の候補になる職業と、掲載中のビルドです。結果を見る前に、気になる職業の特徴を確認することもできます。</p>${classes.map((c) => { const bs = live.filter((b) => b.classSlug === c.slug); return `<h3><a href="/classes/${c.slug}/">${esc(c.name)}</a>：${esc(c.tagline)}</h3><p>${esc(c.description)}</p><p>戦い方：${c.combatStyle.map(esc).join("・")}。注意：${esc(c.caution)}</p>${bs.length ? `<p>掲載ビルド：${bs.map(buildLink).join("、")}</p>` : ""}`; }).join("")}</section>`);

  // dictionary: the same terms grouped by when a new player meets them, each with its next action.
  const groups = [["始める前に知っておく用語", ["build", "skill-gem", "support-gem", "passive-tree", "ascendancy"]], ["育成中によく見る用語", ["resistance", "spirit", "energy-shield", "dps"]], ["キャンペーン後・遊び方の用語", ["endgame", "mapping", "league-starter", "ssf"]]];
  const grouped = new Set(groups.flatMap(([, s]) => s));
  for (const t of terms) if (!grouped.has(t.slug)) throw Error(`Dictionary term not grouped: ${t.slug}`);
  await put("dictionary/index.html", `<section class="section"><h2>場面別に用語を探す</h2><p>PoE2を始めてから出会う順に用語を分け、それぞれ「次に何をすればよいか」をまとめました。用語名を選ぶと詳しい解説へ進みます。</p>${groups.map(([label, slugs]) => `<h3>${esc(label)}</h3><dl class="hub-terms">${slugs.map((s) => terms.find((t) => t.slug === s)).filter(Boolean).map((t) => `<div><dt><a href="/dictionary/${t.slug}/">${esc(t.term)}</a></dt><dd>${esc(t.action)}</dd></div>`).join("")}</dl>`).join("")}<p>ボス・クエスト・NPCの名前は<a href="/name-index/">名前索引</a>、スキルや装備は<a href="/skills/">スキル一覧</a>・<a href="/equipment/">装備一覧</a>で調べられます。</p></section>`);
  console.log("Hub content: gear-check, classes, class-check, dictionary.");
}
