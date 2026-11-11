import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { AppContext } from '../../context';
process.env.DATABASE_URL ??=
  'postgresql://test:test@127.0.0.1:5432/critiq_test';
const { updateHackathonSettings } = await import('./update-hackathon-settings');
const { getHackathonSettings } =
  await import('../queries/get-hackathon-settings');
const { AppError } = await import('../../shared/errors');

const input = {
  name: ' New hackathon ',
  scoreScale: 10 as const,
  roomSwitchPercent: 50,
};
function fixture({
  status = 'DRAFT',
  started = false,
  failAudit = false,
} = {}) {
  let state = {
    event: {
      id: 'event',
      name: 'Original',
      scoreScale: 5,
      roomSwitchPercent: 25,
      status,
    },
    audits: [] as unknown[],
  };
  function client(s: typeof state) {
    return {
      hackathon: {
        updateMany: async ({
          where,
        }: {
          where: { id: string; status: string };
        }) => ({
          count:
            where.id === s.event.id && where.status === s.event.status ? 1 : 0,
        }),
        findUnique: async ({ where }: { where: { id: string } }) =>
          where.id === s.event.id ? { ...s.event } : null,
        update: async ({
          where,
          data,
        }: {
          where: { id: string };
          data: typeof input;
        }) => {
          assert.equal(where.id, s.event.id);
          Object.assign(s.event, data);
          return { ...s.event };
        },
      },
      judgingCategory: {
        count: async ({ where }: { where: { hackathonId: string } }) => {
          assert.equal(where.hackathonId, 'event');
          return started ? 1 : 0;
        },
      },
      auditLog: {
        create: async ({ data }: { data: unknown }) => {
          if (failAudit) throw new Error('audit failed');
          s.audits.push(data);
        },
      },
    };
  }
  const db = {
    ...client(state),
    $transaction: async (run: (db: unknown) => Promise<unknown>) => {
      const draft = structuredClone(state);
      const result = await run(client(draft));
      Object.assign(state, draft);
      return result;
    },
  };
  const ctx = {
    db,
    actor: { type: 'user', role: 'OWNER', userId: 'owner' },
    hackathonId: 'event',
    source: 'web-action',
    request: {},
  } as unknown as AppContext;
  return { ctx, read: () => state };
}
const rejects = (operation: Promise<unknown>, code: string) =>
  assert.rejects(
    operation,
    (error: unknown) => error instanceof AppError && error.code === code,
  );

test('settings save trims name, persists scale and every allowed room threshold, and audits', async () => {
  for (let percent = 0; percent <= 100; percent += 5) {
    const f = fixture();
    const saved = await updateHackathonSettings(f.ctx, {
      ...input,
      roomSwitchPercent: percent,
    });
    assert.equal(saved.settings.name, 'New hackathon');
    assert.equal(saved.settings.scoreScale, 10);
    assert.equal(f.read().event.roomSwitchPercent, percent);
    assert.equal(f.read().audits.length, 1);
    assert.equal(
      (await getHackathonSettings(f.ctx, {})).roomSwitchPercent,
      percent,
    );
  }
});
test('invalid names, scales, fractional percentages, bounds and non-five steps cannot write', async () => {
  const f = fixture();
  for (const invalid of [
    { name: ' ' },
    { name: 'a'.repeat(101) },
    { scoreScale: 7 },
    ...[-5, 101, 12, 2.5].map((roomSwitchPercent) => ({ roomSwitchPercent })),
  ]) {
    await rejects(
      updateHackathonSettings(f.ctx, { ...input, ...invalid } as typeof input),
      'VALIDATION_ERROR',
    );
  }
  assert.equal(f.read().audits.length, 0);
  assert.equal(f.read().event.name, 'Original');
});
test('judges and system actors cannot read or write settings', async () => {
  const f = fixture();
  for (const actor of [
    { type: 'user', userId: 'judge', role: 'JUDGE' },
    { type: 'system', service: 'test' },
  ] as AppContext['actor'][]) {
    await rejects(
      updateHackathonSettings({ ...f.ctx, actor }, input),
      'FORBIDDEN',
    );
    await rejects(getHackathonSettings({ ...f.ctx, actor }, {}), 'FORBIDDEN');
  }
});
test('non-draft stages and foreign scope cannot write', async () => {
  for (const status of [
    'READY',
    'JUDGING',
    'PAUSED',
    'DELIBERATION',
    'COMPLETED',
  ]) {
    const f = fixture({ status });
    await rejects(updateHackathonSettings(f.ctx, input), 'INVALID_STATE');
    assert.equal(f.read().event.name, 'Original');
  }
  const f = fixture();
  await rejects(
    updateHackathonSettings({ ...f.ctx, hackathonId: 'foreign' }, input),
    'INVALID_STATE',
  );
  await rejects(
    getHackathonSettings({ ...f.ctx, hackathonId: 'foreign' }, {}),
    'NOT_FOUND',
  );
});
test('score scale cannot change after judging even if the event returns to draft', async () => {
  const f = fixture({ started: true });
  await rejects(updateHackathonSettings(f.ctx, input), 'INVALID_STATE');
  assert.equal(f.read().event.scoreScale, 5);
  await updateHackathonSettings(f.ctx, { ...input, scoreScale: 5 });
});
test('audit failure rolls back all settings', async () => {
  const f = fixture({ failAudit: true });
  const before = structuredClone(f.read());
  await rejects(updateHackathonSettings(f.ctx, input), 'INTERNAL_SERVER_ERROR');
  assert.deepEqual(f.read(), before);
});
