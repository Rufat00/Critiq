import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { AppContext } from '../../context';
import type { UpdateCategoryInput } from '../schemas/update-category-schema';

process.env.DATABASE_URL ??=
  'postgresql://test:test@127.0.0.1:5432/critiq_test';
const { updateCategory } = await import('./update-category');
const { AppError } = await import('../../shared/errors');

function database({
  failAudit = false,
  status = 'DRAFT',
  activity = false,
} = {}) {
  let state = {
    name: 'Original',
    description: null as string | null,
    method: 'RELATIVE',
    writes: 0,
    audits: [] as unknown[],
  };
  const ctx = {
    hackathonId: 'event',
    actor: { type: 'user', userId: 'owner', role: 'OWNER' },
    request: {},
    source: 'web-action',
    db: {
      async $transaction(run: (tx: unknown) => Promise<unknown>) {
        const draft = structuredClone(state);
        const result = await run({
          hackathon: {
            updateMany: async ({ where }: { where: { id: string } }) => ({
              count: Number(where.id === 'event' && status === 'DRAFT'),
            }),
          },
          judgingCategory: {
            findFirst: async ({
              where,
            }: {
              where: {
                id: string | { not: string };
                hackathonId: string;
                name?: unknown;
              };
            }) => {
              if (where.name) return null;
              if (where.id !== 'category' || where.hackathonId !== 'event')
                return null;
              return {
                id: 'category',
                kind: 'TRACK',
                ...draft,
                track: {
                  id: 'track',
                  hackathonId: 'event',
                  allowedChallenges: [],
                },
                challenge: null,
                rubric: null,
                _count: {
                  assignments: Number(activity),
                  evaluations: 0,
                  rankings: 0,
                },
              };
            },
            update: async ({
              data,
            }: {
              data: {
                name: string;
                description: string | null;
                method: string;
              };
            }) => {
              Object.assign(draft, data);
              draft.writes++;
            },
          },
          challengeTrack: {
            deleteMany: async () => {},
            createMany: async () => {},
          },
          track: { findMany: async () => [] },
          challenge: { findMany: async () => [] },
          auditLog: {
            create: async ({ data }: { data: unknown }) => {
              if (failAudit) throw new Error('Audit failed');
              draft.audits.push(data);
            },
          },
        });
        state = draft;
        return result;
      },
    },
  } as unknown as AppContext;
  return { ctx, read: () => state };
}
const input: UpdateCategoryInput = {
  categoryId: 'category',
  kind: 'TRACK',
  name: 'Updated',
  description: 'New description',
  method: 'RELATIVE',
};
const rejects = (promise: Promise<unknown>, code: string) =>
  assert.rejects(
    promise,
    (e: unknown) => e instanceof AppError && e.code === code,
  );

test('category edits authorize organizers, scope categories, and validate methods and weights', async () => {
  const { ctx, read } = database();
  await rejects(
    updateCategory(
      { ...ctx, actor: { type: 'user', userId: 'judge', role: 'JUDGE' } },
      input,
    ),
    'FORBIDDEN',
  );
  await rejects(
    updateCategory(
      { ...ctx, actor: { type: 'system', service: 'test' } },
      input,
    ),
    'FORBIDDEN',
  );
  await rejects(
    updateCategory({ ...ctx, hackathonId: null }, input),
    'INVALID_STATE',
  );
  await rejects(
    updateCategory({ ...ctx, hackathonId: 'foreign' }, input),
    'INVALID_STATE',
  );
  await rejects(
    updateCategory(ctx, { ...input, categoryId: 'foreign' }),
    'NOT_FOUND',
  );
  await rejects(
    updateCategory(ctx, {
      ...input,
      kind: 'CHALLENGE',
      method: 'RATING_SCALE',
    }),
    'NOT_FOUND',
  );
  await rejects(
    updateCategory(ctx, { ...input, method: 'RATING_SCALE' }),
    'VALIDATION_ERROR',
  );
  await rejects(
    updateCategory(ctx, {
      ...input,
      method: 'RUBRIC',
      criteria: [{ name: 'Impact', weight: 20 }],
    }),
    'VALIDATION_ERROR',
  );
  await rejects(
    updateCategory(ctx, {
      ...input,
      method: 'RUBRIC',
      criteria: [
        { name: 'Impact', weight: 15 },
        { name: 'Execution', weight: 85 },
      ],
    }),
    'VALIDATION_ERROR',
  );
  await rejects(
    updateCategory(ctx, { ...input, challengeIds: ['foreign'] }),
    'NOT_FOUND',
  );
  assert.equal(read().writes, 0);
});

test('edits persist details with before and after audit, and audit failure rolls back all writes', async () => {
  const db = database();
  await updateCategory(db.ctx, input);
  assert.equal(db.read().name, 'Updated');
  assert.equal(db.read().description, 'New description');
  const audit = db.read().audits[0] as {
    actorId: string;
    hackathonId: string;
    metadata: { before: { name: string }; after: { name: string } };
  };
  assert.equal(audit.actorId, 'owner');
  assert.equal(audit.hackathonId, 'event');
  assert.equal(audit.metadata.before.name, 'Original');
  assert.equal(audit.metadata.after.name, 'Updated');
  const failed = database({ failAudit: true });
  await rejects(updateCategory(failed.ctx, input), 'INTERNAL_SERVER_ERROR');
  assert.equal(failed.read().name, 'Original');
  assert.equal(failed.read().writes, 0);
  assert.equal(failed.read().audits.length, 0);
});

test('only Draft permits edits; judging activity protects methods while preserving detail edits', async () => {
  for (const status of [
    'READY',
    'JUDGING',
    'PAUSED',
    'DELIBERATION',
    'COMPLETED',
  ]) {
    const db = database({ status });
    await rejects(updateCategory(db.ctx, input), 'INVALID_STATE');
    assert.equal(db.read().writes, 0);
  }
  const db = database({ activity: true });
  await rejects(
    updateCategory(db.ctx, {
      ...input,
      method: 'RUBRIC',
      criteria: [{ name: 'Impact', weight: 100 }],
    }),
    'INVALID_STATE',
  );
  await updateCategory(db.ctx, input);
  assert.equal(db.read().name, 'Updated');
});
