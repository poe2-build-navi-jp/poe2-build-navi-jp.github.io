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
  // Track useful reading outcomes without sending link text, search queries or trade filters.
  if (link && link.closest('main') && /^(\/guides\/|\/skills\/|\/equipment\/|\/dictionary\/)/.test(pagePath)) {
    const sameSite = link.origin === window.location.origin;
    if (sameSite && /^\/builds\/[^/]+\/[^/]+\/$/.test(link.pathname)) {
      sendEvent('guide_build_click', { page_path: pagePath, destination_path: link.pathname });
    } else if (sameSite && link.pathname !== pagePath && /^\/guides\//.test(link.pathname)) {
      sendEvent('guide_next_click', { page_path: pagePath, destination_path: link.pathname });
    } else if (link.hostname === 'www.pathofexile.com' && /^\/trade2\//.test(link.pathname)) {
      sendEvent('guide_trade_click', { page_path: pagePath });
    } else if (!sameSite && /^https?:$/.test(link.protocol) && link.closest('.sources, .seo-sources, .guide-evidence, .guide-review-detail')) {
      sendEvent('guide_source_click', { page_path: pagePath, source_host: link.hostname });
    }
  }
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

// Funnel counts use bounded IDs only: never the configuration, shared fragment, notes or item text.
document.addEventListener('click',event=>{
 const a=event.target.closest('a[href]');if(!a||a.origin!==location.origin||a.pathname!=='/simulator/')return;
 const level=Number(new URL(a.href).searchParams.get('level'));
 sendEvent('simulator_entry_click',{page_path:pagePath,source_type:pagePath.startsWith('/builds/')?'build':pagePath.startsWith('/guides/')?'guide':'navigation',...(Number.isInteger(level)&&level>=1&&level<=100?{level}:{})});
});
