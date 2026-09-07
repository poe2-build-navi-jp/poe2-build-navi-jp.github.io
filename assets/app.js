const BUILD_DATA_URL = "/data/builds.json";
const SITE_DATA_URL = "/data/site.json";

const STAGES = [
  { min: 1, max: 10, label: "Lv1〜10" },
  { min: 11, max: 20, label: "Lv11〜20" },
  { min: 21, max: 30, label: "Lv21〜30" },
  { min: 31, max: 40, label: "Lv31〜40" },
  { min: 41, max: 65, label: "Lv41〜キャンペーン終了" },
  { min: 66, max: 75, label: "Mapping開始" },
  { min: 76, max: 90, label: "Early Endgame" },
  { min: 91, max: 100, label: "Endgame完成" }
];

const state = { builds: [], site: null, query: "", className: "", budget: "", selectedBuild: "", level: 1 };
const byId = (id) => document.getElementById(id);
const text = (value) => value === null || value === undefined || value === "" ? "確認中" : String(value);
const stageFor = (level) => STAGES.find((stage) => level >= stage.min && level <= stage.max) || STAGES[0];
const buildUrl = (build) => `/builds/${build.classSlug}/${build.slug}/`;

function setLevel(value) {
  state.level = Math.max(1, Math.min(100, Number(value) || 1));
  byId("quick-level").value = state.level;
  localStorage.setItem("poe2:navi:quick-level", String(state.level));
  updateQuickResult();
}

function updateQuickResult() {
  const build = state.builds.find((item) => item.id === state.selectedBuild);
  const stage = stageFor(state.level);
  byId("quick-stage").textContent = stage.label;
  byId("quick-summary").textContent = build
    ? `${build.name}のLv${state.level}に対応する育成段階です。攻略データは確認済みの項目だけ表示します。`
    : "ビルドを選ぶと、現在レベルに対応する育成段階へ移動できます。";
  const link = byId("quick-link");
  if (build) {
    link.href = `${buildUrl(build)}?level=${state.level}#now`;
    link.removeAttribute("aria-disabled");
  } else {
    link.href = "#builds";
    link.setAttribute("aria-disabled", "true");
  }
}

function rating(label, value) {
  const row = document.createElement("span");
  const title = document.createElement("span");
  const score = document.createElement("b");
  title.textContent = label;
  score.textContent = value === null ? "確認中" : `${value}/5`;
  row.append(title, score);
  return row;
}

function renderCards() {
  const grid = byId("build-grid");
  grid.replaceChildren();
  const query = state.query.trim().toLocaleLowerCase("ja");
  const filtered = state.builds.filter((build) => {
    const haystack = [build.name, build.className, build.ascendancy, build.mainSkill].join(" ").toLocaleLowerCase("ja");
    return (!query || haystack.includes(query)) &&
      (!state.className || build.className === state.className) &&
      (!state.budget || build.budget === state.budget);
  });

  byId("result-count").textContent = `${filtered.length}件を表示`;
  if (!filtered.length) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = "条件に合うビルドがありません。条件を減らして再検索してください。";
    grid.append(empty);
    return;
  }

  filtered.forEach((build) => {
    const card = document.createElement("article");
    card.className = "build-card";
    const top = document.createElement("div");
    top.className = "card-top";
    const version = document.createElement("span");
    version.className = "card-status";
    version.textContent = build.version;
    const favorite = document.createElement("button");
    favorite.type = "button";
    favorite.className = "favorite-button";
    favorite.disabled = true;
    favorite.title = "お気に入りはPHASE 2で実装予定";
    favorite.textContent = "☆";
    top.append(version, favorite);

    const classLine = document.createElement("div");
    classLine.className = "class";
    classLine.textContent = `${build.className} / ${text(build.ascendancy)}`;
    const heading = document.createElement("h3");
    heading.textContent = build.name;
    const skill = document.createElement("div");
    skill.className = "skill";
    skill.textContent = `メインスキル：${text(build.mainSkill)}`;

    const ratings = document.createElement("div");
    ratings.className = "compact-ratings";
    ratings.append(
      rating("初心者", build.beginnerRating),
      rating("火力", build.damageRating),
      rating("耐久", build.defenseRating),
      rating("周回", build.mappingRating),
      rating("ボス", build.bossRating)
    );

    const meta = document.createElement("div");
    meta.className = "card-meta";
    [
      `予算：${text(build.budget)}`,
      `操作：${text(build.difficulty)}`
    ].forEach((value) => {
      const chip = document.createElement("span");
      chip.className = "chip";
      chip.textContent = value;
      meta.append(chip);
    });

    const actions = document.createElement("div");
    actions.className = "card-actions";
    const link = document.createElement("a");
    link.href = buildUrl(build);
    link.textContent = "Lv1から育てる →";
    link.setAttribute("aria-label", `${build.name}をLv1から育てる`);
    actions.append(link);
    card.append(top, classLine, heading, skill, ratings, meta, actions);
    grid.append(card);
  });
}

function populateSelects() {
  const quickSelect = byId("quick-build");
  const diagnosisSelect = byId("diagnosis-build");
  const classes = [...new Set(state.builds.map((build) => build.className))].sort((a, b) => a.localeCompare(b, "ja"));
  state.builds.forEach((build) => {
    [quickSelect, diagnosisSelect].forEach((select) => {
      const option = document.createElement("option");
      option.value = build.id;
      option.textContent = build.name;
      select.append(option);
    });
  });
  classes.forEach((className) => {
    const option = document.createElement("option");
    option.value = className;
    option.textContent = className;
    byId("class-filter").append(option);
  });
}

function diagnosisActions(concern) {
  const common = {
    death: ["装備画面で属性耐性と防御値を確認する", "現在レベルに近い防具へ更新できる部位を探す", "危険な攻撃を避ける移動手段を確認する"],
    damage: ["メインスキルと対応サポートの接続状態を確認する", "武器が現在レベルに対して古くないか確認する", "ビルド固有の火力源はデータ確認後に案内予定"],
    mana: ["スキルの消費量と回復手段を確認する", "不要な常時効果でリソースを圧迫していないか確認する", "ビルド固有の解決策はデータ確認後に案内予定"],
    boss: ["ボス戦で維持できる火力手段を確認する", "回避を優先し、攻撃できる時間を見極める", "ビルド固有の対策はデータ確認後に案内予定"],
    speed: ["移動速度が付く装備候補を確認する", "通常敵への攻撃回数が多すぎないか確認する", "ビルド固有の周回改善はデータ確認後に案内予定"],
    purchase: ["現在の困りごとに直結する装備部位を一つ選ぶ", "価格を固定相場と考えず公式トレードの出品を比較する", "購入前に必要レベルと装備条件を確認する"]
  };
  return common[concern] || ["困りごとを選ぶ", "現在レベルを入力する", "表示された段階の確認済み情報を見る"];
}

function renderDiagnosis() {
  const concern = document.querySelector(".concerns button[aria-pressed='true']")?.dataset.concern;
  const build = state.builds.find((item) => item.id === byId("diagnosis-build").value);
  const level = Math.max(1, Math.min(100, Number(byId("diagnosis-level").value) || 1));
  byId("diagnosis-heading").textContent = build ? `${build.name} / Lv${level}` : `Lv${level}の一般チェック`;
  const list = byId("diagnosis-actions");
  list.replaceChildren();
  diagnosisActions(concern).forEach((action, index) => {
    const item = document.createElement("li");
    const rank = document.createElement("strong");
    rank.textContent = String(index + 1);
    const detail = document.createElement("span");
    detail.textContent = action;
    item.append(rank, detail);
    list.append(item);
  });
}

function bindEvents() {
  byId("menu-button").addEventListener("click", () => {
    const nav = byId("site-nav");
    const open = nav.classList.toggle("open");
    byId("menu-button").setAttribute("aria-expanded", String(open));
  });
  byId("quick-build").addEventListener("change", (event) => {
    state.selectedBuild = event.target.value;
    localStorage.setItem("poe2:navi:selected-build", state.selectedBuild);
    updateQuickResult();
  });
  byId("quick-level").addEventListener("input", (event) => setLevel(event.target.value));
  byId("level-minus").addEventListener("click", () => setLevel(state.level - 1));
  byId("level-plus").addEventListener("click", () => setLevel(state.level + 1));
  byId("build-search").addEventListener("input", (event) => { state.query = event.target.value; renderCards(); });
  byId("class-filter").addEventListener("change", (event) => { state.className = event.target.value; renderCards(); });
  byId("budget-filter").addEventListener("change", (event) => { state.budget = event.target.value; renderCards(); });
  document.querySelectorAll(".concerns button").forEach((button) => button.addEventListener("click", () => {
    document.querySelectorAll(".concerns button").forEach((item) => item.setAttribute("aria-pressed", "false"));
    button.setAttribute("aria-pressed", "true");
    renderDiagnosis();
  }));
  byId("diagnosis-build").addEventListener("change", renderDiagnosis);
  byId("diagnosis-level").addEventListener("input", renderDiagnosis);
}

async function init() {
  try {
    const [buildResponse, siteResponse] = await Promise.all([fetch(BUILD_DATA_URL), fetch(SITE_DATA_URL)]);
    if (!buildResponse.ok || !siteResponse.ok) throw new Error("データを読み込めませんでした");
    [state.builds, state.site] = await Promise.all([buildResponse.json(), siteResponse.json()]);
    byId("site-version").textContent = state.site.siteVersion;
    byId("last-updated").textContent = state.site.lastUpdated;
    populateSelects();
    state.selectedBuild = localStorage.getItem("poe2:navi:selected-build") || "";
    state.level = Math.max(1, Math.min(100, Number(localStorage.getItem("poe2:navi:quick-level")) || 1));
    byId("quick-build").value = state.selectedBuild;
    setLevel(state.level);
    renderCards();
    renderDiagnosis();
    bindEvents();
  } catch (error) {
    byId("build-grid").innerHTML = `<p class="empty">データの読み込みに失敗しました。時間をおいて再読み込みしてください。</p>`;
    console.error(error);
  }
}

init();
