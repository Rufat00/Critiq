import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { AppContext } from '../../context';

process.env.DATABASE_URL ??=
  'postgresql://test:test@127.0.0.1:5432/critiq_test';
const { getJudgingCategories } = await import('./get-judging-categories');

function database() {
  const calls: unknown[] = [];
  const data = {
    status: 'DRAFT',
    categories: [
      {
        id: 'ai',
        kind: 'TRACK',
        name: 'AI',
        description: null,
        method: 'RELATIVE',
        track: { id: 'track-ai', _count: { projects: 3 } },
        challenge: null,
      },
      {
        id: 'overall',
        kind: 'OVERALL',
        name: 'Overall',
        description: 'Projects without a specialized track',
        method: 'RELATIVE',
        track: null,
        challenge: null,
      },
      {
        id: 'web',
        kind: 'TRACK',
        name: 'Web',
        description: null,
        method: 'RUBRIC',
        track: { id: 'track-web', _count: { projects: 5 } },
        challenge: null,
      },
      {
        id: 'open',
        kind: 'CHALLENGE',
        name: 'Open challenge',
        description: null,
        method: 'RATING_SCALE',
        track: null,
        challenge: {
          id: 'challenge-open',
          includesOverall: true,
          allowedTracks: [{ trackId: 'track-ai' }, { trackId: 'track-web' }],
          _count: { projectEntries: 6 },
        },
      },
      {
        id: 'restricted',
        kind: 'CHALLENGE',
        name: 'AI challenge',
        description: 'AI projects',
        method: 'RUBRIC',
        track: null,
        challenge: {
          id: 'challenge-limited',
          includesOverall: false,
          allowedTracks: [{ trackId: 'track-ai' }],
          _count: { projectEntries: 2 },
        },
      },
      {
        id: 'unlinked',
        kind: 'CHALLENGE',
        name: 'Unlinked',
        description: null,
        method: 'RATING_SCALE',
        track: null,
        challenge: {
          id: 'challenge-unlinked',
          includesOverall: false,
          allowedTracks: [],
          _count: { projectEntries: 0 },
        },
      },
    ],
  };
  const ctx = {
    db: {
      project: {
        count: async ({
          where,
        }: {
          where: { hackathonId: string; trackId: null };
        }) => {
          assert.deepEqual(where, { hackathonId: 'event', trackId: null });
          return 2;
        },
      },
      hackathon: {
        findUnique: async (query: { where: { id: string } }) => {
          calls.push(query);
          return query.where.id === 'event' ? data : null;
        },
      },
    },
    hackathonId: 'event',
    actor: { type: 'user', userId: 'owner', role: 'OWNER' },
    request: {},
    source: 'web-page',
  } as unknown as AppContext;
  return { ctx, calls };
}

test('category overview resolves Overall, explicit challenge membership, restricted membership, and counts', async () => {
  const db = database();
  const result = await getJudgingCategories(db.ctx, {});
  assert.equal(result.tracks[0]!.id, 'overall');
  assert.equal(
    result.challenges.find((c) => c.id === 'open')!.challengeId,
    'challenge-open',
  );
  assert.equal(
    result.challenges.find((c) => c.id === 'open')!.includesOverall,
    true,
  );
  assert.equal(
    result.challenges.find((c) => c.id === 'restricted')!.includesOverall,
    false,
  );
  assert.equal(result.tracks[0]!.projectCount, 2);
  assert.equal(result.tracks.find((t) => t.id === 'ai')!.projectCount, 3);
  assert.deepEqual(result.challenges.find((c) => c.id === 'open')!.trackIds, [
    'overall',
    'ai',
    'web',
  ]);
  assert.deepEqual(
    result.challenges.find((c) => c.id === 'restricted')!.trackIds,
    ['ai'],
  );
  assert.deepEqual(
    result.challenges.find((c) => c.id === 'unlinked')!.trackIds,
    [],
  );
  assert.equal(
    result.challenges.find((c) => c.id === 'restricted')!.projectCount,
    2,
  );
});

test('category overview rejects judges, missing scope, and unknown scope', async () => {
  const db = database();
  const rejects = (promise: Promise<unknown>, code: string) =>
    assert.rejects(
      promise,
      (e: unknown) =>
        !!e && typeof e === 'object' && 'code' in e && e.code === code,
    );
  await rejects(
    getJudgingCategories(
      { ...db.ctx, actor: { type: 'user', userId: 'judge', role: 'JUDGE' } },
      {},
    ),
    'FORBIDDEN',
  );
  await rejects(
    getJudgingCategories({ ...db.ctx, hackathonId: null }, {}),
    'INVALID_STATE',
  );
  assert.equal(db.calls.length, 0);
  await rejects(
    getJudgingCategories({ ...db.ctx, hackathonId: 'other' }, {}),
    'NOT_FOUND',
  );
});
