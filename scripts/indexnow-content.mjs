import { createHash } from 'node:crypto';

export const SITE = 'https://poe2-build-navi-jp.github.io';
export const REPO = 'poe2-build-navi-jp/poe2-build-navi-jp.github.io';
export const BRANCH = 'main';
export const ENDPOINT = 'https://api.indexnow.org/indexnow';
export const KEY_FILE = 'df413c30b44590313b1d1ada1bd8e8c5.txt';
export const digest = (value) =>
  createHash('sha256').update(value).digest('hex');
export function requireValue(ok, message) {
  if (!ok) throw new Error(message);
}
export function articleUrl(value) {
  const u = new URL(value);
  requireValue(
    u.origin === SITE &&
      u.href === value &&
      !u.search &&
      !u.hash &&
      !u.username &&
      !u.password &&
      /^\/(?:[a-z0-9-]+\/)*$/.test(
        u.pathname,
      ),
    `Not an allowed production page: ${value}`,
  );
  return value;
}
function decode(text) {
  return text.replace(
    /&#(x[0-9a-f]+|[0-9]+);|&(amp|lt|gt|quot|apos|nbsp);/gi,
    (all, num, name) =>
      num
        ? String.fromCodePoint(
            num[0].toLowerCase() === 'x'
              ? parseInt(num.slice(1), 16)
              : Number(num),
          )
        : { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' }[
            name.toLowerCase()
          ],
  );
}
function attrs(tag) {
  const result = {};
  for (const m of tag.matchAll(
    /([a-z][a-z0-9:_.-]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi,
  )) {
    const name = m[1].toLowerCase();
    requireValue(
      !Object.hasOwn(result, name),
      `Duplicate HTML attribute: ${name}`,
    );
    result[name] = decode(m[2] ?? m[3] ?? m[4]);
  }
  return result;
}
const plain = (s) =>
  decode(s.replace(/<[^>]*>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
const blocked = (s) => /\b(?:noindex|none)\b/i.test(s || '');

// These are our complete, generated editorial snapshots, not arbitrary web pages.
// Ignore bundles, hydration, layout attributes and common navigation when diffing.
export function inspectArticle(html, url, headers = new Headers()) {
  articleUrl(url);
  requireValue(
    !blocked(headers.get('x-robots-tag')),
    `X-Robots-Tag blocks indexing: ${url}`,
  );
  const clean = html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '');
  const heads = [...clean.matchAll(/<head\b[^>]*>([\s\S]*?)<\/head\s*>/gi)];
  const mains = [...clean.matchAll(/<main\b[^>]*>([\s\S]*?)<\/main\s*>/gi)];
  requireValue(
    heads.length === 1 && mains.length === 1 && /<\/html\s*>/i.test(clean),
    `Incomplete article HTML: ${url}`,
  );
  const head = heads[0][1];
  const titles = [...head.matchAll(/<title\b[^>]*>([\s\S]*?)<\/title>/gi)];
  const links = [...head.matchAll(/<link\b[^>]*>/gi)].map((m) => attrs(m[0]));
  const canonical = links.filter((a) =>
    a.rel?.toLowerCase().split(/\s+/).includes('canonical'),
  );
  requireValue(
    canonical.length === 1 && canonical[0].href === url,
    `Canonical mismatch: ${url}`,
  );
  const meta = [...head.matchAll(/<meta\b[^>]*>/gi)].map((m) => attrs(m[0]));
  requireValue(
    !meta.some(
      (a) =>
        /^(robots|googlebot|bingbot)$/i.test(a.name || '') &&
        blocked(a.content),
    ),
    `Meta robots blocks indexing: ${url}`,
  );
  const descriptions = meta.filter(
    (a) => a.name?.toLowerCase() === 'description',
  );
  requireValue(
    titles.length === 1 &&
      plain(titles[0][1]) &&
      descriptions.length === 1 &&
      descriptions[0].content,
    `Missing article metadata: ${url}`,
  );
  const main = mains[0][1].replace(
    /<(header|footer)\b(?=[^>]*\bclass="[^"]*\bsite-(?:header|footer)\b)[^>]*>[\s\S]*?<\/\1\s*>/gi,
    '',
  );
  requireValue(/<h1\b/i.test(main), `Missing article heading: ${url}`);
  const meaningful = main.replace(/<(a|img)\b[^>]*>/gi, (tag) => {
    const a = attrs(tag);
    return ` ${a.href ? `[link:${a.href}]` : ''}${a.alt ? `[image:${a.alt}]` : ''} `;
  });
  const title = plain(titles[0][1]);
  return {
    title,
    hash: digest(
      JSON.stringify([url, title, descriptions[0].content, plain(meaningful)]),
    ),
  };
}

export function validatePlan(plan) {
  requireValue(
    plan?.version === 1 &&
      plan.origin === SITE &&
      /^[a-f0-9]{40}$/.test(plan.baseCommit) &&
      /^[a-f0-9]{40}$/.test(plan.headCommit) &&
      plan.baseCommit !== plan.headCommit &&
      Array.isArray(plan.urls),
    'Invalid change plan',
  );
  requireValue(!plan.deploymentCommit || /^[a-f0-9]{40}$/.test(plan.deploymentCommit), "Invalid deployment commit");
  const entries = new Map();
  for (const entry of plan.urls) {
    articleUrl(entry.url);
    requireValue(
      /^[a-f0-9]{64}$/.test(entry.afterHash) &&
        ((entry.change === 'added' && entry.beforeHash === null) ||
          (entry.change === 'updated' &&
            /^[a-f0-9]{64}$/.test(entry.beforeHash) &&
            entry.beforeHash !== entry.afterHash)),
      `Not an actual content change: ${entry.url}`,
    );
    requireValue(
      !entries.has(entry.url) ||
        JSON.stringify(entries.get(entry.url)) === JSON.stringify(entry),
      `Conflicting duplicate: ${entry.url}`,
    );
    entries.set(entry.url, entry);
  }
  requireValue(
    entries.size > 0 && entries.size <= 10000,
    'IndexNow maximum is 10000 URLs; split the reviewed plan',
  );
  return {
    ...plan,
    urls: [...entries.values()].sort((a, b) => a.url.localeCompare(b.url)),
  };
}

export function diffSnapshots(before, after) {
  requireValue(
    before.version === 1 &&
      after.version === 1 &&
      before.origin === SITE &&
      after.origin === SITE,
    'Invalid snapshots',
  );
  return validatePlan({
    version: 1,
    origin: SITE,
    baseCommit: before.commit,
    headCommit: after.commit,
    urls: Object.entries(after.articles)
      .filter(([url, a]) => before.articles[url]?.hash !== a.hash)
      .map(([url, a]) => ({
        url,
        change: before.articles[url] ? 'updated' : 'added',
        beforeHash: before.articles[url]?.hash ?? null,
        afterHash: a.hash,
      })),
  });
}
