import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { AppContext } from '../../context';

process.env.DATABASE_URL ??=
  'postgresql://test:test@127.0.0.1:5432/critiq_test';
const { completeSetup } = await import('./complete-setup');
const { getEntryState } =
  await import('../../registration/queries/get-entry-state');
const { AppError, AppErrorCode } = await import('../../shared/errors');

function database({ failAudit = false, name = null as string | null } = {}) {
  let state = { name, audits: [] as unknown[] };
  let queue = Promise.resolve();
  const db = {
    installation: { findUnique: async () => ({ claimedAt: new Date() }) },
    hackathon: {
      findFirst: async () => ({ id: 'hackathon', name: state.name }),
    },
    async $transaction(run: (tx: unknown) => Promise<unknown>) {
      const before = queue;
      let release!: () => void;
      queue = new Promise<void>((resolve) => {
        release = resolve;
      });
      await before;
      const draft = structuredClone(state);
      const tx = {
        hackathon: {
          updateMany: async ({
            where,
            data,
          }: {
            where: { id: string };
            data: { name: string };
          }) => {
            if (where.id !== 'hackathon' || draft.name) return { count: 0 };
            draft.name = data.name;
            return { count: 1 };
          },
        },
        auditLog: {
          create: async ({ data }: { data: unknown }) => {
            if (failAudit) throw new Error('Simulated audit failure');
            draft.audits.push(data);
          },
        },
      };
      try {
        const result = await run(tx);
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
    hackathonId: 'hackathon',
    source: 'web-action',
    request: {},
  } as unknown as AppContext;
  return { ctx, read: () => state };
}

function rejectsCode(promise: Promise<unknown>, code: string) {
  return assert.rejects(
    promise,
    (error: unknown) => error instanceof AppError && error.code === code,
  );
}

test('only the owner can complete setup', async () => {
  for (const actor of [
    { type: 'user' as const, userId: 'admin', role: 'ADMIN' as const },
    { type: 'user' as const, userId: 'judge', role: 'JUDGE' as const },
    { type: 'system' as const, service: 'test' },
  ]) {
    const db = database();
    await rejectsCode(
      completeSetup({ ...db.ctx, actor }, { name: 'RowdyHacks' }),
      AppErrorCode.FORBIDDEN,
    );
    assert.equal(db.read().name, null);
  }
});

test('validates names before saving and retains unfinished setup', async () => {
  const db = database();
  for (const name of ['', '   ', 'x'.repeat(101)]) {
    await rejectsCode(
      completeSetup(db.ctx, { name }),
      AppErrorCode.VALIDATION_ERROR,
    );
  }
  assert.equal((await getEntryState(db.ctx, {})).configurationRequired, true);
  assert.equal(db.read().audits.length, 0);
});

test('saves a trimmed name and audit, and completion survives a fresh read', async () => {
  const db = database();
  await completeSetup(db.ctx, { name: '  RowdyHacks  ' });
  assert.equal(db.read().name, 'RowdyHacks');
  assert.equal(db.read().audits.length, 1);
  const state = await getEntryState(db.ctx, {});
  assert.equal(state.configurationRequired, false);
  assert.equal(state.hackathonName, 'RowdyHacks');
});

test('concurrent completion cannot overwrite the first name', async () => {
  const db = database();
  const results = await Promise.allSettled([
    completeSetup(db.ctx, { name: 'RowdyHacks' }),
    completeSetup(db.ctx, { name: 'Another name' }),
  ]);
  assert.equal(
    results.filter((result) => result.status === 'fulfilled').length,
    1,
  );
  assert.equal(db.read().name, 'RowdyHacks');
  assert.equal(db.read().audits.length, 1);
});

test('audit failure rolls back the name and leaves setup unfinished', async () => {
  const db = database({ failAudit: true });
  await rejectsCode(
    completeSetup(db.ctx, { name: 'RowdyHacks' }),
    AppErrorCode.INTERNAL_SERVER_ERROR,
  );
  assert.equal(db.read().name, null);
  assert.equal((await getEntryState(db.ctx, {})).configurationRequired, true);
});

test('missing or incorrect hackathon scope cannot complete setup', async () => {
  const db = database();
  await rejectsCode(
    completeSetup({ ...db.ctx, hackathonId: null }, { name: 'RowdyHacks' }),
    AppErrorCode.INVALID_STATE,
  );
  await rejectsCode(
    completeSetup({ ...db.ctx, hackathonId: 'other' }, { name: 'RowdyHacks' }),
    AppErrorCode.INVALID_STATE,
  );
  assert.equal(db.read().name, null);
});
