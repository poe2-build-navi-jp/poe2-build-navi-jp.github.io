const STAGES = [[1,10,"Lv1〜10"],[11,20,"Lv11〜20"],[21,30,"Lv21〜30"],[31,40,"Lv31〜40"],[41,65,"Lv41〜キャンペーン終了"],[66,75,"Mapping開始"],[76,90,"Early Endgame"],[91,100,"Endgame完成"]];
const byId = (id) => document.getElementById(id);
let builds = [];
const concernLabels = {death:"すぐ死ぬ",damage:"火力が低い",mana:"マナ不足",boss:"ボスが倒せない",speed:"周回が遅い",purchase:"何を買えばいいか分からない"};
const common = {
  death:["防具","属性耐性と現在レベルに合う防御値を確認","ブーツと回避手段"],
  damage:["武器","主力スキルに影響する能力と武器レベルを確認","サポート接続と操作順"],
  mana:["スキル設定","消費量と回復手段を確認","不要な常時効果とサポート"],
  boss:["操作順","単体用スキルと維持効果を確認","防御と回避時間"],
  speed:["ブーツ","移動速度と通常敵への攻撃回数を確認","主力の範囲と操作順"],
  purchase:["最も古い部位","困りごとに直結する1部位だけ比較","必要レベルと装備条件"]
};

function populateBuilds(className, selectedBuild = "") {
  const select = byId("gear-build");
  const matches = builds.filter((build) => build.className === className);
  select.replaceChildren(new Option(className ? "ビルドを選択" : "先に職業を選択", ""));
  matches.forEach((build) => select.append(new Option(build.name, build.id)));
  select.disabled = !className;
  select.value = matches.some((build) => build.id === selectedBuild) ? selectedBuild : (matches[0]?.id || "");
}

function render() {
  const build = builds.find((item) => item.id === byId("gear-build").value);
  const level = Math.max(1, Math.min(100, Number(byId("gear-level").value) || 1));
  const concern = byId("gear-concern").value;
  const budget = byId("gear-budget").value;
  const stageLabel = STAGES.find(([min,max]) => level >= min && level <= max)?.[2];
  const stage = build?.levelingStages?.find((item) => item.label === stageLabel);
  const base = common[concern];
  byId("gear-result-title").textContent = build ? `${build.name} / Lv${level}` : `Lv${level}の装備チェック`;
  byId("gear-context").textContent = `${stageLabel}・悩み：${concernLabels[concern]}・予算：${budget}`;
  const items = stage ? [
    ["最優先", stage.replaceGear || base[0], stage.gearPriority || base[1]],
    ["次", "主力スキルと装備条件", stage.caution || base[2]],
    ["その次", "次の段階へ進む条件", stage.transitionCondition]
  ] : [
    ["最優先", base[0], base[1]], ["次", base[2], "ビルド固有の数値ではなく一般確認です。"], ["その次", "公式トレードで比較", "固定相場を前提にせず、同条件の複数出品を比較してください。"]
  ];
  const list = byId("gear-actions");
  list.replaceChildren();
  items.forEach(([rank,title,reason]) => {
    const item = document.createElement("li");
    item.innerHTML = `<b></b><div><strong></strong><p></p></div>`;
    item.querySelector("b").textContent = rank;
    item.querySelector("strong").textContent = title;
    item.querySelector("p").textContent = reason;
    list.append(item);
  });
  byId("gear-data-note").textContent = stage ? "このレベル帯は掲載情報源から再構成したビルド固有案内です。" : "このレベル帯のビルド固有情報は未登録のため、一般的な確認手順を表示しています。";
  if (build) localStorage.setItem("poe2:navi:gear-build", build.id);
  localStorage.setItem("poe2:navi:gear-level", String(level));
}

fetch("/data/builds.json").then((response) => response.json()).then((data) => {
  builds = data;
  [...new Set(builds.map((build) => build.className))].forEach((name) => byId("gear-class").append(new Option(name, name)));
  const savedBuild = localStorage.getItem("poe2:navi:gear-build") || "";
  const savedClass = localStorage.getItem("poe2:navi:gear-class") || builds.find((build) => build.id === savedBuild)?.className || "";
  byId("gear-class").value = savedClass;
  populateBuilds(savedClass, savedBuild);
  byId("gear-level").value = localStorage.getItem("poe2:navi:gear-level") || 1;
  render();
});
byId("gear-class").addEventListener("change", (event) => {
  localStorage.setItem("poe2:navi:gear-class", event.target.value);
  populateBuilds(event.target.value);
  render();
});
["gear-build","gear-level","gear-concern","gear-budget"].forEach((id) => byId(id).addEventListener("input", render));
