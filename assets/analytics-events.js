const sendEvent = (name, parameters = {}) => {
  if (typeof window.gtag !== "function") return;
  window.gtag("event", name, parameters);
};

const pagePath = window.location.pathname;
const buildClickEvent = pagePath.startsWith("/best-builds/")
  ? "best_build_click"
  : pagePath.startsWith("/tier-list/")
    ? "tier_build_click"
    : pagePath.startsWith("/league-starter/")
      ? "league_build_click"
      : pagePath.startsWith("/poe2-1-0/")
        ? "poe2_1_0_build_click"
        : "";

document.addEventListener("click", (event) => {
  const link = event.target.closest("a[href]");
  if (link && buildClickEvent && /^\/builds\/[^/]+\/[^/]+\//.test(link.pathname)) {
    sendEvent(buildClickEvent, { link_url: link.href, link_text: link.textContent.trim().slice(0, 100) });
  }

  const control = event.target.closest("#level-minus, #level-plus, .leveling-stages button");
  if (control) {
    const level = control.dataset.level || document.querySelector("#level-input, #leveling-level")?.value || "";
    sendEvent("level_input", { control_id: control.id || "level_stage", level });
  }
});

document.addEventListener("change", (event) => {
  const control = event.target.closest("#level-input, #level-range, #quick-level, #leveling-level");
  if (!control) return;
  sendEvent("level_input", { control_id: control.id, level: control.value });
});

const params = new URLSearchParams(window.location.search);
const fromNote = params.get("utm_source") === "note" || document.referrer.startsWith("https://note.com/");
if (fromNote) {
  let shouldSend = true;
  try {
    shouldSend = sessionStorage.getItem("poe2-note-referral") !== "sent";
    sessionStorage.setItem("poe2-note-referral", "sent");
  } catch {}
  if (shouldSend) sendEvent("note_referral", { page_path: pagePath });
}
