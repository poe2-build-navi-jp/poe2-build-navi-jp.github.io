import { router, json, error, db, isAppDatabaseError } from '@appdeploy/sdk';
import { createHash, timingSafeEqual } from 'node:crypto';

type Receipt = { id: string; hash: string; revision: number };
type Room = {
  auth: string;
  revision: number;
  count: number;
  iv: string;
  hash: string;
  revoked: boolean;
  receipts: Receipt[];
  uploadId?: string;
  uploadHash?: string;
  uploadIv?: string;
  uploadCount?: number;
  uploadUntil?: number;
};
type Chunk = { revision: number; text: string; requestId?: string };
type Input = {
  room: string;
  token: string;
  revision?: number;
  requestId?: string;
  iv?: string;
  ciphertext?: string;
  hash?: string;
  count?: number;
  index?: number;
};
const TABLE = 'poe2_vaults';
const CHUNKS = 'poe2_vault_chunks';
const hash = (value: string) =>
  createHash('sha256').update(value).digest('hex');
const valid = (input: unknown): input is Input =>
  !!input &&
  typeof input === 'object' &&
  /^[A-Za-z0-9_-]{43}$/.test((input as Input).room || '') &&
  /^[A-Za-z0-9_-]{43}$/.test((input as Input).token || '');
const equal = (a: string, b: string) =>
  a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));
async function authorize(input: Input, includeRevoked = false) {
  const [room] = await db.get<Room>(TABLE, [input.room], { consistent: true });
  return room &&
    equal(room.auth, hash(input.token)) &&
    (includeRevoked || !room.revoked)
    ? room
    : null;
}
const failure = (cause: unknown) =>
  isAppDatabaseError(cause) && cause.code === 'AppDatabaseQuotaExceeded'
    ? error('SYNC_QUOTA', 429)
    : error('SYNC_RETRY', 503);
const validWrite = (body: unknown): body is Input =>
  valid(body) &&
  Number.isSafeInteger(body.revision) &&
  body.revision! >= 0 &&
  /^[a-zA-Z0-9-]{16,80}$/.test(body.requestId || '');
const uploadCleared = {
  uploadId: undefined,
  uploadHash: undefined,
  uploadIv: undefined,
  uploadCount: undefined,
  uploadUntil: undefined,
};
async function readChunks(roomId: string, revision: number, count: number) {
  const chunks: Array<Chunk | null> = [];
  for (let start = 0; start < count; start += 5) {
    const ids = Array.from(
      { length: Math.min(5, count - start) },
      (_, i) => `${roomId}-${revision % 2}-${start + i}`
    );
    chunks.push(...await db.get<Chunk>(CHUNKS, ids, { consistent: true }));
  }
  return chunks;
}

export const handler = router({
  'GET /api/_healthcheck': [
    async () => json({ service: 'poe2-encrypted-sync', version: 1 }),
  ],
  'POST /api/v1/create': [
    async ({ body }) => {
      if (!valid(body)) return error('SYNC_INPUT', 400);
      try {
        const room: Room = {
          auth: hash(body.token),
          revision: 0,
          count: 0,
          iv: '',
          hash: '',
          revoked: false,
          receipts: [],
        };
        const [id] = await db.tx.add(TABLE, [{ id: body.room, ...room }]);
        if (id) return json({ revision: 0 });
        const existing = await authorize(body);
        return existing
          ? json({ revision: existing.revision })
          : error('SYNC_UNAUTHORIZED', 403);
      } catch (cause) {
        return failure(cause);
      }
    },
  ],
  'POST /api/v1/read': [
    async ({ body }) => {
      if (!valid(body)) return error('SYNC_INPUT', 400);
      try {
        const room = await authorize(body);
        if (!room) return error('SYNC_UNAUTHORIZED', 403);
        if (body.revision === room.revision)
          return json({ revision: room.revision, unchanged: true });
        if (!room.count)
          return json({ revision: room.revision, envelope: null });
        if (room.count > 4)
          return json({
            revision: room.revision,
            envelope: { iv: room.iv, hash: room.hash, count: room.count, chunked: true },
          });
        const chunks = await readChunks(body.room, room.revision, room.count);
        if (chunks.some(chunk => !chunk || chunk.revision !== room.revision))
          return error('SYNC_CONFLICT', 409);
        const ciphertext = chunks.map(chunk => chunk!.text).join('');
        const latest = await authorize(body);
        if (!latest) return error('SYNC_UNAUTHORIZED', 403);
        if (latest.revision !== room.revision || hash(ciphertext) !== room.hash)
          return error('SYNC_CONFLICT', 409);
        return json({
          revision: room.revision,
          envelope: { iv: room.iv, ciphertext },
        });
      } catch (cause) {
        return failure(cause);
      }
    },
  ],
  // Large encrypted snapshots cross the HTTP and SDK boundaries in bounded
  // pieces. A conditional upload lease protects the inactive chunk bank;
  // only committing its metadata makes a complete snapshot visible.
  'POST /api/v1/read-chunk': [
    async ({ body }) => {
      if (!valid(body) || !Number.isSafeInteger(body.index) || body.index! < 0)
        return error('SYNC_INPUT', 400);
      try {
        const room = await authorize(body);
        if (!room) return error('SYNC_UNAUTHORIZED', 403);
        if (room.revision !== body.revision || body.index! >= room.count)
          return error('SYNC_CONFLICT', 409);
        const id = `${body.room}-${room.revision % 2}-${body.index}`;
        const [chunk] = await db.get<Chunk>(CHUNKS, [id], { consistent: true });
        if (!chunk || chunk.revision !== room.revision)
          return error('SYNC_CONFLICT', 409);
        return json({ revision: room.revision, ciphertext: chunk.text });
      } catch (cause) {
        return failure(cause);
      }
    },
  ],
  'POST /api/v1/upload-start': [
    async ({ body }) => {
      if (!validWrite(body) || !/^[a-f0-9]{64}$/.test(body.hash || '') ||
          !/^[A-Za-z0-9_-]{16}$/.test(body.iv || '') ||
          !Number.isSafeInteger(body.count) || body.count! < 1 || body.count! > 19)
        return error('SYNC_INPUT', 400);
      try {
        const room = await authorize(body);
        if (!room) return error('SYNC_UNAUTHORIZED', 403);
        const receipt = room.receipts.find(entry => entry.id === body.requestId);
        if (receipt)
          return receipt.hash === body.hash
            ? json({ revision: receipt.revision, committed: true })
            : error('SYNC_REQUEST_REUSED', 409);
        if (room.revision !== body.revision) return error('SYNC_CONFLICT', 409);
        if (room.uploadId === body.requestId)
          return room.uploadHash === body.hash && room.uploadIv === body.iv && room.uploadCount === body.count
            ? json({ started: true })
            : error('SYNC_REQUEST_REUSED', 409);
        if (room.uploadId && room.uploadUntil! > Date.now())
          return error('SYNC_CONFLICT', 409);
        const [updated] = await db.tx.update(TABLE, [{
          id: body.room,
          record: {
            uploadId: body.requestId,
            uploadHash: body.hash,
            uploadIv: body.iv,
            uploadCount: body.count,
            uploadUntil: Date.now() + 120000,
          },
          if: { revision: room.revision, revoked: false, uploadId: room.uploadId },
        }], { patch: true });
        return updated ? json({ started: true }) : error('SYNC_CONFLICT', 409);
      } catch (cause) {
        return failure(cause);
      }
    },
  ],
  'POST /api/v1/upload-chunk': [
    async ({ body }) => {
      if (!validWrite(body) || !Number.isSafeInteger(body.index) || body.index! < 0 ||
          typeof body.ciphertext !== 'string' || body.ciphertext.length < 1 ||
          body.ciphertext.length > 150000 || !/^[A-Za-z0-9_-]+$/.test(body.ciphertext))
        return error('SYNC_INPUT', 400);
      try {
        const room = await authorize(body);
        if (!room) return error('SYNC_UNAUTHORIZED', 403);
        if (room.revision !== body.revision || room.uploadId !== body.requestId ||
            body.index! >= room.uploadCount!) return error('SYNC_CONFLICT', 409);
        const guard = db.tx.update(TABLE, [{
          id: body.room,
          record: { uploadUntil: Date.now() + 120000 },
          if: { revision: room.revision, revoked: false, uploadId: body.requestId },
        }], { patch: true });
        const chunk = db.tx.update(CHUNKS, [{
          id: `${body.room}-${(room.revision + 1) % 2}-${body.index}`,
          record: { revision: room.revision + 1, requestId: body.requestId, text: body.ciphertext },
        }]);
        await db.transact([guard, chunk]);
        return json({ uploaded: true });
      } catch (cause) {
        if (isAppDatabaseError(cause) &&
            ['AppDatabaseConditionFailed', 'AppDatabaseConflict'].includes(cause.code))
          return error('SYNC_CONFLICT', 409);
        return failure(cause);
      }
    },
  ],
  'POST /api/v1/upload-commit': [
    async ({ body }) => {
      if (!validWrite(body) || !/^[a-f0-9]{64}$/.test(body.hash || ''))
        return error('SYNC_INPUT', 400);
      try {
        const room = await authorize(body);
        if (!room) return error('SYNC_UNAUTHORIZED', 403);
        const receipt = room.receipts.find(entry => entry.id === body.requestId);
        if (receipt)
          return receipt.hash === body.hash
            ? json({ revision: receipt.revision })
            : error('SYNC_REQUEST_REUSED', 409);
        if (room.revision !== body.revision || room.uploadId !== body.requestId ||
            room.uploadHash !== body.hash) return error('SYNC_CONFLICT', 409);
        const revision = room.revision + 1;
        const chunks = await readChunks(body.room, revision, room.uploadCount!);
        if (chunks.some(chunk => !chunk || chunk.revision !== revision || chunk.requestId !== body.requestId))
          return error('SYNC_CONFLICT', 409);
        const ciphertext = chunks.map(chunk => chunk!.text).join('');
        if (ciphertext.length < 24 || ciphertext.length > 2800000 ||
            hash(JSON.stringify([body.revision, room.uploadIv, ciphertext])) !== body.hash)
          return error('SYNC_CONFLICT', 409);
        const [updated] = await db.tx.update(TABLE, [{
          id: body.room,
          record: {
            ...uploadCleared,
            revision,
            iv: room.uploadIv,
            hash: hash(ciphertext),
            count: room.uploadCount,
            receipts: [...room.receipts.slice(-31), { id: body.requestId, hash: body.hash, revision }],
          },
          if: { revision: room.revision, revoked: false, uploadId: body.requestId },
        }], { patch: true });
        return updated ? json({ revision }) : error('SYNC_CONFLICT', 409);
      } catch (cause) {
        // A retry checks the receipt before staging or committing anything again.
        return failure(cause);
      }
    },
  ],
  'POST /api/v1/write': [
    async ({ body }) => {
      if (
        !valid(body) ||
        !Number.isSafeInteger(body.revision) ||
        body.revision! < 0 ||
        !/^[a-zA-Z0-9-]{16,80}$/.test(body.requestId || '') ||
        !/^[A-Za-z0-9_-]{16}$/.test(body.iv || '') ||
        typeof body.ciphertext !== 'string' ||
        body.ciphertext.length < 24 ||
        body.ciphertext.length > 2800000 ||
        !/^[A-Za-z0-9_-]+$/.test(body.ciphertext)
      )
        return error('SYNC_INPUT', 400);
      const payloadHash = hash(
        JSON.stringify([body.revision, body.iv, body.ciphertext])
      );
      try {
        const room = await authorize(body);
        if (!room) return error('SYNC_UNAUTHORIZED', 403);
        const receipt = room.receipts.find(
          entry => entry.id === body.requestId
        );
        if (receipt)
          return receipt.hash === payloadHash
            ? json({ revision: receipt.revision })
            : error('SYNC_REQUEST_REUSED', 409);
        if (room.revision !== body.revision) return error('SYNC_CONFLICT', 409);
        if (room.uploadId && room.uploadUntil! > Date.now())
          return error('SYNC_CONFLICT', 409);
        const revision = room.revision + 1;
        const parts: string[] = [];
        for (let i = 0; i < body.ciphertext.length; i += 150000)
          parts.push(body.ciphertext.slice(i, i + 150000));
        const next: Room = {
          ...room,
          ...uploadCleared,
          revision,
          count: parts.length,
          iv: body.iv!,
          hash: hash(body.ciphertext),
          receipts: [
            ...room.receipts.slice(-31),
            { id: body.requestId!, hash: payloadHash, revision },
          ],
        };
        const metadata = db.tx.update(
          TABLE,
          [
            {
              id: body.room,
              record: next,
              if: { revision: room.revision, revoked: false, uploadId: room.uploadId },
            },
          ],
          { patch: true }
        );
        const chunks = parts.map((text, i) => ({
            id: `${body.room}-${revision % 2}-${i}`,
            record: { revision, text },
          }));
        // Each lazy update stays below the per-call input limit. The complete
        // snapshot and its receipt commit together within the 4 MiB transaction.
        const batches = [];
        for (let i = 0; i < chunks.length; i += 5) batches.push(db.tx.update(CHUNKS, chunks.slice(i, i + 5)));
        await db.transact([metadata, ...batches]);
        return json({ revision });
      } catch (cause) {
        // A timed-out transaction may already have committed. Reconcile the same request ID.
        try {
          const current = await authorize(body);
          if (!current) return error('SYNC_UNAUTHORIZED', 403);
          const receipt = current.receipts.find(
            entry => entry.id === body.requestId
          );
          if (receipt)
            return receipt.hash === payloadHash
              ? json({ revision: receipt.revision })
              : error('SYNC_REQUEST_REUSED', 409);
          if (
            isAppDatabaseError(cause) &&
            ['AppDatabaseConditionFailed', 'AppDatabaseConflict'].includes(
              cause.code
            )
          )
            return error('SYNC_CONFLICT', 409);
        } catch {
          /* The client retains the identical encrypted request for a retry. */
        }
        return failure(cause);
      }
    },
  ],
  'POST /api/v1/revoke': [
    async ({ body }) => {
      if (!valid(body)) return error('SYNC_INPUT', 400);
      try {
        const room = await authorize(body, true);
        if (!room) return error('SYNC_UNAUTHORIZED', 403);
        if (!room.revoked) {
          const [updated] = await db.tx.update(TABLE, [{
            id: body.room,
            record: {
              ...uploadCleared,
              revoked: true,
              revision: room.revision + 1,
              count: 0,
              iv: '',
              hash: '',
              receipts: [],
            },
            if: { revision: room.revision, revoked: false },
          }], { patch: true });
          if (!updated) return error('SYNC_CONFLICT', 409);
        }
        // Access is already disabled. Clean both banks in bounded standalone
        // calls; retrying after an ambiguous outcome resumes this cleanup.
        const ids = Array.from(
          { length: 38 },
          (_, i) => `${body.room}-${i % 2}-${Math.floor(i / 2)}`
        );
        for (let start = 0; start < ids.length; start += 5)
          await db.tx.delete(CHUNKS, ids.slice(start, start + 5));
        return json({ revoked: true });
      } catch (cause) {
        return failure(cause);
      }
    },
  ],
});
