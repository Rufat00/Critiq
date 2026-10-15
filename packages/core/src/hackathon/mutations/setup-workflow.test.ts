import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { AppContext } from '../../context';
import { snapshot } from '../lib/setup-snapshot.fixture';
import { buildSetupSummary } from '../lib/build-setup-summary';

process.env.DATABASE_URL ??=
  'postgresql://test:test@127.0.0.1:5432/critiq_test';
const { getHackathonHome } = await import('../queries/get-hackathon-home');
const { setSetupCompletion } = await import('./set-setup-completion');
const { markHackathonReady } = await import('./mark-hackathon-ready');
const { returnHackathonToDraft } = await import('./return-hackathon-to-draft');
const { AppError } = await import('../../shared/errors');

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
      setupCompletion: {
        deleteMany: async ({
          where,
        }: {
          where: { hackathonId: string; section: string };
        }) => {
          const before = draft.data.hackathon.setupCompletions.length;
          draft.data.hackathon.setupCompletions =
            draft.data.hackathon.setupCompletions.filter(
              (completion) =>
                completion.hackathonId !== where.hackathonId ||
                completion.section !== where.section,
            );
          return {
            count: before - draft.data.hackathon.setupCompletions.length,
          };
        },
        upsert: async ({
          create,
        }: {
          create: (typeof draft.data.hackathon.setupCompletions)[number];
        }) => {
          draft.data.hackathon.setupCompletions = [
            ...draft.data.hackathon.setupCompletions.filter(
              (r) => r.section !== create.section,
            ),
            create,
          ];
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

function completeChecklist(db: ReturnType<typeof database>) {
  const data = db.read().data;
  data.hackathon.rooms.push({
    id: 'room',
    isActive: true,
    trackRooms: [],
  } as unknown as (typeof data.hackathon.rooms)[number]);
  data.hackathon.categories.push({
    ...data.hackathon.categories[0]!,
    id: 'challenge',
    name: 'Optional challenge',
    kind: 'CHALLENGE',
    isEnabled: false,
  });
  data.hackathon.setupCompletions = buildSetupSummary(data)
    .sections.filter((section) => section.id !== 'event')
    .map((section) => ({
      hackathonId: data.hackathon.id,
      section: section.id,
      fingerprint: section.fingerprint,
      completedById: 'owner',
      completedAt: new Date(),
    }));
}

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

test('completions persist with audits, stale confirmations fail, audit failure rolls back', async () => {
  const db = database();
  const input = {
    section: 'projects' as const,
    completed: true,
    fingerprint: buildSetupSummary(db.read().data).sections[2]!.fingerprint,
  };
  await setSetupCompletion(db.ctx, input);
  assert.equal(db.read().data.hackathon.setupCompletions.length, 1);
  assert.equal(db.read().audits.length, 1);
  db.read().data.hackathon.projects[0]!.name = 'Changed';
  await rejectsCode(setSetupCompletion(db.ctx, input), 'CONFLICT');
  const failing = database(true);
  await rejectsCode(
    setSetupCompletion(failing.ctx, input),
    'INTERNAL_SERVER_ERROR',
  );
  assert.equal(failing.read().data.hackathon.setupCompletions.length, 0);
});

test('warnings need explicit acknowledgement; readiness transitions are atomic and reject duplicates', async () => {
  const db = database();
  completeChecklist(db);
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
  await rejectsCode(
    setSetupCompletion(db.ctx, {
      section: 'event',
      completed: true,
      fingerprint: buildSetupSummary(db.read().data).sections[0]!.fingerprint,
    }),
    'INVALID_STATE',
  );
  await returnHackathonToDraft(db.ctx, {});
  assert.equal(db.read().data.hackathon.status, 'DRAFT');
});

test('blocking errors cannot be overridden and stage changes roll back on audit failure', async () => {
  const db = database();
  db.read().data.judges[0]!.conflicts = [
    { projectId: 'project' },
  ] as ReturnType<typeof db.read>['data']['judges'][number]['conflicts'];
  completeChecklist(db);
  await rejectsCode(
    markHackathonReady(db.ctx, {
      fingerprint: buildSetupSummary(db.read().data).fingerprint,
      acknowledgeWarnings: true,
    }),
    'INVALID_STATE',
  );
  const failing = database(true);
  completeChecklist(failing);
  await rejectsCode(
    markHackathonReady(failing.ctx, {
      fingerprint: buildSetupSummary(failing.read().data).fingerprint,
      acknowledgeWarnings: true,
    }),
    'INTERNAL_SERVER_ERROR',
  );
  assert.equal(failing.read().data.hackathon.status, 'DRAFT');
});

test('post-start stages cannot reopen draft or accept completion changes', async () => {
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
      setSetupCompletion(db.ctx, {
        section: 'event',
        completed: true,
        fingerprint: buildSetupSummary(db.read().data).sections[0]!.fingerprint,
      }),
      'INVALID_STATE',
    );
  }
});

test('completion can be undone and cannot be set for unconfigured sections', async () => {
  const db = database();
  const projects = buildSetupSummary(db.read().data).sections.find(
    (s) => s.id === 'projects',
  )!;
  const input = {
    section: 'projects' as const,
    fingerprint: projects.fingerprint,
    completed: true,
  };
  await setSetupCompletion(db.ctx, input);
  assert.equal(buildSetupSummary(db.read().data).completeCount, 2);
  await setSetupCompletion(db.ctx, { ...input, completed: false });
  assert.equal(db.read().data.hackathon.setupCompletions.length, 0);
  assert.equal(buildSetupSummary(db.read().data).completeCount, 1);
  assert.equal(db.read().audits.length, 2);
  for (const section of buildSetupSummary(db.read().data).sections.filter(
    (s) => !s.canComplete,
  )) {
    await rejectsCode(
      setSetupCompletion(db.ctx, {
        section: section.id,
        fingerprint: section.fingerprint,
        completed: true,
      }),
      'INVALID_STATE',
    );
  }
});

test('unauthorized actors and foreign scopes cannot change checklist completion', async () => {
  const db = database();
  const input = {
    section: 'event' as const,
    fingerprint: buildSetupSummary(db.read().data).sections[0]!.fingerprint,
    completed: true,
  };
  await rejectsCode(
    setSetupCompletion(
      { ...db.ctx, actor: { type: 'user', userId: 'judge', role: 'JUDGE' } },
      input,
    ),
    'FORBIDDEN',
  );
  await rejectsCode(
    setSetupCompletion({ ...db.ctx, hackathonId: 'other' }, input),
    'INVALID_STATE',
  );
  assert.equal(db.read().data.hackathon.setupCompletions.length, 0);
});

test('automatic event completion cannot be toggled through the server operation', async () => {
  const db = database();
  const fingerprint = buildSetupSummary(db.read().data).sections[0]!
    .fingerprint;
  for (const completed of [false, true]) {
    await rejectsCode(
      setSetupCompletion(db.ctx, { section: 'event', fingerprint, completed }),
      'INVALID_STATE',
    );
  }
  assert.equal(buildSetupSummary(db.read().data).sections[0]!.done, true);
  assert.equal(db.read().data.hackathon.setupCompletions.length, 0);
  assert.equal(db.read().audits.length, 0);
});

test('Ready is blocked server-side until every checklist item is complete', async () => {
  const db = database();
  const input = () => ({
    fingerprint: buildSetupSummary(db.read().data).fingerprint,
    acknowledgeWarnings: true,
  });
  await assert.rejects(
    markHackathonReady(db.ctx, input()),
    (error: unknown) =>
      error instanceof AppError &&
      error.code === 'INVALID_STATE' &&
      error.message.includes('Complete your checklist'),
  );
  assert.equal(db.read().data.hackathon.status, 'DRAFT');
  completeChecklist(db);
  const room = buildSetupSummary(db.read().data).sections.find(
    (section) => section.id === 'rooms',
  )!;
  await setSetupCompletion(db.ctx, {
    section: 'rooms',
    fingerprint: room.fingerprint,
    completed: false,
  });
  await rejectsCode(markHackathonReady(db.ctx, input()), 'INVALID_STATE');
  assert.equal(db.read().data.hackathon.status, 'DRAFT');
});
