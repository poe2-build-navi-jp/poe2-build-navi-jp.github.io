import {
  mkdir,
  open,
  readFile,
  rename,
  unlink,
  writeFile,
} from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import {
  SITE,
  REPO,
  BRANCH,
  ENDPOINT,
  KEY_FILE,
  digest,
  inspectArticle,
  requireValue,
  validatePlan,
} from './indexnow-content.mjs';

const API = `https://api.github.com/repos/${REPO}`;
const MAX_ATTEMPTS = 3;
const receiptId = (entry) => digest(`${entry.url}\0${entry.afterHash}`);
const finished = new Set(['accepted', 'key_validation_pending']);

async function get(url, fetchFn) {
  const response = await fetchFn(url, {
    redirect: 'manual',
    signal: AbortSignal.timeout(20000),
    headers: {
      Accept: url.startsWith(API) ? 'application/vnd.github+json' : '*/*',
    },
  });
  requireValue(
    response.status === 200 && !response.redirected,
    `GET did not return 200: ${url.includes(KEY_FILE) ? 'public IndexNow key' : url} (${response.status})`,
  );
  return response;
}
export async function verifyDeployment(head, fetchFn = fetch) {
  const branch = await (await get(`${API}/branches/${BRANCH}`, fetchFn)).json();
  requireValue(
    branch.commit?.sha === head,
    'Production branch moved; rebuild and review the plan',
  );
  const result = await (
    await get(`${API}/actions/runs?head_sha=${head}&per_page=100`, fetchFn)
  ).json();
  const runs = result.workflow_runs?.filter(r =>
    r.name === 'pages build and deployment' &&
    r.path === 'dynamic/pages/pages-build-deployment' &&
    r.head_sha === head && r.head_branch === BRANCH &&
    r.repository?.full_name === REPO && r.event === 'dynamic'
  ) || [];
  const latest = runs.sort((a, b) => b.id - a.id)[0];
  requireValue(latest && latest.status === 'completed' && latest.conclusion === 'success',
    'Exact production commit has no successful latest GitHub Pages deployment');
  return { id: latest.id, head, completedAt: latest.updated_at, detailsUrl: latest.html_url };
}

export async function verifyProduction(plan, key, fetchFn = fetch) {
  requireValue(
    /^[A-Za-z0-9-]{8,128}$/.test(key) && `${key}.txt` === KEY_FILE,
    'Existing public IndexNow key file is invalid',
  );
  const deployment = await verifyDeployment(plan.deploymentCommit || plan.headCommit, fetchFn);
  const keyResponse = await get(`${SITE}/${KEY_FILE}`, fetchFn);
  requireValue(
    (await keyResponse.text()).trim() === key,
    'Public IndexNow key content does not match',
  );
  const robots = await (await get(`${SITE}/robots.txt`, fetchFn)).text();
  // This site currently allows all crawlers. Fail closed if that policy changes.
  requireValue(/^User-agent: \*\s+Allow: \/\s+Sitemap: https:\/\/poe2-build-navi-jp\.github\.io\/sitemap\.xml\s*$/i.test(robots),
    'Robots policy changed; review before submitting');
  const sitemap = await (await get(`${SITE}/sitemap.xml`, fetchFn)).text();
  const locations = new Set([...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]));
  for (const entry of plan.urls) {
    requireValue(locations.has(entry.url), `URL missing from production sitemap: ${entry.url}`);
    const response = await get(entry.url, fetchFn);
    requireValue(
      /^text\/html(?:;|$)/i.test(response.headers.get('content-type') || ''),
      `Expected HTML: ${entry.url}`,
    );
    const article = inspectArticle(
      await response.text(),
      entry.url,
      response.headers,
    );
    requireValue(
      article.hash === entry.afterHash,
      `Production content differs from reviewed build: ${entry.url}`,
    );
  }
  const finalDeployment = await verifyDeployment(plan.deploymentCommit || plan.headCommit, fetchFn);
  requireValue(
    finalDeployment.id === deployment.id,
    'Deployment changed during verification',
  );
  return finalDeployment;
}

async function readState(path) {
  try {
    const data = JSON.parse(await readFile(path, 'utf8'));
    requireValue(
      data.version === 1 &&
        data.origin === SITE &&
        data.entries &&
        typeof data.entries === 'object' &&
        !Array.isArray(data.entries) &&
        Array.isArray(data.events),
      'Invalid receipt state; preserve it for review',
    );
    for (const [id, receipt] of Object.entries(data.entries)) {
      requireValue(
        receipt &&
          typeof receipt === 'object' &&
          /^[a-f0-9]{64}$/.test(receipt.contentHash) &&
          id === digest(`${receipt.url}\0${receipt.contentHash}`) &&
          /^[a-f0-9]{40}$/.test(receipt.commit) &&
          Number.isSafeInteger(receipt.checkId) &&
          receipt.checkId > 0 &&
          Number.isSafeInteger(receipt.attempts) &&
          receipt.attempts >= 1 &&
          receipt.attempts <= MAX_ATTEMPTS &&
          Number.isFinite(receipt.updatedAt) &&
          [
            'accepted',
            'key_validation_pending',
            'retryable',
            'rejected',
            'uncertain',
            'in_flight',
          ].includes(receipt.status) &&
          (receipt.status !== 'accepted' || receipt.httpStatus === 200) &&
          (receipt.status !== 'key_validation_pending' ||
            receipt.httpStatus === 202) &&
          (receipt.status !== 'retryable' ||
            Number.isFinite(receipt.nextAttemptAt)),
        'Invalid receipt entry; preserve it for review',
      );
    }
    return data;
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    return { version: 1, origin: SITE, entries: {}, events: [] };
  }
}
function retryDelay(response, attempt, now) {
  const value = response.headers.get('retry-after');
  if (value) {
    const ms = /^\d+$/.test(value)
      ? Number(value) * 1000
      : Date.parse(value) - now;
    return Number.isFinite(ms) ? Math.max(1000, ms) : 3600000;
  }
  return 1000 * 2 ** (attempt - 1);
}

export async function runIndexNow({
  plan: input,
  mode = 'dry-run',
  key,
  stateDir,
  fetchFn = fetch,
  sleep = delay,
  now = Date.now,
}) {
  const plan = validatePlan(input);
  requireValue(['dry-run', 'verify', 'send'].includes(mode), 'Invalid mode');
  if (mode === 'dry-run')
    return {
      mode,
      head: plan.headCommit,
      count: plan.urls.length,
      urls: plan.urls.map((e) => e.url),
      posts: 0,
    };
  if (!plan.urls.length) return { mode, count: 0, posts: 0 };
  if (mode === 'verify')
    return {
      mode,
      count: plan.urls.length,
      deployment: await verifyProduction(plan, key, fetchFn),
      posts: 0,
    };
  requireValue(stateDir, 'A durable receipt directory is required');
  await mkdir(stateDir, { recursive: true });
  // Persist the directory entry too when this invocation created the state folder.
  const parentDir = await open(dirname(stateDir), 'r');
  try { await parentDir.sync(); } finally { await parentDir.close(); }
  const lockPath = join(stateDir, 'submission.lock');
  const lock = await open(lockPath, 'wx');
  const statePath = join(stateDir, 'receipts.json');
  try {
    const state = await readState(statePath);
    const save = async () => {
      const temporary = await open(statePath + '.tmp', 'w');
      try {
        await temporary.writeFile(JSON.stringify(state, null, 2) + '\n');
        await temporary.sync();
      } finally { await temporary.close(); }
      await rename(statePath + '.tmp', statePath);
      const directory = await open(stateDir, 'r');
      try { await directory.sync(); } finally { await directory.close(); }
    };
    const pending = plan.urls.filter(
      (e) => !finished.has(state.entries[receiptId(e)]?.status),
    );
    if (!pending.length)
      return { mode, status: 'already_received', count: 0, posts: 0 };
    for (const entry of pending) {
      const previous = state.entries[receiptId(entry)];
      requireValue(
        !previous ||
          (previous.status === 'retryable' &&
            previous.attempts < MAX_ATTEMPTS &&
            previous.nextAttemptAt <= now()),
        `Receipt blocks automatic resubmission; review status/attempts/retry time: ${entry.url}`,
      );
      const sameUrl = Object.values(state.entries).filter(
        (r) => r.url === entry.url,
      );
      requireValue(
        !sameUrl.some((r) => ['in_flight', 'uncertain'].includes(r.status)),
        `Uncertain prior request needs review: ${entry.url}`,
      );
      requireValue(
        !sameUrl.some(
          (r) => finished.has(r.status) && now() - r.updatedAt < 300000,
        ),
        `Wait at least five minutes between changed versions: ${entry.url}`,
      );
    }
    const selected = { ...plan, urls: pending };
    let deployment, posts = 0;
    while (true) {
      // Revalidate every live condition before the first POST and every 429 retry.
      const check = await verifyProduction(selected, key, fetchFn);
      requireValue(
        !deployment || check.id === deployment.id,
        'Deployment changed before submission',
      );
      deployment = check;
      for (const e of pending) {
        const id = receiptId(e),
          old = state.entries[id];
        state.entries[id] = {
          url: e.url,
          contentHash: e.afterHash,
          commit: plan.deploymentCommit || plan.headCommit,
          checkId: deployment.id,
          status: 'in_flight',
          attempts: (old?.attempts || 0) + 1,
          updatedAt: now(),
        };
      }
      state.events.push({
        at: now(),
        status: 'in_flight',
        commit: plan.deploymentCommit || plan.headCommit,
        checkId: deployment.id,
        receiptIds: pending.map(receiptId),
      });
      await save();
      posts++;
      let response;
      try {
        response = await fetchFn(ENDPOINT, {
          method: 'POST',
          redirect: 'manual',
          signal: AbortSignal.timeout(20000),
          headers: { 'Content-Type': 'application/json; charset=utf-8' },
          body: JSON.stringify({
            host: new URL(SITE).host,
            key,
            keyLocation: `${SITE}/${KEY_FILE}`,
            urlList: pending.map((e) => e.url),
          }),
        });
      } catch {
        for (const e of pending)
          Object.assign(state.entries[receiptId(e)], {
            status: 'uncertain',
            updatedAt: now(),
          });
        state.events.push({
          at: now(),
          status: 'uncertain',
          commit: plan.deploymentCommit || plan.headCommit,
          receiptIds: pending.map(receiptId),
        });
        await save();
        throw new Error(
          'IndexNow response unknown; do not resend automatically. Preserve receipts for review.',
        );
      }
      const attempts = Math.max(
        ...pending.map((e) => state.entries[receiptId(e)].attempts),
      );
      // Only an explicit 429 is known not to have accepted the batch.
      // A server error or lost response may happen after receipt: never resend it.
      const retryable = response.status === 429;
      const status =
        response.status === 200
          ? 'accepted'
          : response.status === 202
            ? 'key_validation_pending'
            : retryable
              ? 'retryable'
              : response.status >= 500 || response.status < 200 || (response.status >= 300 && response.status < 400)
                ? 'uncertain'
                : 'rejected';
      const wait = retryable ? retryDelay(response, attempts, now()) : 0;
      for (const e of pending)
        Object.assign(state.entries[receiptId(e)], {
          status,
          httpStatus: response.status,
          updatedAt: now(),
          nextAttemptAt: now() + wait,
        });
      state.events.push({
        at: now(),
        status,
        httpStatus: response.status,
        commit: plan.deploymentCommit || plan.headCommit,
        receiptIds: pending.map(receiptId),
      });
      await save();
      if (finished.has(status))
        return {
          mode,
          status,
          httpStatus: response.status,
          count: pending.length,
          posts,
          indexingConfirmed: false,
          deployment,
        };
      if (!retryable || attempts >= MAX_ATTEMPTS || wait > 30000)
        throw new Error(
          `IndexNow ${response.status}; stopped after ${attempts} attempt(s). See durable receipts before retrying.`,
        );
      await sleep(wait);
    }
  } finally {
    await lock.close();
    await unlink(lockPath);
  }
}
