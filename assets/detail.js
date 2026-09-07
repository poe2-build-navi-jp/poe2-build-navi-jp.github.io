const STAGES = [
  { min: 1, max: 10, label: "Lv1〜10", next: "Lv11" },
  { min: 11, max: 20, label: "Lv11〜20", next: "Lv21" },
  { min: 21, max: 30, label: "Lv21〜30", next: "Lv31" },
  { min: 31, max: 40, label: "Lv31〜40", next: "Lv41" },
  { min: 41, max: 65, label: "Lv41〜キャンペーン終了", next: "Mapping開始" },
  { min: 66, max: 75, label: "Mapping開始", next: "Early Endgame" },
  { min: 76, max: 90, label: "Early Endgame", next: "Endgame完成" },
  { min: 91, max: 100, label: "Endgame完成", next: "完成後の更新" }
];

const byId = (id) => document.getElementById(id);
const text = (value) => value === null || value === undefined || value === "" ? "確認中" : String(value);
const stageIndexFor = (level) => Math.max(0, STAGES.findIndex((stage) => level >= stage.min && level <= stage.max));
let build;
let level = 1;

function pathInfo() {
  const parts = location.pathname.split("/").filter(Boolean);
  const buildsIndex = parts.indexOf("builds");
  return { classSlug: parts[buildsIndex + 1], slug: parts[buildsIndex + 2] };
}

function fact(label, value) {
  const wrapper = document.createElement("div");
  wrapper.className = "fact";
  const small = document.createElement("small");
  const bold = document.createElement("b");
  small.textContent = label;
  bold.textContent = value === null ? "確認中" : value;
  wrapper.append(small, bold);
  return wrapper;
}

function pendingItem(label) {
  const item = document.createElement("div");
  item.className = "stage-item";
  const small = document.createElement("small");
  const badge = document.createElement("span");
  const paragraph = document.createElement("p");
  small.textContent = label;
  badge.className = "pending";
  badge.textContent = "確認中";
  paragraph.textContent = "検証できた情報を順次登録します。未確認の内容は掲載しません。";
  item.append(small, badge, paragraph);
  return item;
}

function renderStage(index, scroll = false) {
  const stage = STAGES[index];
  document.querySelectorAll(".stage-button").forEach((button, buttonIndex) => {
    if (buttonIndex === index) button.setAttribute("aria-current", "step");
    else button.removeAttribute("aria-current");
  });
  byId("stage-heading").textContent = stage.label;
  byId("stage-next").textContent = `次の目標：${stage.next}`;
  const grid = byId("stage-grid");
  grid.replaceChildren();
  ["今使うメインスキル", "サポートジェム", "次に取るパッシブ", "装備で優先する能力", "交換すべき装備", "注意点・移行条件"].forEach((label) => grid.append(pendingItem(label)));
  if (scroll) byId("roadmap").scrollIntoView({ behavior: "smooth", block: "start" });
}

function renderNow(index) {
  const stage = STAGES[index];
  byId("now-stage").textContent = stage.label;
  byId("now-next").textContent = `次の目標：${stage.next}`;
  const actions = [
    "現在レベルと育成段階が合っているか確認する",
    "確認済みのスキル・パッシブ情報が登録されるまで『確認中』を目印にする",
    "装備更新前に必要レベルと、このビルドの対応パッチを確認する"
  ];
  document.querySelectorAll("[data-now-action]").forEach((element, actionIndex) => { element.textContent = actions[actionIndex]; });
}

function setLevel(value) {
  level = Math.max(1, Math.min(100, Number(value) || 1));
  byId("level-input").value = level;
  byId("level-range").value = level;
  byId("level-output").value = `Lv${level}`;
  localStorage.setItem(`poe2:navi:level:${build.id}`, String(level));
  const index = stageIndexFor(level);
  renderNow(index);
  renderStage(index);
}

function fillList(id, values, emptyText) {
  const list = byId(id);
  list.replaceChildren();
  (values.length ? values : [emptyText]).forEach((value) => {
    const item = document.createElement("li");
    item.textContent = value;
    list.append(item);
  });
}

function renderBuild(builds) {
  document.title = `${build.name}｜Lv1からの育成ロードマップ｜POE2ビルドナビ`;
  byId("build-name").textContent = build.name;
  byId("build-class").textContent = `${build.className} / ${text(build.ascendancy)}`;
  byId("build-skill").textContent = `メインスキル：${text(build.mainSkill)}`;
  byId("breadcrumb-name").textContent = build.name;
  const facts = byId("fact-grid");
  facts.replaceChildren();
  [
    ["対応パッチ", build.version], ["最終確認日", build.updatedAt], ["初心者", build.beginnerRating === null ? null : `${build.beginnerRating}/5`],
    ["予算", build.budget], ["操作難易度", build.difficulty], ["火力", build.damageRating === null ? null : `${build.damageRating}/5`],
    ["耐久", build.defenseRating === null ? null : `${build.defenseRating}/5`], ["周回", build.mappingRating === null ? null : `${build.mappingRating}/5`],
    ["ボス", build.bossRating === null ? null : `${build.bossRating}/5`]
  ].forEach(([label, value]) => facts.append(fact(label, value)));
  fillList("strength-list", build.strengths, "確認中：検証後に、このビルドをおすすめできる人を掲載します。");
  fillList("weakness-list", build.weaknesses, "確認中：強みだけでなく、弱点も検証して掲載します。");

  const nav = byId("stage-nav");
  nav.replaceChildren();
  STAGES.forEach((stage, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "stage-button";
    button.textContent = stage.label;
    button.addEventListener("click", () => renderStage(index, true));
    nav.append(button);
  });

  const related = byId("related-links");
  builds.filter((item) => item.className === build.className && item.id !== build.id).slice(0, 3).forEach((item) => {
    const link = document.createElement("a");
    link.href = `/builds/${item.classSlug}/${item.slug}/`;
    link.textContent = item.name;
    related.append(link);
  });
  if (!related.childElementCount) {
    const link = document.createElement("a");
    link.href = "/#builds";
    link.textContent = "ビルド一覧へ戻る";
    related.append(link);
  }

  const urlLevel = Number(new URLSearchParams(location.search).get("level"));
  const savedLevel = Number(localStorage.getItem(`poe2:navi:level:${build.id}`));
  setLevel(urlLevel || savedLevel || 1);
}

function bindEvents() {
  byId("level-input").addEventListener("input", (event) => setLevel(event.target.value));
  byId("level-range").addEventListener("input", (event) => setLevel(event.target.value));
  byId("level-minus").addEventListener("click", () => setLevel(level - 1));
  byId("level-plus").addEventListener("click", () => setLevel(level + 1));
  byId("menu-button").addEventListener("click", () => {
    const nav = byId("site-nav");
    const open = nav.classList.toggle("open");
    byId("menu-button").setAttribute("aria-expanded", String(open));
  });
}

async function init() {
  try {
    const response = await fetch("/data/builds.json");
    if (!response.ok) throw new Error("ビルドデータを読み込めませんでした");
    const builds = await response.json();
    const info = pathInfo();
    build = builds.find((item) => item.classSlug === info.classSlug && item.slug === info.slug);
    if (!build) {
      location.replace("/404.html");
      return;
    }
    renderBuild(builds);
    bindEvents();
  } catch (error) {
    byId("build-name").textContent = "データを読み込めませんでした";
    console.error(error);
  }
}

init();
