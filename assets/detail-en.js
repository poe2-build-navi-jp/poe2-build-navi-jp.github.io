// English variant of assets/detail.js for /en/builds/ pages. Same behavior and
// localStorage keys as the Japanese runtime; UI copy is English and the per-build
// data comes from data/builds-en/<class>/<slug>.json (English build objects).
const STAGES = [
  { min: 1, max: 10, label: "Lv1–10", next: "Lv11" },
  { min: 11, max: 20, label: "Lv11–20", next: "Lv21" },
  { min: 21, max: 30, label: "Lv21–30", next: "Lv31" },
  { min: 31, max: 40, label: "Lv31–40", next: "Lv41" },
  { min: 41, max: 65, label: "Lv41–Campaign End", next: "Start Mapping" },
  { min: 66, max: 75, label: "Mapping Start", next: "Early Endgame" },
  { min: 76, max: 90, label: "Early Endgame", next: "Endgame Complete" },
  { min: 91, max: 100, label: "Endgame Complete", next: "Post-completion updates" }
];

const byId = (id) => document.getElementById(id);
const text = (value) => value === null || value === undefined || value === "" ? "Under review" : String(value);
const stageIndexFor = (level) => Math.max(0, STAGES.findIndex((stage) => level >= stage.min && level <= stage.max));
// Resolve which of the build's own leveling stages applies at the current level.
// Same rules as the Japanese runtime: an exact band-label match first, then a
// level range written in the label (e.g. "Lv1–13"), then the band position
// clamped to the build's own stage count.
function resolveBuildStageIndex(index) {
  const stages = build?.levelingStages || [];
  if (!stages.length) return -1;
  const exact = stages.findIndex((item) => item.label === STAGES[index].label);
  if (exact >= 0) return exact;
  const byRange = stages.findIndex((item) => {
    const range = /Lv\s*(\d+)\s*[〜~～\-–]\s*(\d+)/.exec(item.label || "");
    return range && level >= Number(range[1]) && level <= Number(range[2]);
  });
  return byRange >= 0 ? byRange : Math.min(index, stages.length - 1);
}
let build;
let level = 1;
let selectedTrouble = null;
const PROGRESS_ITEMS = [
  ["skill", "Prepared the current stage's main skill"],
  ["support", "Checked the recommended supports"],
  ["passive", "Checked the current stage's passive route"],
  ["weapon", "Reviewed the weapon and main gear"],
  ["armor", "Reviewed armor and movement speed"],
  ["resistance", "Checked elemental resistances"],
  ["mechanic", "Tried the build-specific action sequence"]
];

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
  bold.textContent = value === null ? "Under review" : value;
  wrapper.append(small, bold);
  return wrapper;
}

function stageItem(label, value) {
  const item = document.createElement("div");
  item.className = "stage-item";
  const small = document.createElement("small");
  const paragraph = document.createElement("p");
  small.textContent = label;
  if (value) {
    paragraph.textContent = value;
    item.append(small, paragraph);
  } else {
    const badge = document.createElement("span");
    badge.className = "pending";
    badge.textContent = "Under review";
    paragraph.textContent = "Verified information is added as it is confirmed. Unverified details are not published.";
    item.append(small, badge, paragraph);
  }
  return item;
}

function renderStage(index, scroll = false) {
  const target = build ? resolveBuildStageIndex(index) : index;
  const details = [...document.querySelectorAll("#roadmap details[data-stage-index]")];
  details.forEach((item, itemIndex) => {
    const current = itemIndex === target;
    item.open = current;
    item.toggleAttribute("data-current", current);
    const marker = item.querySelector(".current-stage-marker");
    if (marker) marker.hidden = !current;
  });
  if (scroll) details[target]?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function renderNow(index) {
  const stage = STAGES[index];
  byId("now-stage").textContent = stage.label;
  byId("now-next").textContent = `Next goal: ${stage.next}`;
  const stagePosition = resolveBuildStageIndex(index);
  const currentStage = stagePosition >= 0 ? build.levelingStages[stagePosition] : undefined;
  const stageLink = byId("now-stage-detail");
  if (stageLink) stageLink.href = `#roadmap-stage-${stagePosition >= 0 ? stagePosition : index}`;
  const verifiedActions = currentStage?.nowActions;
  const actions = verifiedActions || [
    "Check that your current level matches the leveling stage",
    "Treat anything marked \"Under review\" as not yet confirmed",
    "Before upgrading gear, check the required level and this build's patch"
  ];
  byId("now-source-label").textContent = verifiedActions ? "Priority actions organized from the published sources" : "This stage is under review";
  const actionElements = [...document.querySelectorAll("[data-now-action]")];
  actionElements.forEach((element, actionIndex) => { element.textContent = actions[actionIndex]; });
  const guidance = byId("now-action-guidance");
  if (guidance) {
    guidance.replaceChildren();
    const detail = currentStage?.actionGuidance;
    const action = Number.isInteger(detail?.actionIndex) ? actionElements[detail.actionIndex] : null;
    guidance.hidden = !action || !verifiedActions?.[detail.actionIndex] || !detail.what || !detail.where || !detail.url;
    if (!guidance.hidden) {
      // Keep the source and its exact guide stage with the action they explain.
      // Spanning the complete row also works with the one-column mobile layout.
      action.parentElement.append(guidance);
      guidance.style.gridColumn = "1 / -1";
      guidance.style.margin = "0";
      guidance.append(document.createTextNode(`Stage / section to check: ${detail.where}. Check ${detail.what}.`));
      const link = document.createElement("a");
      link.href = detail.url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = "View the source guide section";
      guidance.append(" ", link);
    }
  }
}

function renderProgress() {
  const wrapper = byId("progress-checks");
  wrapper.replaceChildren();
  const storageKey = `poe2:navi:progress:${build.id}:${stageIndexFor(level)}`;
  // Preserve pre-migration checks on the saved character's current stage.
  const legacyKey=`poe2:navi:progress:${build.id}`;
  if(!localStorage.getItem(storageKey)&&!localStorage.getItem(`${legacyKey}:migrated`)){
    const legacy=localStorage.getItem(legacyKey);
    if(legacy){const oldLevel=Number(localStorage.getItem(`poe2:navi:level:${build.id}`))||1;localStorage.setItem(`poe2:navi:progress:${build.id}:${stageIndexFor(oldLevel)}`,legacy);localStorage.setItem(`${legacyKey}:migrated`,'true');}
  }
  const saved = JSON.parse(localStorage.getItem(storageKey) || "{}");
  PROGRESS_ITEMS.forEach(([id, label]) => {
    const row = document.createElement("label");
    row.className = "progress-check";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = Boolean(saved[id]);
    const text = document.createElement("span");
    text.textContent = label;
    input.addEventListener("change", () => {
      saved[id] = input.checked;
      localStorage.setItem(storageKey, JSON.stringify(saved));
      updateProgress(saved);
    });
    row.append(input, text);
    wrapper.append(row);
  });
  updateProgress(saved);
}

function updateProgress(saved) {
  const complete = PROGRESS_ITEMS.filter(([id]) => saved[id]).length;
  const percent = Math.round((complete / PROGRESS_ITEMS.length) * 100);
  byId("progress-percent").textContent = `${percent}%`;
  byId("progress-bar").style.width = `${percent}%`;
  const next = PROGRESS_ITEMS.find(([id]) => !saved[id]);
  byId("progress-next").textContent = next ? `Next: ${next[1]}` : "This stage's checks are complete. Move on to the next roadmap stage.";
}

// Keeps ?level= in the address bar only when it carries information: after the reader changes
// the level, or when they arrived with one. Opening a page never adds it, and Lv1 (the default)
// is dropped, so shared links and analytics stay on the clean canonical URL.
function syncLevelParam(fromUser) {
  const currentUrl = new URL(location.href);
  if (!fromUser && !currentUrl.searchParams.has("level")) return;
  if (level === 1) currentUrl.searchParams.delete("level");
  else currentUrl.searchParams.set("level", String(level));
  if (currentUrl.href !== location.href) history.replaceState(history.state, "", currentUrl);
}

function setLevel(value, fromUser = true) {
  level = Math.max(1, Math.min(100, Math.trunc(Number(value) || 1)));
  byId("level-input").value = level;
  byId("level-range").value = level;
  byId("level-output").value = `Lv${level}`;
  localStorage.setItem(`poe2:navi:level:${build.id}`, String(level));
  localStorage.setItem("poe2:navi:quick-level", String(level));
  const gearCheckLink = byId("gear-check-link");
  if (gearCheckLink) {
    gearCheckLink.href = `/gear-check/?build=${encodeURIComponent(build.id)}&level=${level}&concern=purchase`;
  }
  const uniqueGearLink = document.querySelector("[data-unique-gear-level]");
  if (uniqueGearLink) {
    const params = new URLSearchParams({ build: build.id, level: String(level) });
    uniqueGearLink.href = `/guides/unique-gear/?${params}#purchase-${build.id}`;
  }
  syncLevelParam(fromUser);
  const index = stageIndexFor(level);
  localStorage.setItem("poe2:navi:lastViewedStage", String(index));
  for (const link of document.querySelectorAll('[data-simulator-level]')) link.href = `/en/simulator/?build=${encodeURIComponent(build.id)}&level=${level}&from=guide`;
  renderNow(index);
  renderStage(index);
  renderProgress();
  localStorage.setItem('poe2:navi:last-access', new Date().toISOString());
  if (selectedTrouble) renderTrouble(selectedTrouble);
}

function renderTrouble(type) {
  selectedTrouble = type;
  const stagePosition = resolveBuildStageIndex(stageIndexFor(level));
  const stage = stagePosition >= 0 ? build.levelingStages?.[stagePosition] : undefined;
  if (!stage) return;
  const manaWeakness = (build.weaknesses || []).find((item) => /mana/i.test(item));
  const plans = {
    death: [["Top priority", stage.gearPriority], ["Next", stage.replaceGear], ["After that", stage.caution]],
    damage: [["Top priority", `Check that your main skill matches this stage: "${stage.mainSkill}"`], ["Next", stage.supports], ["After that", stage.passivePriority]],
    mana: manaWeakness ? [["Top priority", manaWeakness], ["Next", "Check that you are not spamming your main and support skills more than needed"], ["After that", stage.replaceGear]] : [["Top priority", "No build-specific mana fix is confirmed in the sources for this build"], ["Next", "Check the requirements and costs of your main skill and supports in game"], ["After that", "Compare your mana sustain before and after gear changes"]],
    boss: [["Top priority", `Check the skill used for single target: ${stage.mainSkill}`], ["Next", stage.supports], ["After that", stage.caution]],
    speed: [["Top priority", stage.mainSkill], ["Next", stage.gearPriority], ["After that", stage.transitionCondition]],
    gear: [["Top priority", stage.replaceGear], ["Next", stage.gearPriority], ["After that", "Compare current listings under the same conditions instead of relying on a fixed price"]]
  };
  document.querySelectorAll("[data-trouble]").forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.trouble === type)));
  const result = byId("trouble-result");
  result.replaceChildren();
  const list = document.createElement("ol"); list.className = "trouble-plan";
  plans[type].forEach(([rank, action]) => { const li=document.createElement("li"); const b=document.createElement("b"); const span=document.createElement("span"); b.textContent=rank; span.textContent=action; li.append(b,span); list.append(li); });
  const note=document.createElement("p"); note.className="disclaimer"; note.textContent=`Based on verified data for the "${stage.label}" stage. General items are marked as such.`;
  result.append(list,note);
  const gearLink=document.createElement('a');gearLink.className='button';gearLink.href=`/gear-check/?build=${encodeURIComponent(build.id)}&level=${level}&concern=${type==='gear'?'purchase':type}`;gearLink.textContent='Check gear with a budget (Japanese page)';result.append(gearLink);
  localStorage.setItem(`poe2:navi:trouble:${build.id}`, type);
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

function renderSources() {
  const list = byId("source-list");
  list.replaceChildren();
  if (!build.sources?.length) {
    const item = document.createElement("li");
    item.textContent = "Sources are being verified.";
    list.append(item);
    return;
  }
  build.sources.forEach((source) => {
    const item = document.createElement("li");
    const link = document.createElement("a");
    const meta = document.createElement("span");
    link.href = source.url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = source.name;
    meta.textContent = `${source.type} · Checked ${source.checkedAt}`;
    item.append(link, meta);
    list.append(item);
  });
}

// Accepts the per-build file ({build, related}, data/builds-en/<class>/<slug>.json) or the
// full builds-en array, and returns the page's build with its same-class related builds.
function pickBuild(data, info) {
  if (!data) return {};
  if (!Array.isArray(data)) return data.build?.classSlug === info.classSlug && data.build?.slug === info.slug ? data : {};
  const found = data.find((item) => item.classSlug === info.classSlug && item.slug === info.slug);
  return { build: found, related: found ? data.filter((item) => item.status !== "draft" && item.className === found.className && item.id !== found.id).slice(0, 3) : [] };
}

function renderBuild(relatedBuilds) {
  document.title = build.seoTitle || `PoE2 ${build.name} Build Guide ${build.version} | Lv1 to Endgame Leveling`;
  byId("build-name").textContent = `PoE2 ${build.name} Build | ${build.version} Leveling Guide`;
  byId("build-class").textContent = `${build.className} / ${text(build.ascendancy)}`;
  byId("build-skill").textContent = `Main skill: ${text(build.mainSkill)}`;
  byId("breadcrumb-name").textContent = build.name;
  byId("breadcrumb-class").textContent = build.className;
  byId("breadcrumb-class").href = `/classes/${build.classSlug}/`;
  localStorage.setItem("poe2:navi:selected-class", build.className);
  localStorage.setItem("poe2:navi:selected-build", build.id);
  const facts = byId("fact-grid");
  facts.replaceChildren();
  [
    ["Patch", build.version], ["Leveling sources checked", build.updatedAt], ["Status", build.status === "verified" ? "Key information verified" : build.status === "partial" ? "Gaps are shown in each stage" : "Rechecking for the current patch"], ["Leveling stages published", `${build.levelingStages?.length || 0}/8`]
  ].forEach(([label, value]) => facts.append(fact(label, value)));
  if (build.mainSkillTiming) {
    facts.append(fact("Main skill requirements", build.mainSkillTiming.available), fact("When to switch to the main skill", build.mainSkillTiming.recommendedSwitch));
  }
  renderSources();
  renderProgress();

  const related = byId("related-links");
  const addRelated = (href, label) => {
    if (related.querySelector(`a[href="${href}"]`) || related.childElementCount >= 3) return;
    const link = document.createElement("a");
    link.href = href;
    link.textContent = label;
    related.append(link);
  };
  relatedBuilds.forEach((item) => {
    addRelated(`/en/builds/${item.classSlug}/${item.slug}/`, item.name);
  });
  if (!related.childElementCount) {
    addRelated("/en/builds/", "Back to the build list");
  }
  [["/gear-check/", "Gear check for this build (Japanese)"], ["/beginner-guide/", "Beginner guide (Japanese)"], ["/dictionary/", "Glossary (Japanese)"]].forEach(([href, label]) => {
    addRelated(href, label);
  });

  const urlLevel = Number(new URLSearchParams(location.search).get("level"));
  const savedLevel = Number(localStorage.getItem(`poe2:navi:level:${build.id}`));
  setLevel(urlLevel || savedLevel || 1, false);
}

function bindEvents() {
  const savedStages=JSON.parse(localStorage.getItem(`poe2:navi:stages:${build.id}`)||'{}');
  document.querySelectorAll('#roadmap details').forEach((details,index)=>{
    const check=details.querySelector('.stage-complete input');
    if(!check)return;
    check.checked=Boolean(savedStages[index]);
    check.addEventListener('change',()=>{savedStages[index]=check.checked;localStorage.setItem(`poe2:navi:stages:${build.id}`,JSON.stringify(savedStages));});
  });
  const commitLevelInput = () => {
    const input = byId("level-input");
    const value = input.value.trim();
    const next = value !== "" && Number.isFinite(Number(value)) ? Math.max(1, Math.min(100, Math.trunc(Number(value)))) : level;
    input.value = next;
    if (next !== level) setLevel(next);
  };
  byId("level-input").addEventListener("change", commitLevelInput);
  byId("level-input").addEventListener("blur", commitLevelInput);
  byId("level-input").addEventListener("keydown", (event) => {
    if (event.key === "Enter") { event.preventDefault(); commitLevelInput(); }
  });
  byId("level-range").addEventListener("input", (event) => setLevel(event.target.value));
  byId("level-minus").addEventListener("click", () => setLevel(level - 1));
  byId("level-plus").addEventListener("click", () => setLevel(level + 1));
  document.querySelectorAll("[data-trouble]").forEach((button) => button.addEventListener("click", () => renderTrouble(button.dataset.trouble)));
  byId("menu-button").addEventListener("click", () => {
    const nav = byId("site-nav");
    const open = nav.classList.toggle("open");
    byId("menu-button").setAttribute("aria-expanded", String(open));
  });
}

function revealNoteReferral() {
  const params = new URLSearchParams(location.search);
  const fromNote = params.get("utm_source") === "note" || document.referrer.startsWith("https://note.com/");
  const guide = byId("note-referral-guide");
  if (fromNote && guide) guide.hidden = false;
}

async function init() {
  try {
    const info = pathInfo();
    // Only this build's data (~20KB); downloaded once per page.
    const data = await (window.poe2BuildsRequest ||= fetch(`/data/builds-en/${info.classSlug}/${info.slug}.json`).then((response) => {
      if (response.status === 404) return null;
      if (!response.ok) throw new Error("Could not load the build data");
      return response.json();
    }));
    const picked = pickBuild(data, info);
    build = picked.build;
    if (!build) {
      location.replace("/404.html");
      return;
    }
    renderBuild(picked.related ?? []);
    bindEvents();
    revealNoteReferral();
    const savedTrouble = localStorage.getItem(`poe2:navi:trouble:${build.id}`);
    if (savedTrouble) renderTrouble(savedTrouble);
  } catch (error) {
    byId("build-name").textContent = "Could not load the data";
    console.error(error);
  }
}

init();
