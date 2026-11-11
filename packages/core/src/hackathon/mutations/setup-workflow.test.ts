import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { AppContext } from '../../context';
import { snapshot } from '../lib/setup-snapshot.fixture';
import { buildSetupSummary } from '../lib/build-setup-summary';

process.env.DATABASE_URL ??=
  'postgresql://test:test@127.0.0.1:5432/critiq_test';
const { getHackathonHome } = await import('../queries/get-hackathon-home');
const { markHackathonReady } = await import('./mark-hackathon-ready');
const { returnHackathonToDraft } = await import('./return-hackathon-to-draft');
const { AppError } = await import('../../shared/errors');
const { lockDraft } = await import('../lib/lock-draft');

function database(failAudit = false) {
  let state = { data: snapshot(), audits: [] as unknown[] };
  let queue = Promise.resolve();
  function client(draft: typeof state) {
    return {
      hackathon: {
        findUnique: async ({ where }: { where: { id: string } }) =>
          where.id === draft.data.hackathon.id ? draft.data.hackathon : null,
        updateMany: async ({
          where,
          data,
        }: {
          where: { id: string; status: string };
          data: { status: string };
        }) => {
          if (
            where.id !== draft.data.hackathon.id ||
            where.status !== draft.data.hackathon.status
          )
            return { count: 0 };
          draft.data.hackathon.status =
            data.status as typeof draft.data.hackathon.status;
          return { count: 1 };
        },
        update: async ({ data }: { data: { status: string } }) => {
          draft.data.hackathon.status =
            data.status as typeof draft.data.hackathon.status;
        },
      },
      user: { findMany: async () => draft.data.judges },
      auditLog: {
        create: async ({ data }: { data: unknown }) => {
          if (failAudit) throw new Error('Audit failed');
          draft.audits.push(data);
        },
      },
    };
  }
  const db = {
    ...client(state),
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
        state.data = draft.data;
        state.audits = draft.audits;
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
const rejectsCode = (promise: Promise<unknown>, code: string) =>
  assert.rejects(
    promise,
    (e: unknown) => e instanceof AppError && e.code === code,
  );

test('judges and system actors cannot read admin setup or change it', async () => {
  const db = database();
  for (const actor of [
    { type: 'user', userId: 'judge', role: 'JUDGE' },
    { type: 'system', service: 'test' },
  ] as AppContext['actor'][]) {
    await rejectsCode(getHackathonHome({ ...db.ctx, actor }, {}), 'FORBIDDEN');
    await rejectsCode(
      markHackathonReady(
        { ...db.ctx, actor },
        { fingerprint: 'a'.repeat(64), acknowledgeWarnings: true },
      ),
      'FORBIDDEN',
    );
  }
  assert.equal(db.read().audits.length, 0);
});

test('missing and foreign scope cannot read configuration', async () => {
  const db = database();
  await rejectsCode(
    getHackathonHome({ ...db.ctx, hackathonId: null }, {}),
    'INVALID_STATE',
  );
  await rejectsCode(
    getHackathonHome({ ...db.ctx, hackathonId: 'other' }, {}),
    'NOT_FOUND',
  );
});

test('warnings need explicit acknowledgement; readiness transitions are atomic and reject duplicates', async () => {
  const db = database();
  const input = {
    fingerprint: buildSetupSummary(db.read().data).fingerprint,
    acknowledgeWarnings: false,
  };
  await rejectsCode(markHackathonReady(db.ctx, input), 'VALIDATION_ERROR');
  const results = await Promise.allSettled([
    markHackathonReady(db.ctx, { ...input, acknowledgeWarnings: true }),
    markHackathonReady(db.ctx, { ...input, acknowledgeWarnings: true }),
  ]);
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
  assert.equal(db.read().data.hackathon.status, 'READY');
  assert.equal(db.read().audits.length, 1);
  await returnHackathonToDraft(db.ctx, {});
  assert.equal(db.read().data.hackathon.status, 'DRAFT');
});

test('blocking errors cannot be overridden and stage changes roll back on audit failure', async () => {
  const db = database();
  db.read().data.judges[0]!.conflicts = [
    { projectId: 'project' },
  ] as ReturnType<typeof db.read>['data']['judges'][number]['conflicts'];
  await rejectsCode(
    markHackathonReady(db.ctx, {
      fingerprint: buildSetupSummary(db.read().data).fingerprint,
      acknowledgeWarnings: true,
    }),
    'INVALID_STATE',
  );
  const failing = database(true);
  await rejectsCode(
    markHackathonReady(failing.ctx, {
      fingerprint: buildSetupSummary(failing.read().data).fingerprint,
      acknowledgeWarnings: true,
    }),
    'INTERNAL_SERVER_ERROR',
  );
  assert.equal(failing.read().data.hackathon.status, 'DRAFT');
});

test('post-start stages cannot reopen draft or mark ready', async () => {
  for (const status of [
    'JUDGING',
    'PAUSED',
    'DELIBERATION',
    'COMPLETED',
  ] as const) {
    const db = database();
    db.read().data.hackathon.status = status;
    await rejectsCode(returnHackathonToDraft(db.ctx, {}), 'INVALID_STATE');
    await rejectsCode(
      markHackathonReady(db.ctx, {
        fingerprint: buildSetupSummary(db.read().data).fingerprint,
        acknowledgeWarnings: true,
      }),
      'INVALID_STATE',
    );
  }
});

test('valid configuration becomes Ready without manual completion and does not start judging', async () => {
  const db = database();
  await markHackathonReady(db.ctx, {
    fingerprint: buildSetupSummary(db.read().data).fingerprint,
    acknowledgeWarnings: true,
  });
  assert.equal(db.read().data.hackathon.status, 'READY');
  assert.deepEqual(
    db.read().data.hackathon.categories,
    snapshot().hackathon.categories,
  );
});

test('stale readiness confirmations cannot change the stage', async () => {
  const db = database();
  const fingerprint = buildSetupSummary(db.read().data).fingerprint;
  db.read().data.hackathon.projects[0]!.name = 'Changed';
  await rejectsCode(
    markHackathonReady(db.ctx, { fingerprint, acknowledgeWarnings: true }),
    'CONFLICT',
  );
  assert.equal(db.read().data.hackathon.status, 'DRAFT');
  assert.equal(db.read().audits.length, 0);
});

test('ready locks competition configuration until returned to draft', async () => {
  const db = database();
  await markHackathonReady(db.ctx, {
    fingerprint: buildSetupSummary(db.read().data).fingerprint,
    acknowledgeWarnings: true,
  });
  await rejectsCode(lockDraft(db.ctx), 'INVALID_STATE');
  await returnHackathonToDraft(db.ctx, {});
  assert.equal(await lockDraft(db.ctx), 'event');
});

test('row lock timestamps do not invalidate readiness confirmation', () => {
  const data = snapshot();
  const before = buildSetupSummary(data).fingerprint;
  data.hackathon.updatedAt = new Date();
  assert.equal(buildSetupSummary(data).fingerprint, before);
});
