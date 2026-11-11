import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { AppContext } from '../../context';
process.env.DATABASE_URL ??=
  'postgresql://test:test@127.0.0.1:5432/critiq_test';
const { formatHackathon } = await import('./format-hackathon');
const { AppError } = await import('../../shared/errors');
const input = { eventName: 'My event', acknowledged: true as const };
function fixture({ failAudit = false, status = 'JUDGING' } = {}) {
  const state = {
    event: {
      name: 'My event' as string | null,
      status,
      scoreScale: 10,
      roomSwitchPercent: 80,
    },
    deletions: [] as string[],
    audits: 0,
  };
  function client(s: typeof state) {
    const remove = (name: string) => async () => {
      s.deletions.push(name);
      return { count: 2 };
    };
    return {
      hackathon: {
        updateMany: async ({
          where,
          data,
        }: {
          where: { id: string; name: string };
          data: { status: string };
        }) => {
          if (where.id !== 'event' || where.name !== s.event.name)
            return { count: 0 };
          Object.assign(s.event, data);
          return { count: 1 };
        },
        update: async ({
          where,
          data,
        }: {
          where: { id: string };
          data: typeof s.event;
        }) => {
          assert.equal(where.id, 'event');
          Object.assign(s.event, data);
        },
      },
      judgingCategory: {
        findFirst: async () => ({ id: 'overall' }),
        deleteMany: remove('categories'),
        update: async () => {},
      },
      project: { deleteMany: remove('projects') },
      invitation: { deleteMany: remove('invitations') },
      setupCompletion: { deleteMany: remove('setup') },
      rubric: { deleteMany: remove('rubrics') },
      judgeCategory: { deleteMany: remove('memberships') },
      room: { deleteMany: remove('rooms') },
      user: {
        deleteMany: async ({
          where,
        }: {
          where: { id: { not: string }; role: { not: string } };
        }) => {
          assert.equal(where.id.not, 'owner');
          assert.equal(where.role.not, 'OWNER');
          return remove('non-owner accounts')();
        },
      },
      verification: { deleteMany: remove('verification tokens') },
      auditLog: {
        create: async () => {
          if (failAudit) throw new Error('Audit failed');
          s.audits++;
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
    actor: { type: 'user', role: 'OWNER', userId: 'owner' },
    source: 'web-action',
    request: { ipAddress: null, userAgent: null },
  } as unknown as AppContext;
  return { ctx, state };
}
const rejects = (promise: Promise<unknown>, code: string) =>
  assert.rejects(
    promise,
    (error: unknown) => error instanceof AppError && error.code === code,
  );

test('only the owner can format an event', async () => {
  const f = fixture();
  for (const role of ['ADMIN', 'JUDGE'] as const)
    await rejects(
      formatHackathon(
        { ...f.ctx, actor: { type: 'user', userId: 'other', role } },
        input,
      ),
      'FORBIDDEN',
    );
  await rejects(
    formatHackathon(
      { ...f.ctx, actor: { type: 'system', service: 'test' } },
      input,
    ),
    'FORBIDDEN',
  );
  assert.deepEqual(f.state.deletions, []);
});
test('format requires acknowledgment and the exact current scoped event name', async () => {
  const f = fixture();
  await rejects(
    formatHackathon(f.ctx, {
      ...input,
      acknowledged: false,
    } as unknown as typeof input),
    'VALIDATION_ERROR',
  );
  for (const name of ['my event', 'My event ', 'Old event'])
    await rejects(
      formatHackathon(f.ctx, { ...input, eventName: name }),
      'CONFLICT',
    );
  await rejects(
    formatHackathon({ ...f.ctx, hackathonId: 'foreign' }, input),
    'CONFLICT',
  );
  assert.deepEqual(f.state.deletions, []);
  assert.equal(f.state.event.status, 'JUDGING');
});
test('format works at any stage, clears the name, restores defaults, and audits', async () => {
  for (const status of [
    'DRAFT',
    'READY',
    'JUDGING',
    'PAUSED',
    'DELIBERATION',
    'COMPLETED',
  ]) {
    const f = fixture({ status });
    await formatHackathon(f.ctx, input);
    assert.deepEqual(f.state.event, {
      name: null,
      status: 'DRAFT',
      scoreScale: 5,
      roomSwitchPercent: 25,
    });
    assert.equal(f.state.audits, 1);
    assert.ok(f.state.deletions.includes('non-owner accounts'));
    await rejects(formatHackathon(f.ctx, input), 'CONFLICT');
    assert.equal(f.state.audits, 1);
  }
});
test('audit failure rolls back all deletion and default changes', async () => {
  const f = fixture({ failAudit: true });
  const before = structuredClone(f.state);
  await rejects(formatHackathon(f.ctx, input), 'INTERNAL_SERVER_ERROR');
  assert.deepEqual(f.state, before);
});
