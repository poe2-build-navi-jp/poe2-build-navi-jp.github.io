const classSelect = document.querySelector("#leveling-class");
const buildSelect = document.querySelector("#leveling-build");
const levelInput = document.querySelector("#leveling-level");
const cta = document.querySelector("#leveling-cta");
const options = [...buildSelect.options];

function clampLevel(value) {
  return Math.min(100, Math.max(1, Number.parseInt(value, 10) || 1));
}

function updateLink() {
  const level = clampLevel(levelInput.value);
  levelInput.value = String(level);
  cta.href = `${buildSelect.value}?level=${level}#now`;
}

function updateBuilds() {
  const visible = options.filter((option) => option.dataset.class === classSelect.value);
  buildSelect.replaceChildren(...visible);
  updateLink();
}

classSelect.addEventListener("change", updateBuilds);
buildSelect.addEventListener("change", updateLink);
levelInput.addEventListener("input", updateLink);
document.querySelectorAll("[data-level]").forEach((button) => button.addEventListener("click", () => {
  levelInput.value = button.dataset.level;
  updateLink();
  cta.focus();
}));
updateBuilds();
