const STAGES = [
  { min: 1, max: 10, label: "Lv1〜10" }, { min: 11, max: 20, label: "Lv11〜20" },
  { min: 21, max: 30, label: "Lv21〜30" }, { min: 31, max: 40, label: "Lv31〜40" },
  { min: 41, max: 65, label: "Lv41〜キャンペーン終了" }, { min: 66, max: 75, label: "Mapping開始" },
  { min: 76, max: 90, label: "Early Endgame" }, { min: 91, max: 100, label: "Endgame完成" }
];
const state = { builds: [], selectedClass: "", selectedBuild: "", level: 1 };
const byId = (id) => document.getElementById(id);
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
  byId("quick-summary").textContent = build ? `${build.name}のLv${state.level}で優先する行動を表示します。` : "ビルドを選ぶと、対応する育成段階へ移動できます。";
  const link = byId("quick-link");
  link.href = build ? `${buildUrl(build)}?level=${state.level}#now` : "/builds/";
  build ? link.removeAttribute("aria-disabled") : link.setAttribute("aria-disabled", "true");
}

function populateQuickBuilds() {
  const select = byId("quick-build");
  const matches = state.builds.filter((build) => build.className === state.selectedClass);
  select.replaceChildren(new Option(state.selectedClass ? "ビルドを選択" : "先に職業を選択", ""));
  matches.forEach((build) => select.append(new Option(build.name, build.id)));
  if (!matches.some((build) => build.id === state.selectedBuild)) state.selectedBuild = "";
  select.value = state.selectedBuild;
  select.disabled = !state.selectedClass;
}

function renderCards() {
  const grid = byId("build-grid");
  grid.replaceChildren();
  state.builds.forEach((build, index) => {
    const card = document.createElement("article");
    card.className = "build-card";
    const stageCount = build.levelingStages?.length || 0;
    const weakness = build.weaknesses?.[0] || "詳細な弱点は情報源と照合後に追記します。";
    card.innerHTML = `<div class="card-top"><span class="card-status">${build.version}</span><span class="card-rank">${index + 1}</span></div><div class="class">${build.className} / ${build.ascendancy}</div><h3></h3><div class="skill"></div><div class="audience"><small>こんな人向け</small><strong></strong></div><div class="card-warning"><small>先に知る弱点</small><span></span></div><div class="card-meta"><span class="chip">操作：${build.difficulty}</span><span class="chip">公開済み段階：${stageCount}/8</span></div><div class="card-actions"><a href="${buildUrl(build)}">${build.dataStatus === "reviewed" ? "Lv1から育てる" : "確認済み手順を見る"} →</a></div>`;
    card.querySelector("h3").textContent = build.name;
    card.querySelector(".skill").textContent = `主力：${build.mainSkill}`;
    card.querySelector(".audience strong").textContent = build.audience || "掲載方針を確認中";
    card.querySelector(".card-warning span").textContent = weakness;
    grid.append(card);
  });
}

function bindEvents() {
  byId("menu-button").addEventListener("click", () => {
    const nav = byId("site-nav");
    const open = nav.classList.toggle("open");
    byId("menu-button").setAttribute("aria-expanded", String(open));
  });
  byId("quick-class").addEventListener("change", (event) => {
    state.selectedClass = event.target.value;
    localStorage.setItem("poe2:navi:selected-class", state.selectedClass);
    populateQuickBuilds();
    localStorage.setItem("poe2:navi:selected-build", state.selectedBuild);
    updateQuickResult();
  });
  byId("quick-build").addEventListener("change", (event) => {
    state.selectedBuild = event.target.value;
    localStorage.setItem("poe2:navi:selected-build", state.selectedBuild);
    updateQuickResult();
  });
  byId("quick-level").addEventListener("input", (event) => setLevel(event.target.value));
  byId("level-minus").addEventListener("click", () => setLevel(state.level - 1));
  byId("level-plus").addEventListener("click", () => setLevel(state.level + 1));
}

async function init() {
  try {
    const [buildResponse, siteResponse] = await Promise.all([fetch("/data/builds.json"), fetch("/data/site.json")]);
    if (!buildResponse.ok || !siteResponse.ok) throw new Error("data fetch failed");
    const site = await siteResponse.json();
    state.builds = await buildResponse.json();
    byId("site-version").textContent = site.siteVersion;
    byId("last-updated").textContent = site.lastUpdated;
    [...new Set(state.builds.map((build) => build.className))].forEach((name) => byId("quick-class").append(new Option(name, name)));
    state.selectedBuild = localStorage.getItem("poe2:navi:selected-build") || "";
    const restoredBuild = state.builds.find((build) => build.id === state.selectedBuild);
    state.selectedClass = localStorage.getItem("poe2:navi:selected-class") || restoredBuild?.className || "";
    state.level = Math.max(1, Math.min(100, Number(localStorage.getItem("poe2:navi:quick-level")) || 1));
    byId("quick-class").value = state.selectedClass;
    populateQuickBuilds();
    setLevel(state.level);
    renderCards();
    bindEvents();
  } catch (error) {
    byId("build-grid").innerHTML = '<p class="empty">表示できませんでした。再読み込みしてください。</p>';
    console.error(error);
  }
}
init();
