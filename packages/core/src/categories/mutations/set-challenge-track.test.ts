import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { AppContext } from '../../context';
import type { SetChallengeTrackInput } from '../schemas/set-challenge-track-schema';

process.env.DATABASE_URL ??=
  'postgresql://test:test@127.0.0.1:5432/critiq_test';
const { setChallengeTrack } = await import('./set-challenge-track');
const { AppError } = await import('../../shared/errors');

function database({
  failAudit = false,
  status = 'DRAFT',
  corruptSubtype = false,
} = {}) {
  let state = {
    included: false,
    includesOverall: true,
    entries: 0,
    writes: 0,
    audits: [] as unknown[],
  };
  let queue = Promise.resolve();
  function client(draft: typeof state) {
    return {
      hackathon: {
        updateMany: async ({
          where,
        }: {
          where: { id: string; status: string };
        }) => ({
          count: Number(where.id === 'event' && where.status === status),
        }),
      },
      judgingCategory: {
        findFirst: async ({
          where,
        }: {
          where: {
            id: string;
            hackathonId: string;
            kind: string | { in: string[] };
          };
        }) => {
          if (where.hackathonId !== 'event') return null;
          const matches = (kind: string) =>
            typeof where.kind === 'string'
              ? where.kind === kind
              : where.kind.in.includes(kind);
          if (where.id === 'track-category' && matches('TRACK'))
            return {
              id: where.id,
              name: 'AI',
              kind: 'TRACK',
              track: {
                id: 'track',
                hackathonId: corruptSubtype ? 'foreign' : 'event',
              },
            };
          if (where.id === 'overall-category' && matches('OVERALL'))
            return {
              id: where.id,
              name: 'Overall',
              kind: 'OVERALL',
              track: null,
            };
          if (where.id === 'challenge-category' && matches('CHALLENGE'))
            return {
              id: where.id,
              name: 'Impact',
              challenge: {
                id: 'challenge',
                hackathonId: corruptSubtype ? 'foreign' : 'event',
                includesOverall: draft.includesOverall,
              },
            };
          return null;
        },
      },
      challengeTrack: {
        findUnique: async ({
          where,
        }: {
          where: {
            challengeId_trackId: { challengeId: string; trackId: string };
          };
        }) => {
          assert.deepEqual(where.challengeId_trackId, {
            challengeId: 'challenge',
            trackId: 'track',
          });
          return draft.included ? { challengeId: 'challenge' } : null;
        },
        upsert: async ({
          create,
        }: {
          create: { challengeId: string; trackId: string };
        }) => {
          assert.deepEqual(create, {
            challengeId: 'challenge',
            trackId: 'track',
          });
          draft.included = true;
          draft.writes++;
        },
        deleteMany: async ({
          where,
        }: {
          where: { challengeId: string; trackId: string };
        }) => {
          assert.deepEqual(where, {
            challengeId: 'challenge',
            trackId: 'track',
          });
          draft.included = false;
          draft.writes++;
        },
      },
      challenge: {
        update: async ({
          where,
          data,
        }: {
          where: { id: string; hackathonId: string };
          data: { includesOverall: boolean };
        }) => {
          assert.deepEqual(where, { id: 'challenge', hackathonId: 'event' });
          draft.includesOverall = data.includesOverall;
          draft.writes++;
        },
      },
      projectChallenge: {
        count: async ({
          where,
        }: {
          where: {
            challengeId: string;
            project: { hackathonId: string; trackId: string | null };
          };
        }) => {
          assert.equal(where.challengeId, 'challenge');
          assert.equal(where.project.hackathonId, 'event');
          assert.ok(
            where.project.trackId === null || where.project.trackId === 'track',
          );
          return draft.entries;
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
const input = {
  trackCategoryId: 'track-category',
  challengeCategoryId: 'challenge-category',
  included: true,
};
const rejects = (promise: Promise<unknown>, code: string) =>
  assert.rejects(
    promise,
    (e: unknown) => e instanceof AppError && e.code === code,
  );

test('membership adds and removes one specialized track with before/after audit', async () => {
  const db = database();
  const added = await setChallengeTrack(db.ctx, input);
  assert.equal(added.previouslyIncluded, false);
  assert.equal(db.read().included, true);
  await setChallengeTrack(db.ctx, { ...input, included: false });
  assert.equal(db.read().included, false);
  assert.equal(db.read().includesOverall, true);
  assert.equal(db.read().audits.length, 2);
  const audit = db.read().audits[0] as {
    actorId: string;
    hackathonId: string;
    metadata: { before: { included: boolean }; after: { included: boolean } };
  };
  assert.equal(audit.actorId, 'owner');
  assert.equal(audit.hackathonId, 'event');
  assert.equal(audit.metadata.before.included, false);
  assert.equal(audit.metadata.after.included, true);
});

test('Overall membership is independent of specialized-track membership', async () => {
  const db = database();
  await setChallengeTrack(db.ctx, input);
  await setChallengeTrack(db.ctx, {
    ...input,
    trackCategoryId: 'overall-category',
    included: false,
  });
  assert.equal(db.read().included, true);
  assert.equal(db.read().includesOverall, false);
  await setChallengeTrack(db.ctx, {
    ...input,
    trackCategoryId: 'overall-category',
    included: true,
  });
  assert.equal(db.read().includesOverall, true);
});

test('membership authorizes organizers, validates IDs and types, and rejects foreign scopes and subtypes', async () => {
  const db = database();
  for (const actor of [
    { type: 'user', userId: 'judge', role: 'JUDGE' },
    { type: 'system', service: 'test' },
  ] as AppContext['actor'][])
    await rejects(setChallengeTrack({ ...db.ctx, actor }, input), 'FORBIDDEN');
  await rejects(
    setChallengeTrack({ ...db.ctx, hackathonId: null }, input),
    'INVALID_STATE',
  );
  await rejects(
    setChallengeTrack({ ...db.ctx, hackathonId: 'foreign' }, input),
    'INVALID_STATE',
  );
  await rejects(
    setChallengeTrack(db.ctx, { ...input, trackCategoryId: 'foreign' }),
    'NOT_FOUND',
  );
  await rejects(
    setChallengeTrack(db.ctx, {
      ...input,
      challengeCategoryId: 'track-category',
    }),
    'NOT_FOUND',
  );
  await rejects(
    setChallengeTrack(db.ctx, {
      ...input,
      trackCategoryId: 'challenge-category',
    }),
    'NOT_FOUND',
  );
  await rejects(
    setChallengeTrack(db.ctx, { ...input, challengeCategoryId: '' }),
    'VALIDATION_ERROR',
  );
  await rejects(
    setChallengeTrack(db.ctx, {
      ...input,
      included: 'true',
    } as unknown as SetChallengeTrackInput),
    'VALIDATION_ERROR',
  );
  const corrupt = database({ corruptSubtype: true });
  await rejects(setChallengeTrack(corrupt.ctx, input), 'NOT_FOUND');
  await rejects(
    setChallengeTrack(corrupt.ctx, {
      ...input,
      trackCategoryId: 'overall-category',
    }),
    'NOT_FOUND',
  );
  assert.equal(db.read().writes, 0);
  assert.equal(db.read().audits.length, 0);
});

test('membership is locked outside Draft', async () => {
  for (const status of [
    'READY',
    'JUDGING',
    'PAUSED',
    'DELIBERATION',
    'COMPLETED',
  ]) {
    const db = database({ status });
    await rejects(setChallengeTrack(db.ctx, input), 'INVALID_STATE');
    assert.equal(db.read().writes, 0);
  }
});

test('memberships with existing project entries cannot be removed, including Overall', async () => {
  const db = database();
  await setChallengeTrack(db.ctx, input);
  db.read().entries = 1;
  await rejects(
    setChallengeTrack(db.ctx, { ...input, included: false }),
    'CONFLICT',
  );
  await rejects(
    setChallengeTrack(db.ctx, {
      ...input,
      trackCategoryId: 'overall-category',
      included: false,
    }),
    'CONFLICT',
  );
  assert.equal(db.read().included, true);
  assert.equal(db.read().includesOverall, true);
  assert.equal(db.read().audits.length, 1);
});

test('concurrent duplicate membership changes are idempotent and audit failure rolls back', async () => {
  const db = database();
  await Promise.all([
    setChallengeTrack(db.ctx, input),
    setChallengeTrack(db.ctx, input),
  ]);
  assert.equal(db.read().included, true);
  assert.equal(db.read().writes, 1);
  const failing = database({ failAudit: true });
  await rejects(setChallengeTrack(failing.ctx, input), 'INTERNAL_SERVER_ERROR');
  assert.equal(failing.read().included, false);
  assert.equal(failing.read().audits.length, 0);
});
