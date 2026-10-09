// Reversible, data-preserving progressive disclosure for the two entry pages.
// Applied by site chrome after content generators; discovery unwraps home before regeneration.
import { JSDOM } from 'jsdom';
const parse = html => new JSDOM(html);
function unwrap(document) {
  for (const details of document.querySelectorAll('details[data-mobile-summary]')) {
    details.querySelector(':scope > summary')?.remove();
    details.replaceWith(...details.childNodes);
  }
  document.querySelectorAll('[data-mobile-added]').forEach(node => node.remove());
}
// jsdom writes boolean attributes as name="". Keep the spelling inject-analytics uses for its
// preconnect and gtag tags, so the page is the same whichever of the two tools runs last.
const serialize = (dom) => dom.serialize().replaceAll(' crossorigin="">', ' crossorigin>').replaceAll('<script async="" src="https://www.googletagmanager.com', '<script async src="https://www.googletagmanager.com');
export function restoreMobileSummary(html) {
  const dom = parse(html); unwrap(dom.window.document); return serialize(dom);
}
export function applyMobileSummary(html, beginner) {
  const dom = parse(html), d = dom.window.document;
  unwrap(d);
  d.body.classList.add('summary-page');
  const disclose = (parent, nodes, title, hint = '') => {
    nodes = [...nodes].filter(Boolean); if (!nodes.length) return;
    const details = d.createElement('details'); details.dataset.mobileSummary = '';
    details.className = 'content-disclosure';
    const summary = d.createElement('summary');
    const label = d.createElement('span'); label.textContent = title; summary.append(label);
    if (hint) { const small = d.createElement('small'); small.textContent = hint; summary.append(small); }
    details.append(summary); nodes[0].before(details); details.append(...nodes);
    return details;
  };
  if (beginner) {
    const nav = d.querySelector('.site-nav');
    if (nav) disclose(nav.parentElement, [nav], 'メニュー', '攻略ガイド・ビルド一覧');
    const hero = d.querySelector('.discovery-hero');
    disclose(hero, [hero.querySelector(':scope > p:not(.section-kicker)'), hero.querySelector('.update-strip')], '選び方・対応パッチを確認');
    const featured = d.querySelector('#featured-builds');
    disclose(featured, [featured.querySelector('.discovery-grid')], 'おすすめ6ビルドを詳しく比較', 'おすすめ理由・弱点・操作・SSF・確認資料');
    // Do not force duplicate section navigation ahead of the first choice.
    const toc = d.querySelector('.discovery-page > nav');
    if (toc) { toc.classList.add('compact-page-links'); }
  } else {
    const hero = d.querySelector('.hero');
    const intro = d.createElement('p'); intro.className = 'mobile-lead'; intro.dataset.mobileAdded = '';
    intro.textContent = 'ビルドを選んで現在Lvを入力。今やることを3つ確認。';
    hero.querySelector('h1').after(intro);
    disclose(hero, [hero.querySelector('.lead'), hero.querySelector('#home-build-routes'), hero.querySelector('.journey-steps'), hero.querySelector('.status-note')], '使い方・掲載ビルド・対応パッチ');
    const actions = hero.querySelector('.hero-actions');
    intro.after(actions);
    const cta = d.querySelector('#purpose-picks');
    if (cta) cta.classList.add('compact-entry');
    const classSection = d.querySelector('#choose-class');
    disclose(classSection, [classSection?.querySelector('.class-helper'), classSection?.querySelector('#class-grid')], '8職業の特徴とビルドを見る');
    const recent = d.querySelector('#recent-changes');
    disclose(recent, [...recent.children].filter(n => n.tagName !== 'H2'), '変更内容と資料確認日を開く');
    const quality = d.querySelector('[aria-labelledby="quality-title"]');
    disclose(quality, [...quality.children].filter(n => !n.classList.contains('section-head')), '目的別の探し方を開く', 'Tier・序盤・周回・ボス・正式版情報');
    const faq = d.querySelector('#build-answers');
    for (const card of faq.querySelectorAll('.info-card')) {
      const title = card.querySelector('h3');
      disclose(card, [...card.children].filter(n => n !== title), '回答を読む');
    }
    const example = d.querySelector('#real-example');
    if (example) disclose(example, [...example.children].filter(n => !/^H[12]$/.test(n.tagName)), 'Lv37の案内例を見る');
  }
  const head = d.head;
  const css = d.createElement('link'); css.rel='stylesheet'; css.href='/assets/mobile-summary.css'; css.dataset.mobileAdded=''; head.append(css);
  const script = d.createElement('script'); script.src='/assets/mobile-summary.js'; script.defer=true; script.dataset.mobileAdded=''; head.append(script);
  return serialize(dom);
}
