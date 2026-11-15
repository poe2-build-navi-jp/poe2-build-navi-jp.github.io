import {router, json, error, db, isAppDatabaseError} from '@appdeploy/sdk';
import {createHash, timingSafeEqual} from 'node:crypto';
import {publicPost, postSummary, matchesPost, PUBLIC_PURPOSES, PUBLIC_CURRENCIES} from '../src/community-model.js';
import catalog from '../src/catalog.json';

type Owner = {revision: number; ids: string[]};
type Stored = {
  owner: string; digest: string; status: 'active' | 'withdrawn';
  createdAt: string; data?: ReturnType<typeof publicPost>;
};
type Summary = ReturnType<typeof postSummary> & {createdAt: string};
const POSTS = 'poe2_public_posts';
const META = 'poe2_public_catalog';
const OWNERS = 'poe2_public_owners';
const REPORTS = 'poe2_public_reports';
const sha = (value: string) => createHash('sha256').update(value).digest('hex');
const validId = (value: unknown): value is string => typeof value === 'string' && /^[a-z0-9-]{20,50}$/.test(value);
const validToken = (value: unknown): value is string => typeof value === 'string' && /^[A-Za-z0-9_-]{43}$/.test(value);
const inputObject = (value: unknown) => value && typeof value === 'object' && !Array.isArray(value)
  ? value as Record<string, unknown> : null;
const same = (left: string, right: string) => left.length === right.length && timingSafeEqual(Buffer.from(left), Buffer.from(right));
const retryable = (cause: unknown) => isAppDatabaseError(cause) &&
  ['AppDatabaseConflict', 'AppDatabaseConditionFailed'].includes(cause.code);
function failure(cause: unknown) {
  if (isAppDatabaseError(cause)) {
    if (cause.code === 'AppDatabaseQuotaExceeded') return error('PUBLIC_QUOTA', 429);
    if (cause.code === 'AppDatabaseInvalidInput') return error('PUBLIC_INPUT', 400);
  }
  return error('PUBLIC_RETRY', 503);
}
async function ownerRecord(key: string, create = false) {
  let [owner] = await db.get<Owner>(OWNERS, [key], {consistent: true});
  if (!owner && create) {
    await db.tx.add(OWNERS, [{id: key, revision: 0, ids: []}]);
    [owner] = await db.get<Owner>(OWNERS, [key], {consistent: true});
  }
  return owner;
}
const publicResult = (id: string, post: Stored) => ({id, createdAt: post.createdAt, ...post.data});
async function publish(body: unknown) {
  const input = inputObject(body);
  if (!input || !validId(input.id) || !validToken(input.token) || input.consent !== true) return error('PUBLIC_CONSENT', 400);
  let data: ReturnType<typeof publicPost>;
  try { data = publicPost(input.post, catalog); }
  catch (cause) { return error(cause instanceof Error ? cause.message : 'PUBLIC_INPUT', 400); }
  const id = input.id, key = sha(input.token), digest = sha(JSON.stringify(data));
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const [existing] = await db.get<Stored>(POSTS, [id], {consistent: true});
      if (existing) {
        if (!same(existing.owner, key)) return error('PUBLIC_FORBIDDEN', 403);
        if (existing.status !== 'active' || existing.digest !== digest) return error('PUBLIC_STALE', 409);
        return json(publicResult(id, existing));
      }
      const owner = await ownerRecord(key, true);
      if (!owner) return error('PUBLIC_RETRY', 503);
      if (owner.ids.length >= 10) return error('PUBLIC_OWNER_LIMIT', 429);
      const createdAt = new Date().toISOString();
      const stored: Stored = {owner: key, digest, status: 'active', createdAt, data};
      await db.transact([
        db.tx.add(POSTS, [{id, ...stored}]),
        db.tx.add(META, [{id, ...postSummary(data), createdAt}]),
        db.tx.update(OWNERS, [{id: key, if: {revision: owner.revision}, record: {revision: owner.revision + 1, ids: [...owner.ids, id]}}], {patch: true}),
      ]);
      return json(publicResult(id, stored), 201);
    } catch (cause) {
      if (retryable(cause)) continue;
      // The chosen post ID is the atomic operation's durable receipt.
      if (isAppDatabaseError(cause) && ['AppDatabaseUnknownOutcome', 'AppDatabaseDuplicateId'].includes(cause.code)) {
        try {
          const [stored] = await db.get<Stored>(POSTS, [id], {consistent: true});
          if (stored && same(stored.owner, key) && stored.digest === digest && stored.status === 'active') return json(publicResult(id, stored));
        } catch (readError) { return failure(readError); }
      }
      return failure(cause);
    }
  }
  return error('PUBLIC_STALE', 409);
}
async function withdraw(body: unknown) {
  const input = inputObject(body);
  if (!input || !validId(input.id) || !validToken(input.token)) return error('PUBLIC_INPUT', 400);
  const id = input.id, key = sha(input.token);
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const [stored] = await db.get<Stored>(POSTS, [id], {consistent: true});
      if (!stored || !same(stored.owner, key)) return error('PUBLIC_FORBIDDEN', 403);
      if (stored.status === 'withdrawn') return json({withdrawn: true});
      const owner = await ownerRecord(key);
      if (!owner) return error('PUBLIC_RETRY', 503);
      await db.transact([
        db.tx.update(POSTS, [{id, if: {status: 'active'}, record: {status: 'withdrawn', data: undefined}}], {patch: true}),
        db.tx.delete(META, [id]),
        db.tx.update(OWNERS, [{id: key, if: {revision: owner.revision}, record: {
          revision: owner.revision + 1, ids: owner.ids.filter(value => value !== id),
        }}], {patch: true}),
      ]);
      return json({withdrawn: true});
    } catch (cause) {
      if (retryable(cause)) continue;
      if (isAppDatabaseError(cause) && cause.code === 'AppDatabaseUnknownOutcome') {
        try {
          const [stored] = await db.get<Stored>(POSTS, [id], {consistent: true});
          if (stored && same(stored.owner, key) && stored.status === 'withdrawn') return json({withdrawn: true});
        } catch (readError) { return failure(readError); }
      }
      return failure(cause);
    }
  }
  return error('PUBLIC_STALE', 409);
}
export const handler = router({
  'GET /api/_healthcheck': [async () => json({service: 'poe2-public-builds', version: 1})],
  'POST /api/public/publish': [async ({body}) => publish(body)],
  'POST /api/public/withdraw': [async ({body}) => withdraw(body)],
  'POST /api/public/list': [
    async ({body}) => {
      const input = inputObject(body) || {};
      const filters = inputObject(input.filters) || {};
      if (filters.skill && (typeof filters.skill !== 'string' || !Object.hasOwn(catalog.gems, filters.skill)) ||
          filters.purpose && !PUBLIC_PURPOSES.includes(String(filters.purpose)) ||
          filters.query && (typeof filters.query !== 'string' || filters.query.length > 80) ||
          filters.maximum != null && (typeof filters.maximum !== 'number' || !Number.isFinite(filters.maximum) || filters.maximum < 0 ||
            !PUBLIC_CURRENCIES.includes(String(filters.currency))) ||
          input.nextToken && (typeof input.nextToken !== 'string' || input.nextToken.length > 4000)) return error('PUBLIC_INPUT', 400);
      try {
        const page = await db.list<Summary>(META, {limit: 24, ...(input.nextToken ? {nextToken: String(input.nextToken)} : {})});
        // Confirm live metadata using bounded strong reads, including immediately after withdrawal.
        const ids = page.items.map(item => item.id);
        const live = ids.length ? await db.get<Summary>(META, ids, {consistent: true}) : [];
        const posts = live.flatMap((post, index) => post && matchesPost(post, filters) ? [{id: ids[index], ...post}] : []);
        posts.sort((left, right) => right.createdAt.localeCompare(left.createdAt));
        return json({posts, nextToken: page.nextToken || null});
      } catch (cause) { return failure(cause); }
    },
  ],
  'POST /api/public/read': [
    async ({body}) => {
      const input = inputObject(body);
      if (!input || !validId(input.id)) return error('PUBLIC_INPUT', 400);
      try {
        const [stored] = await db.get<Stored>(POSTS, [input.id], {consistent: true});
        return stored?.status === 'active' && stored.data ? json(publicResult(input.id, stored)) : error('PUBLIC_NOT_FOUND', 404);
      } catch (cause) { return failure(cause); }
    },
  ],
  'POST /api/public/mine': [
    async ({body}) => {
      const input = inputObject(body);
      if (!input || !validToken(input.token)) return error('PUBLIC_INPUT', 400);
      try {
        const owner = await ownerRecord(sha(input.token));
        if (!owner?.ids.length) return json({posts: []});
        const records = await db.get<Summary>(META, owner.ids, {consistent: true});
        return json({posts: records.flatMap((record, index) => record ? [{id: owner.ids[index], ...record}] : [])});
      } catch (cause) { return failure(cause); }
    },
  ],
  'POST /api/public/report': [
    async ({body}) => {
      const input = inputObject(body);
      if (!input || !validId(input.id) || !validToken(input.reporter) ||
          !['misleading', 'abuse', 'privacy', 'other'].includes(String(input.reason)) ||
          typeof input.note !== 'string' || input.note.length > 300) return error('PUBLIC_INPUT', 400);
      try {
        const [post] = await db.get<Summary>(META, [input.id], {consistent: true});
        if (!post) return error('PUBLIC_NOT_FOUND', 404);
        const id = input.id + '-' + sha(input.reporter);
        await db.tx.add(REPORTS, [{id, postId: input.id, reason: input.reason, note: input.note, receivedAt: new Date().toISOString()}]);
        return json({received: true});
      } catch (cause) { return failure(cause); }
    },
  ],
});
