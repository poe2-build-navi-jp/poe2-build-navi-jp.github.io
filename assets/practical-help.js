// Optional guide feedback uses the existing GA tag only; no new API or account.
(() => {
  const openStage = hash => {
    if (!/^#roadmap-stage-[0-7]$/.test(hash)) return;
    const target = document.getElementById(hash.slice(1));
    if (target?.tagName === 'DETAILS') target.open = true;
  };
  document.addEventListener('click', event => {
    const link = event.target.closest('a[href^="#roadmap-stage-"]');
    if (link) openStage(link.getAttribute('href'));
  });
  window.addEventListener('hashchange', () => openStage(location.hash));
  // Wait for detail.js to restore the level/current stage before opening an incoming anchor.
  const form = document.getElementById('build-feedback-form');
  if (!form) return;
  const stageLabel = document.getElementById('feedback-stage');
  const sourceLabel = document.getElementById('now-stage');
  let currentStage = -1;
  let restoredAnchor = false;
  const update = () => {
    const stage = document.querySelector('#roadmap details[data-current]');
    if (!stage) return;
    const nextStage = Number(stage.dataset.stageIndex);
    if (nextStage !== currentStage) {
      currentStage = nextStage;
      form.reset();
      document.getElementById('feedback-status').textContent = '';
      form.querySelector('button').disabled = false;
    }
    stageLabel.textContent = `${sourceLabel.textContent} / 掲載パッチ ${form.dataset.patch}`;
    form.hidden = false;
    if (!restoredAnchor) {
      openStage(location.hash);
      restoredAnchor = true;
    }
  };
  if (sourceLabel) new MutationObserver(update).observe(sourceLabel, {childList:true});
  update();
  form.addEventListener('submit', event => {
    event.preventDefault();
    if (form.querySelector('button').disabled) return;
    const issue = document.getElementById('feedback-issue').value;
    const outcome = document.getElementById('feedback-outcome').value;
    const status = document.getElementById('feedback-status');
    if (!['transition','supports','gear','damage','other'].includes(issue) || !['progressed','blocked'].includes(outcome) || currentStage < 0) return;
    if (typeof window.gtag !== 'function') {
      status.textContent = '現在は結果を共有できません。攻略は引き続き利用できます。';
      return;
    }
    window.gtag('event','build_feedback',{build_id:form.dataset.build,stage_index:currentStage,patch:form.dataset.patch,issue,outcome});
    status.textContent = '回答ありがとうございます。育成ガイドを改善する参考にします。';
    form.querySelector('button').disabled = true;
  });
})();
