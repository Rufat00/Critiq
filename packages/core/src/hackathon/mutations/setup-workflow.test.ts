import { judgingSetupFingerprint } from '../../judging/shared/judging-setup-fingerprint';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { AppContext } from '../../context';
import { snapshot } from '../lib/setup-snapshot.fixture';
import { buildSetupSummary } from '../lib/build-setup-summary';

process.env.DATABASE_URL ??=
  'postgresql://test:test@127.0.0.1:5432/critiq_test';
const { getHackathonHome } = await import('../queries/get-hackathon-home');
const { markHackathonReady } = await import('./mark-hackathon-ready');
const { startHackathonJudging } = await import('./start-hackathon-judging');
const { returnHackathonToDraft } = await import('./return-hackathon-to-draft');
const { AppError } = await import('../../shared/errors');
const { lockDraft } = await import('../lib/lock-draft');

function database(failAudit = false) {
  let state = {
    data: snapshot(),
    audits: [] as unknown[],
    judgingConfigured: true,
  };
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
      judgingConfiguration: {
        findUnique: async () =>
          draft.judgingConfigured
            ? {
                revision: 1,
                policy: {
                  setupFingerprint: judgingSetupFingerprint(draft.data),
                  endsAt: '2099-01-01T00:00:00.000Z',
                },
                plan: { feasible: true },
              }
            : null,
      },
      judgingCategory: {
        updateMany: async ({
          where,
          data,
        }: {
          where: { hackathonId: string; isEnabled: boolean };
          data: { status: 'ACTIVE'; startedAt: Date };
        }) => {
          assert.equal(where.hackathonId, draft.data.hackathon.id);
          for (const category of draft.data.hackathon.categories) {
            if (category.isEnabled === where.isEnabled)
              Object.assign(category, data);
          }
        },
      },
      rubric: {
        updateMany: async ({
          where,
        }: {
          where: { category: { hackathonId: string; isEnabled: boolean } };
        }) => {
          assert.equal(where.category.hackathonId, draft.data.hackathon.id);
          for (const category of draft.data.hackathon.categories) {
            if (category.isEnabled && category.rubric)
              category.rubric.isLocked = true;
          }
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
  db.read().data.hackathon.projects.push({
    ...db.read().data.hackathon.projects[0]!,
    id: 'duplicate-name',
    tableNumber: 2,
  });
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
  db.read().data.hackathon.projects[0]!.roomId = null;
  db.read().data.hackathon.projects[0]!.tableNumber = null;
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
  db.read().data.judges = [];
  db.read().data.hackathon.categories[0]!.judges = [];
  const categories = structuredClone(db.read().data.hackathon.categories);
  await markHackathonReady(db.ctx, {
    fingerprint: buildSetupSummary(db.read().data).fingerprint,
    acknowledgeWarnings: true,
  });
  assert.equal(db.read().data.hackathon.status, 'READY');
  assert.deepEqual(db.read().data.hackathon.categories, categories);
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

async function readyDatabase(failAudit = false) {
  const db = database(failAudit);
  db.read().data.hackathon.status = 'READY';
  return db;
}

test('starting is scoped and restricted to organizers in Ready', async () => {
  const db = await readyDatabase();
  for (const actor of [
    { type: 'user', userId: 'judge', role: 'JUDGE' },
    { type: 'system', service: 'test' },
  ] as AppContext['actor'][]) {
    await rejectsCode(
      startHackathonJudging({ ...db.ctx, actor }, {}),
      'FORBIDDEN',
    );
  }
  await rejectsCode(
    startHackathonJudging({ ...db.ctx, hackathonId: null }, {}),
    'INVALID_STATE',
  );
  await rejectsCode(
    startHackathonJudging({ ...db.ctx, hackathonId: 'foreign' }, {}),
    'INVALID_STATE',
  );
  for (const status of [
    'DRAFT',
    'JUDGING',
    'PAUSED',
    'DELIBERATION',
    'COMPLETED',
  ] as const) {
    db.read().data.hackathon.status = status;
    await rejectsCode(startHackathonJudging(db.ctx, {}), 'INVALID_STATE');
  }
  assert.equal(db.read().audits.length, 0);
});

test('start activates enabled categories, freezes rubrics and persists the timer with one audit', async () => {
  const db = await readyDatabase();
  const category = db.read().data.hackathon.categories[0]!;
  category.rubric = {
    id: 'rubric',
    categoryId: category.id,
    createdAt: new Date(),
    updatedAt: new Date(),
    isLocked: false,
    criteria: [],
  };
  db.read().data.hackathon.categories.push({
    ...structuredClone(category),
    id: 'disabled',
    isEnabled: false,
  });
  const results = await Promise.allSettled([
    startHackathonJudging(db.ctx, {}),
    startHackathonJudging(db.ctx, {}),
  ]);
  assert.equal(
    results.filter((result) => result.status === 'fulfilled').length,
    1,
  );
  const saved = db.read().data.hackathon;
  assert.equal(saved.status, 'JUDGING');
  assert.equal(saved.categories[0]!.status, 'ACTIVE');
  assert.equal(saved.categories[0]!.rubric!.isLocked, true);
  assert.equal(saved.categories[1]!.status, 'NOT_STARTED');
  assert.equal(saved.categories[1]!.startedAt, null);
  assert.equal(saved.categories[1]!.rubric!.isLocked, false);
  assert.equal(db.read().audits.length, 1);
  const summary = await getHackathonHome(db.ctx, {});
  assert.equal(
    summary.judgingStartedAt,
    saved.categories[0]!.startedAt!.toISOString(),
  );
  await rejectsCode(returnHackathonToDraft(db.ctx, {}), 'INVALID_STATE');
});

test('start revalidates setup and rolls back the stage and categories on failure', async () => {
  const invalid = await readyDatabase();
  invalid.read().data.hackathon.projects[0]!.roomId = null;
  await rejectsCode(startHackathonJudging(invalid.ctx, {}), 'INVALID_STATE');
  assert.equal(invalid.read().data.hackathon.status, 'READY');
  const failing = await readyDatabase(true);
  const before = structuredClone(failing.read());
  await rejectsCode(
    startHackathonJudging(failing.ctx, {}),
    'INTERNAL_SERVER_ERROR',
  );
  assert.deepEqual(failing.read(), before);
});

test('start and return to draft cannot both succeed concurrently', async () => {
  const db = await readyDatabase();
  const outcomes = await Promise.allSettled([
    startHackathonJudging(db.ctx, {}),
    returnHackathonToDraft(db.ctx, {}),
  ]);
  assert.equal(
    outcomes.filter((result) => result.status === 'fulfilled').length,
    1,
  );
  assert.equal(db.read().audits.length, 1);
  assert.equal(db.read().data.hackathon.status, 'JUDGING');
});

test('starting without a frozen judging plan rolls back the stage', async () => {
  const db = await readyDatabase();
  db.read().judgingConfigured = false;
  await rejectsCode(startHackathonJudging(db.ctx, {}), 'INVALID_STATE');
  assert.equal(db.read().data.hackathon.status, 'READY');
});
