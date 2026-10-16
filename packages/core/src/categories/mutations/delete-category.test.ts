import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { AppContext } from '../../context';

process.env.DATABASE_URL ??=
  'postgresql://test:test@127.0.0.1:5432/critiq_test';
const { deleteCategory } = await import('./delete-category');
const { AppError } = await import('../../shared/errors');

function database({
  failAudit = false,
  kind = 'TRACK',
  activity = 0,
  status = 'DRAFT',
} = {}) {
  let state = { deleted: false, audits: [] as unknown[], status };
  let queue = Promise.resolve();
  const category = {
    id: 'category',
    hackathonId: 'event',
    kind,
    name: 'AI',
    description: null,
    method: 'RELATIVE',
    _count: { assignments: activity, evaluations: 0, rankings: 0 },
  };
  function client(draft: typeof state) {
    return {
      hackathon: {
        updateMany: async ({
          where,
        }: {
          where: { id: string; status: string };
        }) => ({
          count: Number(where.id === 'event' && where.status === draft.status),
        }),
      },
      judgingCategory: {
        findFirst: async ({
          where,
        }: {
          where: { id: string; hackathonId: string };
        }) =>
          !draft.deleted &&
          where.id === category.id &&
          where.hackathonId === category.hackathonId
            ? category
            : null,
        delete: async () => {
          draft.deleted = true;
        },
      },
      auditLog: {
        create: async ({ data }: { data: unknown }) => {
          if (failAudit) throw new Error('Audit failed');
          draft.audits.push(data);
        },
      },
    };
  }
  const db = {
    async $transaction(run: (tx: unknown) => Promise<unknown>) {
      const previous = queue;
      let release!: () => void;
      queue = new Promise<void>((resolve) => {
        release = resolve;
      });
      await previous;
      const draft = structuredClone(state);
      try {
        const result = await run(client(draft));
        state = draft;
        return result;
      } finally {
        release();
      }
    },
  };
  const ctx = {
    db,
    actor: { type: 'user', userId: 'owner', role: 'OWNER' },
    hackathonId: 'event',
    source: 'web-action',
    request: {},
  } as unknown as AppContext;
  return { ctx, read: () => state };
}
const rejects = (promise: Promise<unknown>, code: string) =>
  assert.rejects(
    promise,
    (e: unknown) => e instanceof AppError && e.code === code,
  );

test('category deletion authorizes organizers, scopes IDs, and validates input', async () => {
  const db = database();
  await rejects(
    deleteCategory(
      { ...db.ctx, actor: { type: 'user', userId: 'judge', role: 'JUDGE' } },
      { categoryId: 'category' },
    ),
    'FORBIDDEN',
  );
  await rejects(
    deleteCategory(
      { ...db.ctx, actor: { type: 'system', service: 'test' } },
      { categoryId: 'category' },
    ),
    'FORBIDDEN',
  );
  await rejects(
    deleteCategory(
      { ...db.ctx, hackathonId: 'foreign' },
      { categoryId: 'category' },
    ),
    'INVALID_STATE',
  );
  await rejects(
    deleteCategory(db.ctx, { categoryId: 'foreign-category' }),
    'NOT_FOUND',
  );
  await rejects(
    deleteCategory(db.ctx, { categoryId: ' ' }),
    'VALIDATION_ERROR',
  );
  assert.equal(db.read().deleted, false);
  assert.equal(db.read().audits.length, 0);
});

test('Overall, locked stages, and categories with judging activity are protected', async () => {
  for (const options of [
    { kind: 'OVERALL' },
    { activity: 1 },
    ...['READY', 'JUDGING', 'PAUSED', 'DELIBERATION', 'COMPLETED'].map(
      (status) => ({ status }),
    ),
  ]) {
    const db = database(options);
    await rejects(
      deleteCategory(db.ctx, { categoryId: 'category' }),
      'kind' in options && options.kind === 'OVERALL'
        ? 'FORBIDDEN'
        : 'INVALID_STATE',
    );
    assert.equal(db.read().deleted, false);
    assert.equal(db.read().audits.length, 0);
  }
});

test('deletion and before/after audit commit together and roll back on audit failure', async () => {
  const db = database();
  await deleteCategory(db.ctx, { categoryId: 'category' });
  assert.equal(db.read().deleted, true);
  assert.equal(db.read().audits.length, 1);
  const failing = database({ failAudit: true });
  await rejects(
    deleteCategory(failing.ctx, { categoryId: 'category' }),
    'INTERNAL_SERVER_ERROR',
  );
  assert.equal(failing.read().deleted, false);
  assert.equal(failing.read().audits.length, 0);
});

test('duplicate concurrent deletes only commit one deletion and one audit', async () => {
  const db = database();
  const results = await Promise.allSettled([
    deleteCategory(db.ctx, { categoryId: 'category' }),
    deleteCategory(db.ctx, { categoryId: 'category' }),
  ]);
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
  assert.equal(db.read().audits.length, 1);
});
