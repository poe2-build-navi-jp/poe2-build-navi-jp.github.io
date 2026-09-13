const byId = (id) => document.getElementById(id);
const url = (build) => `/builds/${build.classSlug}/${build.slug}/`;
let builds = [];

function render() {
  const query = byId("build-search").value.trim().toLocaleLowerCase("ja");
  const className = byId("class-filter").value;
  const filtered = builds.filter((build) => {
    const words = [build.name, build.className, build.ascendancy, build.mainSkill, build.audience].join(" ").toLocaleLowerCase("ja");
    return (!query || words.includes(query)) && (!className || build.className === className);
  });
  byId("result-count").textContent = `${filtered.length}件`;
  const grid = byId("build-list");
  grid.replaceChildren();
  filtered.forEach((build) => {
    const article = document.createElement("article");
    article.className = "catalog-card";
    article.innerHTML = `<div><span class="verified">${build.version}</span><p class="class"></p><h2></h2><p class="skill"></p></div><div class="catalog-fit"><small>こんな人向け</small><strong></strong><small>先に知る弱点</small><p></p></div><dl><div><dt>操作</dt><dd></dd></div><div><dt>予算</dt><dd></dd></div><div><dt>確認済み段階</dt><dd>${build.levelingStages?.length || 0}/8</dd></div></dl><a class="button" href="${url(build)}">${build.status === "verified" ? "Lv1から育てる" : "確認済み手順を見る"}</a>`;
    article.querySelector(".class").textContent = `${build.className} / ${build.ascendancy}`;
    article.querySelector("h2").textContent = build.name;
    article.querySelector(".skill").textContent = `主力：${build.mainSkill}`;
    article.querySelector(".catalog-fit strong").textContent = build.audience;
    article.querySelector(".catalog-fit p").textContent = build.weaknesses?.[0] || "確認できた内容だけを掲載します。";
    const dd = article.querySelectorAll("dd");
    dd[0].textContent = build.difficulty;
    dd[1].textContent = build.budget;
    grid.append(article);
  });
}

function setClass(name) {
  byId("class-filter").value = name;
  localStorage.setItem("poe2:navi:catalog-class", name);
  document.querySelectorAll("[data-class-choice]").forEach((button) => {
    const active = button.dataset.classChoice === name;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  render();
}

fetch("/data/builds.json").then((response) => response.json()).then((data) => {
  builds = data;
  const names = [...new Set(builds.map((build) => build.className))];
  const choices = byId("class-choices");
  const all = document.createElement("button");
  all.type = "button";
  all.dataset.classChoice = "";
  all.textContent = "すべて";
  all.addEventListener("click", () => setClass(""));
  choices.append(all);
  names.forEach((name) => {
    byId("class-filter").append(new Option(name, name));
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.classChoice = name;
    button.textContent = name;
    button.addEventListener("click", () => setClass(name));
    choices.append(button);
  });
  const restored = localStorage.getItem("poe2:navi:catalog-class") || "";
  setClass(names.includes(restored) ? restored : "");
}).catch(() => { byId("build-list").innerHTML = '<p class="empty">表示できませんでした。再読み込みしてください。</p>'; });
byId("build-search").addEventListener("input", render);
byId("class-filter").addEventListener("change", (event) => setClass(event.target.value));
