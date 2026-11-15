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
};
type Chunk = { revision: number; text: string };
type Input = {
  room: string;
  token: string;
  revision?: number;
  requestId?: string;
  iv?: string;
  ciphertext?: string;
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
        const ids = Array.from(
          { length: room.count },
          (_, i) => `${body.room}-${room.revision % 2}-${i}`
        );
        const chunks = await db.get<Chunk>(CHUNKS, ids, { consistent: true });
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
        const revision = room.revision + 1;
        const parts: string[] = [];
        for (let i = 0; i < body.ciphertext.length; i += 150000)
          parts.push(body.ciphertext.slice(i, i + 150000));
        const next: Room = {
          ...room,
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
              if: { revision: room.revision, revoked: false },
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
        if (room.revoked) return json({ revoked: true });
        const metadata = db.tx.update(
          TABLE,
          [
            {
              id: body.room,
              record: {
                revoked: true,
                revision: room.revision + 1,
                count: 0,
                iv: '',
                hash: '',
                receipts: [],
              },
              if: { revision: room.revision, revoked: false },
            },
          ],
          { patch: true }
        );
        const chunks = db.tx.delete(
          CHUNKS,
          Array.from(
            { length: 38 },
            (_, i) => `${body.room}-${i % 2}-${Math.floor(i / 2)}`
          )
        );
        await db.transact([metadata, chunks]);
        return json({ revoked: true });
      } catch (cause) {
        return failure(cause);
      }
    },
  ],
});
