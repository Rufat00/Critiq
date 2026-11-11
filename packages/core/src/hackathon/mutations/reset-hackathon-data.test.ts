import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { AppContext } from '../../context';
process.env.DATABASE_URL ??=
  'postgresql://test:test@127.0.0.1:5432/critiq_test';
const { resetHackathonData } = await import('./reset-hackathon-data');
const { AppError } = await import('../../shared/errors');

function fixture({ status = 'DRAFT', activity = '', failAudit = false } = {}) {
  const state = { deleted: 0, audits: 0, completions: 0 };
  const count = (name: string) => async () => (activity === name ? 1 : 0);
  function client(draft: typeof state) {
    return {
      hackathon: {
        updateMany: async ({
          where,
        }: {
          where: { id: string; status: string };
        }) => ({
          count: where.id === 'event' && where.status === status ? 1 : 0,
        }),
      },
      judgingCategory: { count: count('started') },
      judgingAssignment: { count: count('assignments') },
      evaluation: { count: count('evaluations') },
      relativeRanking: { count: count('rankings') },
      projectFlag: { count: count('flags') },
      project: {
        deleteMany: async ({ where }: { where: { hackathonId: string } }) => {
          assert.equal(where.hackathonId, 'event');
          draft.deleted += 3;
          return { count: 3 };
        },
      },
      setupCompletion: {
        deleteMany: async ({
          where,
        }: {
          where: { hackathonId: string; section: { in: string[] } };
        }) => {
          assert.equal(where.hackathonId, 'event');
          assert.deepEqual(where.section.in, ['projects', 'rooms']);
          draft.completions++;
        },
      },
      auditLog: {
        create: async () => {
          if (failAudit) throw new Error('Audit failed');
          draft.audits++;
        },
      },
    };
  }
  const db = {
    ...client(state),
    $transaction: async (run: (tx: unknown) => Promise<unknown>) => {
      const draft = structuredClone(state);
      const result = await run(client(draft));
      Object.assign(state, draft);
      return result;
    },
  };
  const ctx = {
    db,
    hackathonId: 'event',
    actor: { type: 'user', userId: 'owner', role: 'OWNER' },
    source: 'web-action',
    request: { ipAddress: null, userAgent: null },
  } as unknown as AppContext;
  return { ctx, state };
}
const input = { section: 'projects' as const, acknowledged: true as const };
const rejects = (promise: Promise<unknown>, code: string) =>
  assert.rejects(
    promise,
    (error: unknown) => error instanceof AppError && error.code === code,
  );

test('only owners can reset any data, including direct server calls', async () => {
  const f = fixture();
  for (const role of ['ADMIN', 'JUDGE'] as const) {
    for (const section of [
      'projects',
      'judges',
      'categories',
      'rooms',
    ] as const) {
      await rejects(
        resetHackathonData(
          { ...f.ctx, actor: { type: 'user', userId: role, role } },
          { ...input, section },
        ),
        'FORBIDDEN',
      );
    }
  }
  await rejects(
    resetHackathonData(
      { ...f.ctx, actor: { type: 'system', service: 'test' } },
      input,
    ),
    'FORBIDDEN',
  );
  assert.equal(f.state.deleted, 0);
});
test('deletion requires an explicit acknowledgment and a valid section', async () => {
  const f = fixture();
  for (const raw of [
    { section: 'projects' },
    { ...input, acknowledged: false },
    { ...input, section: 'all' },
  ]) {
    await rejects(
      resetHackathonData(f.ctx, raw as typeof input),
      'VALIDATION_ERROR',
    );
  }
  assert.equal(f.state.deleted, 0);
});
test('resets reject all non-draft stages and foreign scope', async () => {
  for (const status of [
    'READY',
    'JUDGING',
    'PAUSED',
    'DELIBERATION',
    'COMPLETED',
  ]) {
    const f = fixture({ status });
    await rejects(resetHackathonData(f.ctx, input), 'INVALID_STATE');
    assert.equal(f.state.deleted, 0);
  }
  const f = fixture();
  await rejects(
    resetHackathonData({ ...f.ctx, hackathonId: 'foreign' }, input),
    'INVALID_STATE',
  );
});
test('judging history blocks every reset even in a reopened draft', async () => {
  for (const activity of [
    'started',
    'assignments',
    'evaluations',
    'rankings',
    'flags',
  ]) {
    const f = fixture({ activity });
    for (const section of [
      'projects',
      'judges',
      'categories',
      'rooms',
    ] as const)
      await rejects(
        resetHackathonData(f.ctx, { ...input, section }),
        'INVALID_STATE',
      );
    assert.equal(f.state.deleted, 0);
  }
});
test('project reset scopes deletion, clears readiness, and audits atomically', async () => {
  const f = fixture();
  assert.equal((await resetHackathonData(f.ctx, input)).deleted, 3);
  assert.deepEqual(f.state, { deleted: 3, audits: 1, completions: 1 });
});
test('audit failure rolls back deletion and checklist changes', async () => {
  const f = fixture({ failAudit: true });
  await rejects(resetHackathonData(f.ctx, input), 'INTERNAL_SERVER_ERROR');
  assert.deepEqual(f.state, { deleted: 0, audits: 0, completions: 0 });
});
