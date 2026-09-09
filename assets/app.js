const STAGES = [
  { min: 1, max: 10, label: "Lv1〜10" }, { min: 11, max: 20, label: "Lv11〜20" },
  { min: 21, max: 30, label: "Lv21〜30" }, { min: 31, max: 40, label: "Lv31〜40" },
  { min: 41, max: 65, label: "Lv41〜キャンペーン終了" }, { min: 66, max: 75, label: "Mapping開始" },
  { min: 76, max: 90, label: "Early Endgame" }, { min: 91, max: 100, label: "Endgame完成" }
];
const state = { classes: [], builds: [], selectedClass: "", selectedBuild: "", level: 1, selectedStyle: "" };
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

function renderClassCards() {
  const grid = byId("class-grid");
  const existing = [...grid.querySelectorAll('[data-class-slug]')];
  if (existing.length) {
    let count=0;
    existing.forEach(card=>{const data=state.classes.find(c=>c.slug===card.dataset.classSlug);card.hidden=Boolean(state.selectedStyle&&!data?.combatStyle.includes(state.selectedStyle));if(!card.hidden)count++;});
    byId('style-result').textContent=`${count}職業から選べます。`;
    return;
  }
  grid.replaceChildren();
  const matches = state.classes.filter((item) => !state.selectedStyle || item.combatStyle.includes(state.selectedStyle));
  matches.forEach((classData) => {
    const classBuilds = state.builds.filter((build) => build.classSlug === classData.slug);
    const card = document.createElement("article");
    card.className = "class-card";
    card.innerHTML = `<div class="class-card-head"><span class="class-initial" aria-hidden="true"></span><div><h3></h3><p class="class-tagline"></p></div></div><div class="class-tags"></div><p class="class-description"></p><ul class="class-points"></ul><p class="class-build-count"></p><a class="button" href="/classes/${classData.slug}/">この職業のビルドを見る</a>`;
    card.querySelector(".class-initial").textContent = classData.name.slice(0, 1);
    card.querySelector("h3").textContent = classData.name;
    card.querySelector(".class-tagline").textContent = classData.tagline;
    card.querySelector(".class-description").textContent = classData.description;
    classData.combatStyle.forEach((style) => {
      const tag = document.createElement("span");
      tag.textContent = style;
      card.querySelector(".class-tags").append(tag);
    });
    classData.beginnerPoints.slice(0, 2).forEach((point) => {
      const item = document.createElement("li");
      item.textContent = point;
      card.querySelector(".class-points").append(item);
    });
    card.querySelector(".class-build-count").textContent = `掲載中：${classBuilds.length}ビルド`;
    grid.append(card);
  });
  byId("style-result").textContent = state.selectedStyle ? `${state.selectedStyle}に該当する${matches.length}職業を表示しています。` : `${matches.length}職業から選べます。`;
  const helper = document.querySelector(".class-helper");
  if (helper && !helper.querySelector("[data-full-class-check]")) {
    const link = document.createElement("a");
    link.className = "button";
    link.href = "/class-check/";
    link.dataset.fullClassCheck = "";
    link.textContent = "4問の職業診断を始める";
    helper.append(link);
  }
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
  document.querySelectorAll("[data-style]").forEach((button) => button.addEventListener("click", () => {
    state.selectedStyle = button.dataset.style;
    document.querySelectorAll("[data-style]").forEach((item) => item.setAttribute("aria-pressed", String(item === button)));
    renderClassCards();
  }));
}

async function init() {
  try {
    const [classResponse, buildResponse, siteResponse] = await Promise.all([fetch("/data/classes.json"), fetch("/data/builds.json"), fetch("/data/site.json")]);
    if (!classResponse.ok || !buildResponse.ok || !siteResponse.ok) throw new Error("data fetch failed");
    const site = await siteResponse.json();
    state.classes = await classResponse.json();
    state.builds = await buildResponse.json();
    byId("site-version").textContent = site.siteVersion;
    byId("last-updated").textContent = site.lastUpdated;
    state.classes.forEach((item) => byId("quick-class").append(new Option(item.name, item.name)));
    state.selectedBuild = localStorage.getItem("poe2:navi:selected-build") || "";
    const restoredBuild = state.builds.find((build) => build.id === state.selectedBuild);
    state.selectedClass = localStorage.getItem("poe2:navi:selected-class") || restoredBuild?.className || "";
    state.level = Math.max(1, Math.min(100, Number(localStorage.getItem("poe2:navi:quick-level")) || 1));
    byId("quick-class").value = state.selectedClass;
    populateQuickBuilds();
    setLevel(state.level);
    renderClassCards();
    if (restoredBuild) {
      const checks=JSON.parse(localStorage.getItem(`poe2:navi:stages:${restoredBuild.id}`)||'{}');
      const count=Object.values(checks).filter(Boolean).length;
      byId('resume-copy').textContent=`${restoredBuild.className}「${restoredBuild.name}」Lv${state.level}・育成ロードマップ進捗 ${Math.round(count/8*100)}%`;
      byId('quick-link').textContent=`Lv${state.level}から再開`;
      const shortcut=document.createElement('a');shortcut.className='button';shortcut.href='#quick-start';shortcut.textContent=`Lv${state.level}から続ける`;document.querySelector('.hero-guide').prepend(shortcut);
    }
    bindEvents();
  } catch (error) {
    byId("class-grid").innerHTML = '<p class="empty">表示できませんでした。再読み込みしてください。</p>';
    console.error(error);
  }
}
init();
