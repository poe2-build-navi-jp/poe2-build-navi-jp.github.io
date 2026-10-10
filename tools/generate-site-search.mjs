// Unified discovery pages. This does not alter the existing /guides/ search.
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {resolve, dirname} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {FOOTER, ICON_BLOCK} from './site-chrome.mjs';

const defaultRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const SEARCH_TYPES = [
  ['guide', '攻略'], ['build', 'ビルド'], ['term', '用語'],
  ['skill', 'スキル'], ['equipment', '装備'], ['name', 'ボス・クエスト・NPC']
];
const NAME_TYPES = [['boss', 'ボス'], ['quest', 'クエスト'], ['npc', 'NPC']];
const esc = value => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
const json = value => JSON.stringify(value).replaceAll('<', '\\u003c').replaceAll('\u2028', '\\u2028').replaceAll('\u2029', '\\u2029');
const strings = value => Array.isArray(value) ? value.flatMap(strings) : typeof value === 'string' ? [value] : [];
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
async function readJson(root, name, optional = false) {
  try { return JSON.parse(await readFile(resolve(root, 'data', `${name}.json`), 'utf8')); }
  catch (error) { if (optional && error.code === 'ENOENT') return []; throw error; }
}
function asArray(value, key, label) {
  const result = Array.isArray(value) ? value : value?.[key];
  if (!Array.isArray(result)) throw new Error(`${label} must contain an array`);
  return result;
}
export async function verifyDestination(root, href) {
  // Only same-site generated documents: reject origins, traversal and executable URLs.
  if (!/^\/(?:[a-z0-9-]+\/)+(?:#[a-zA-Z0-9_-]+)?$/.test(href)) throw new Error(`Unsafe or unsupported index destination: ${href}`);
  const [pathname, anchor] = href.split('#');
  const html = await readFile(resolve(root, `.${pathname}`, 'index.html'), 'utf8');
  if (anchor && !new RegExp(`\\bid=["']${anchor}["']`).test(html)) throw new Error(`Missing guide anchor: ${href}`);
  return html;
}

export async function collectSearchEntries(root = defaultRoot) {
  const [site, guideData, strategyData, builds, terms, pages, intents, nameData, entityData] = await Promise.all([
    readJson(root, 'site'), readJson(root, 'guides'), readJson(root, 'strategy-guides'),
    readJson(root, 'builds'), readJson(root, 'dictionary'), readJson(root, 'seo-pages'),
    readJson(root, 'guide-search-intents', true), readJson(root, 'name-index'), readJson(root, 'core-entities', true)
  ]);
  const strategy = asArray(strategyData, 'guides', 'strategy-guides');
  const names = asArray(nameData, 'entries', 'name-index');
  const entities = asArray(entityData, 'entities', 'core-entities');
  const entries = [];
  const destinations = new Set();
  const add = entry => {
    if (!entry.title || !entry.summary) throw new Error(`Incomplete search entry: ${entry.href}`);
    const key = `${entry.type}:${entry.id || entry.href}`;
    if (destinations.has(key)) throw new Error(`Duplicate search entry: ${key}`);
    destinations.add(key);
    entries.push({...entry, aliases: [...new Set(strings(entry.aliases).filter(Boolean))]});
  };
  const guideMap = new Map();
  for (const g of [...guideData, ...strategy]) guideMap.set(`/guides/${g.slug}/`, g);
  for (const p of pages.filter(p => /^\/guides\/[^/]+\/$/.test(p.path))) {
    if (!guideMap.has(p.path)) guideMap.set(p.path, {title: p.h1 || p.title, summary: p.description, slug: p.path.split('/')[2]});
  }
  for (const [href, g] of guideMap) {
    const intent = intents.find(item => item.path === href);
    // Include section headings and named aliases, without copying all article prose.
    const relatedNames = names.filter(name => name.guideSlug === g.slug);
    add({type: 'guide', href, title: intent?.h1 || g.title, summary: intent?.description || g.summary,
      aliases: [g.slug.replaceAll('-', ' '), ...strings(g.keywords), ...strings(intent?.searchExamples),
        ...(g.sections || []).map(section => section.heading),
        ...relatedNames.flatMap(name => [name.name, name.englishName, ...strings(name.aliases)])]});
  }
  // Reuse English ascendancy names explicitly present in each build's existing source titles.
  const ascendancyNames = build => [...new Set((build.sources || []).flatMap(source =>
    (source.name || '').match(/Martial Artist|Gemling Legionnaire|Smith of Kitava|Disciple of Varashta|Spirit Walker|Stormweaver|Deadeye|Infernalist|Oracle|Lich/g) || []))];
  for (const b of builds.filter(build => build.status !== 'draft')) add({type: 'build', href: `/builds/${b.classSlug}/${b.slug}/`, title: b.name,
    summary: b.seoDescription || b.description || b.strengths?.[0],
    aliases: [b.className, b.classSlug, b.ascendancy, ...ascendancyNames(b), b.mainSkill, b.slug.replaceAll('-', ' '), ...strings(b.aliases)]});
  for (const t of terms) add({type: 'term', href: `/dictionary/${t.slug}/`, title: t.term,
    summary: t.oneLine || t.description, aliases: [t.slug.replaceAll('-', ' '), t.englishName, ...strings(t.aliases)]});
  const entityIds = new Set();
  for (const e of entities) {
    if (!['skill', 'equipment'].includes(e.kind) || !slugPattern.test(e.slug) || entityIds.has(`${e.kind}:${e.slug}`)) throw new Error(`Invalid core entity: ${e.slug}`);
    entityIds.add(`${e.kind}:${e.slug}`);
    add({type: e.kind, href: `/${e.kind === 'skill' ? 'skills' : 'equipment'}/${e.slug}/`, title: e.name,
      englishName: e.englishName, summary: e.summary, aliases: [e.englishName, ...strings(e.aliases)]});
  }
  const nameIds = new Set();
  for (const n of names) {
    if (!slugPattern.test(n.slug) || nameIds.has(n.slug) || !NAME_TYPES.some(([kind]) => kind === n.kind) || !n.englishName) throw new Error(`Invalid name index entry: ${n.slug}`);
    nameIds.add(n.slug);
    const guide = strategy.find(g => g.slug === n.guideSlug);
    const section = guide?.sections.find(s => s.id === n.sectionId);
    if (!section) throw new Error(`Name index references an unknown guide section: ${n.slug}`);
    n.href = `/guides/${n.guideSlug}/#${n.sectionId}`;
    n.guideTitle = guide.title;
    n.sectionTitle = section.heading;
    add({type: 'name', id: n.slug, href: n.href, title: n.name, englishName: n.englishName,
      summary: n.summary, context: NAME_TYPES.find(([kind]) => kind === n.kind)[1],
      aliases: [n.englishName, ...strings(n.aliases)]});
  }
  // This also checks entity pages exist once entity data is present. Run their generator first.
  for (const href of new Set(entries.map(entry => entry.href))) await verifyDestination(root, href);
  return {site, entries, names};
}

function header(currentPath) {
  const items = [['/guides/', '攻略ガイド'], ['/builds/', 'ビルド'], ['/leveling/', 'レベリング'], ['/dictionary/', '用語辞典'], ['/search/', '全体検索']];
  return `<header class="site-header"><a class="brand" href="/" aria-label="POE2ビルドナビ ホーム"><span class="brand-mark" aria-hidden="true">P2</span><span>POE2<br>ビルドナビ</span></a><nav class="site-nav page-nav" aria-label="メインメニュー">${items.map(([href, label]) => `<a href="${href}"${href === currentPath ? ' aria-current="page"' : ''}>${label}</a>`).join('')}</nav></header>`;
}
function collectionPage({site, path, title, h1, description, content, entries, script = false}) {
  const url = `${site.baseUrl}${path}`;
  const image = `${site.baseUrl}/images/poe2/og/poe2-beginner-guide-og.webp`;
  const schema = [
    {'@context': 'https://schema.org', '@type': 'CollectionPage', name: title, description, url, inLanguage: 'ja', image,
      mainEntity: {'@type': 'ItemList', numberOfItems: entries.length, itemListElement: entries.map((entry, i) => ({'@type': 'ListItem', position: i + 1, name: entry.title, url: `${site.baseUrl}${entry.href}`}))}},
    {'@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
      {'@type': 'ListItem', position: 1, name: 'ホーム', item: `${site.baseUrl}/`},
      {'@type': 'ListItem', position: 2, name: h1, item: url}
    ]}
  ];
  return `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><meta name="description" content="${esc(description)}"><meta name="robots" content="index,follow,max-image-preview:large"><link rel="canonical" href="${esc(url)}"><meta property="og:type" content="website"><meta property="og:locale" content="ja_JP"><meta property="og:site_name" content="${esc(site.siteName)}"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description)}"><meta property="og:url" content="${esc(url)}"><meta property="og:image" content="${esc(image)}"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta property="og:image:alt" content="PoE2攻略・育成ガイド"><meta name="twitter:card" content="summary_large_image"><link rel="stylesheet" href="/assets/styles.css"><link rel="stylesheet" href="/assets/mobile.css"><link rel="stylesheet" href="/assets/site-search.css">${ICON_BLOCK}${script ? '<script defer src="/assets/site-search.js"></script>' : ''}<script type="application/ld+json">${json(schema)}</script></head><body class="site-discovery"><a class="skip-link" href="#main">本文へ移動</a>${header(path)}<main id="main" class="page-main"><nav class="breadcrumbs" aria-label="パンくず"><ol><li><a href="/">ホーム</a></li><li aria-current="page">${esc(h1)}</li></ol></nav><article class="article-page discovery-article"><header class="discovery-heading"><p class="section-kicker">PATH OF EXILE 2 / FIND A GUIDE</p><h1>${esc(h1)}</h1><p class="lead">${esc(description)}</p></header>${content}<p class="discovery-note">掲載範囲は当サイトで解説している項目です。ゲーム内の全名称を網羅するものではありません。仕様・出典・確認日はリンク先で確認できます。</p></article></main>${FOOTER}</body></html>\n`;
}
function resultCard(entry) {
  const search = ['PoE2', entry.title, entry.englishName, entry.summary, entry.context, ...entry.aliases].filter(Boolean).join(' ');
  return `<li class="search-result" data-search-entry data-search-type="${entry.type}" data-search-text="${esc(search)}"><a href="${esc(entry.href)}"><strong>${esc(entry.title)}</strong>${entry.englishName && entry.englishName !== entry.title ? `<span class="search-english" lang="en">${esc(entry.englishName)}</span>` : ''}<span class="search-summary">${esc(entry.summary)}</span>${entry.context ? `<span class="search-context">${esc(entry.context)}の該当箇所へ →</span>` : ''}</a></li>`;
}
export function renderSearchPage({site, entries}) {
  const categories = SEARCH_TYPES.map(([type, label]) => ({type, label, items: entries.filter(entry => entry.type === type)}));
  const content = `<section aria-label="サイト内の検索" data-site-search><form class="site-search-controls" data-search-form role="search" action="/search/" method="get" hidden><label for="site-search-input">日本語・英語の名前や困りごと</label><div class="site-search-row"><input id="site-search-input" data-search-input name="q" type="search" placeholder="例：ジオノール、Whirling Assault" autocomplete="off" aria-controls="site-search-results" aria-describedby="site-search-help"><button type="submit">検索</button><button type="button" data-search-reset>リセット</button></div><p id="site-search-help" class="search-help">英語の大文字・小文字、全角文字やスペースの違いにも対応。</p><div class="site-search-types" role="group" aria-label="検索する種類"><button type="button" data-search-filter="all" aria-pressed="true">すべて</button>${SEARCH_TYPES.map(([type, label]) => `<button type="button" data-search-filter="${type}" aria-pressed="false">${label}</button>`).join('')}</div><p class="search-status" data-search-status role="status" aria-live="polite" aria-atomic="true">${entries.length}件を表示</p></form><nav class="discovery-shortcuts" aria-label="名前や種類から探す"><a href="/name-index/">ボス・クエスト・NPC索引</a><a href="/skills/">スキル一覧</a><a href="/equipment/">装備一覧</a></nav><noscript><p>JavaScriptが無効のため検索欄は表示していません。下の種類別一覧からすべての掲載項目を読めます。</p></noscript><nav class="search-jump-links" aria-label="種類別一覧へ">${categories.filter(category => category.items.length).map(category => `<a href="#search-${category.type}">${category.label}</a>`).join('')}</nav><div id="site-search-results">${categories.map(category => `<section class="search-group" id="search-${category.type}" data-search-group="${category.type}" aria-labelledby="search-${category.type}-title"><h2 id="search-${category.type}-title">${category.label}<span class="search-group-count" data-search-group-count>${category.items.length}件</span></h2>${category.items.length ? `<ul class="search-results-list">${category.items.map(resultCard).join('')}</ul>` : '<p class="search-category-pending">この種類の個別ページはまだありません。</p>'}</section>`).join('')}</div><div class="search-empty" data-search-empty hidden><h2>一致する項目がありません</h2><p>短い名前や英語名でも試すか、種類の絞り込みを解除してください。</p><button type="button" data-search-reset>すべてに戻す</button></div></section>`;
  return collectionPage({site, path: '/search/', title: 'PoE2サイト内検索｜攻略・ビルド・用語・スキル・装備', h1: 'PoE2サイト内検索', description: '攻略・ビルド・用語・スキル・装備をまとめて検索。日本語名・英語名やボスの名前から、必要な説明へ進めます。', content, entries, script: true});
}
export function renderNameIndex({site, names}) {
  const content = `<nav class="discovery-shortcuts" aria-label="関連する一覧"><a href="/search/">全体検索で探す</a><a href="/guides/">攻略ガイド</a><a href="/skills/">スキル一覧</a><a href="/equipment/">装備一覧</a></nav><p class="discovery-note">名前を選ぶと、攻略記事の該当箇所へ直接移動します。日本語・英語の表記と検索用の略称を併記しています。</p><nav class="search-jump-links" aria-label="名称の種類">${NAME_TYPES.map(([kind, label]) => `<a href="#names-${kind}">${label}（${names.filter(name => name.kind === kind).length}）</a>`).join('')}</nav>${NAME_TYPES.map(([kind, label]) => `<section class="name-group" id="names-${kind}" aria-labelledby="names-${kind}-title"><h2 id="names-${kind}-title">${label}</h2><ul class="name-index-list">${names.filter(name => name.kind === kind).map(name => `<li id="name-${name.slug}"><a class="name-index-link" href="${esc(name.href)}"><strong>${esc(name.name)}</strong><span lang="en">${esc(name.englishName)}</span></a>${name.aliases.length ? `<p class="name-aliases">別名・検索表記：${esc(name.aliases.join(' / '))}</p>` : ''}<p>${esc(name.summary)}</p><p class="name-destination">掲載先：${esc(name.guideTitle)}<br>${esc(name.sectionTitle)}</p></li>`).join('')}</ul></section>`).join('')}`;
  return collectionPage({site, path: '/name-index/', title: 'PoE2ボス・クエスト・NPC名称索引｜日本語・英語名で探す', h1: 'ボス・クエスト・NPC名称索引', description: '知っている名前から攻略へ。日本語名・英語名・略称を照合し、ボス対策やクエストの進行、NPCへの報告先を確認できます。', content, entries: names.map(name => ({title: `${name.name} / ${name.englishName}`, href: name.href}))});
}
export async function generateSiteSearch({root = defaultRoot, outputRoot = root} = {}) {
  const data = await collectSearchEntries(root);
  const output = {'search/index.html': renderSearchPage(data), 'name-index/index.html': renderNameIndex(data)};
  for (const [file, html] of Object.entries(output)) {
    await mkdir(dirname(resolve(outputRoot, file)), {recursive: true});
    await writeFile(resolve(outputRoot, file), html);
  }
  return {...data, output};
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const {entries, names} = await generateSiteSearch();
  console.log(`Generated /search/ (${entries.length} entries) and /name-index/ (${names.length} names); all destinations verified.`);
}
