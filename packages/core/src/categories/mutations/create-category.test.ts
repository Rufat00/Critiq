import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { AppContext } from '../../context';
import type { CreateCategoryInput } from '../schemas/create-category-schema';

process.env.DATABASE_URL ??=
  'postgresql://test:test@127.0.0.1:5432/critiq_test';
const { createCategory } = await import('./create-category');
const { AppError } = await import('../../shared/errors');

type CategoryWrite = {
  hackathonId: string;
  kind: string;
  name: string;
  description: string | null;
  method: string;
  track?: {
    create: {
      hackathonId: string;
      disqualifiesFromOverall: boolean;
      allowedChallenges?: { create: { challengeId: string }[] };
    };
  };
  challenge?: {
    create: {
      hackathonId: string;
      includesOverall: boolean;
      allowedTracks?: { create: { trackId: string }[] };
    };
  };
  rubric?: {
    create: {
      criteria: {
        create: { name: string; weight: number; position: number }[];
      };
    };
  };
};
function database({ status = 'DRAFT', failAudit = false } = {}) {
  let state = {
    status,
    categories: [] as CategoryWrite[],
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
          count: Number(where.id === 'event' && where.status === draft.status),
        }),
      },
      judgingCategory: {
        findFirst: async ({
          where,
        }: {
          where: { hackathonId: string; name: { equals: string } };
        }) =>
          draft.categories.find(
            (category) =>
              category.hackathonId === where.hackathonId &&
              category.name.toLowerCase() === where.name.equals.toLowerCase(),
          ) ?? null,
        create: async ({ data }: { data: CategoryWrite }) => {
          draft.categories.push(data);
          return {
            id: `category-${draft.categories.length}`,
            name: data.name,
            kind: data.kind,
            description: data.description,
            method: data.method,
          };
        },
      },
      track: {
        findMany: async ({
          where,
        }: {
          where: {
            hackathonId: string;
            id: { in: string[] };
            category: { hackathonId: string; kind: string };
          };
        }) => {
          assert.deepEqual(where.category, {
            hackathonId: 'event',
            kind: 'TRACK',
          });
          return where.hackathonId === 'event'
            ? [{ id: 'track-one' }].filter((row) =>
                where.id.in.includes(row.id),
              )
            : [];
        },
      },
      challenge: {
        findMany: async ({
          where,
        }: {
          where: {
            hackathonId: string;
            id: { in: string[] };
            category: { hackathonId: string; kind: string };
          };
        }) => {
          assert.deepEqual(where.category, {
            hackathonId: 'event',
            kind: 'CHALLENGE',
          });
          return where.hackathonId === 'event'
            ? [
                { id: 'challenge-limited', includesOverall: false },
                { id: 'challenge-overall', includesOverall: true },
              ].filter((row) => where.id.in.includes(row.id))
            : [];
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
const base = { kind: 'TRACK', name: ' AI ', method: 'RELATIVE' } as const;
const rubric = {
  ...base,
  method: 'RUBRIC',
  criteria: [
    { name: ' Impact ', weight: 40 },
    { name: 'Execution', weight: 60 },
  ],
} as const;
const rejects = (promise: Promise<unknown>, code: string) =>
  assert.rejects(
    promise,
    (e: unknown) => e instanceof AppError && e.code === code,
  );
const rubricInput = (): CreateCategoryInput => ({
  ...rubric,
  criteria: rubric.criteria.map((item) => ({ ...item })),
});

test('creation trims input, scopes subtype, enforces track exclusion, and audits', async () => {
  const db = database();
  const result = await createCategory(db.ctx, base);
  assert.equal(result.name, 'AI');
  assert.equal(db.read().categories[0]!.description, null);
  assert.deepEqual(db.read().categories[0]!.track, {
    create: { hackathonId: 'event', disqualifiesFromOverall: true },
  });
  assert.equal(db.read().categories[0]!.challenge, undefined);
  assert.equal(db.read().categories[0]!.rubric, undefined);
  assert.equal(db.read().audits.length, 1);
});

test('challenge creation defaults to Overall and rubric criteria persist in order as percentages', async () => {
  const db = database();
  await createCategory(db.ctx, {
    kind: 'CHALLENGE',
    name: 'Sponsor prize',
    method: 'RATING_SCALE',
    description: ' Optional award ',
  });
  assert.deepEqual(db.read().categories[0]!.challenge, {
    create: { hackathonId: 'event', includesOverall: true },
  });
  assert.equal(db.read().categories[0]!.description, 'Optional award');
  await createCategory(db.ctx, rubricInput());
  assert.deepEqual(db.read().categories[1]!.rubric?.create.criteria.create, [
    { name: 'Impact', weight: 40, position: 0 },
    { name: 'Execution', weight: 60, position: 1 },
  ]);
  assert.equal(db.read().audits.length, 2);
});

test('creation rejects invalid methods, titles, rubric totals, bounds, and duplicate item names before writing', async () => {
  const db = database();
  const invalid: CreateCategoryInput[] = [
    { ...base, name: ' ' },
    { ...base, name: 'a'.repeat(101) },
    { ...base, description: 'a'.repeat(2001) },
    { ...base, method: 'RATING_SCALE' },
    { ...base, kind: 'CHALLENGE' },
    { ...base, method: 'RUBRIC' },
    { ...base, criteria: [{ name: 'Unexpected', weight: 100 }] },
    { ...rubricInput(), criteria: [{ name: 'A', weight: 20 }] },
    { ...rubricInput(), criteria: [{ name: 'A', weight: 101 }] },
    {
      ...rubricInput(),
      criteria: [
        { name: 'A', weight: 0 },
        { name: 'B', weight: 100 },
      ],
    },
    {
      ...rubricInput(),
      criteria: [
        { name: 'A', weight: 49.5 },
        { name: 'B', weight: 50.5 },
      ],
    },
    { ...rubricInput(), criteria: [{ name: ' ', weight: 100 }] },
    {
      ...rubricInput(),
      criteria: [
        { name: 'Impact', weight: 50 },
        { name: ' impact ', weight: 50 },
      ],
    },
    {
      ...rubricInput(),
      criteria: Array.from({ length: 101 }, (_, i) => ({
        name: `Item ${i}`,
        weight: 1,
      })),
    },
  ];
  for (const input of invalid)
    await rejects(createCategory(db.ctx, input), 'VALIDATION_ERROR');
  assert.equal(db.read().categories.length, 0);
  assert.equal(db.read().audits.length, 0);
});

test('creation authorizes organizers and rejects missing or foreign scope and locked stages', async () => {
  const db = database();
  for (const actor of [
    { type: 'user', userId: 'judge', role: 'JUDGE' },
    { type: 'system', service: 'test' },
  ] as AppContext['actor'][])
    await rejects(createCategory({ ...db.ctx, actor }, base), 'FORBIDDEN');
  await rejects(
    createCategory({ ...db.ctx, hackathonId: null }, base),
    'INVALID_STATE',
  );
  await rejects(
    createCategory({ ...db.ctx, hackathonId: 'foreign' }, base),
    'INVALID_STATE',
  );
  for (const status of [
    'READY',
    'JUDGING',
    'PAUSED',
    'DELIBERATION',
    'COMPLETED',
  ]) {
    const locked = database({ status });
    await rejects(createCategory(locked.ctx, base), 'INVALID_STATE');
    assert.equal(locked.read().categories.length, 0);
  }
  assert.equal(db.read().categories.length, 0);
});

test('concurrent duplicate creates are serialized with only one committed category and audit', async () => {
  const db = database();
  const results = await Promise.allSettled([
    createCategory(db.ctx, base),
    createCategory(db.ctx, { ...base, name: 'ai' }),
  ]);
  assert.equal(
    results.filter((result) => result.status === 'fulfilled').length,
    1,
  );
  assert.equal(db.read().categories.length, 1);
  assert.equal(db.read().audits.length, 1);
  await assert.rejects(
    createCategory(db.ctx, base),
    (e: unknown) =>
      e instanceof AppError && e.code === 'CONFLICT' && !!e.fieldErrors?.name,
  );
});

test('audit failure rolls back the new category, subtype, and nested rubric', async () => {
  const db = database({ failAudit: true });
  await rejects(createCategory(db.ctx, rubricInput()), 'INTERNAL_SERVER_ERROR');
  assert.equal(db.read().categories.length, 0);
  assert.equal(db.read().audits.length, 0);
});

test('selected memberships persist explicitly on the correct subtype', async () => {
  const db = database();
  const challenge = await createCategory(db.ctx, {
    kind: 'CHALLENGE',
    name: 'Limited prize',
    method: 'RATING_SCALE',
    includesOverall: false,
    trackIds: ['track-one'],
  });
  assert.deepEqual(db.read().categories[0]!.challenge?.create, {
    hackathonId: 'event',
    includesOverall: false,
    allowedTracks: { create: [{ trackId: 'track-one' }] },
  });
  assert.deepEqual(challenge.trackIds, ['track-one']);
  const track = await createCategory(db.ctx, {
    ...base,
    challengeIds: ['challenge-limited', 'challenge-overall'],
  });
  assert.deepEqual(
    db.read().categories[1]!.track?.create.allowedChallenges?.create,
    [
      { challengeId: 'challenge-limited' },
      { challengeId: 'challenge-overall' },
    ],
  );
  assert.deepEqual(track.challengeIds, [
    'challenge-limited',
    'challenge-overall',
  ]);
  assert.equal(db.read().audits.length, 2);
});

test('Overall and specialized tracks can be selected together without enrolling future tracks', async () => {
  const db = database();
  const result = await createCategory(db.ctx, {
    kind: 'CHALLENGE',
    name: 'Mixed membership',
    method: 'RATING_SCALE',
    includesOverall: true,
    trackIds: ['track-one'],
  });
  assert.equal(result.includesOverall, true);
  assert.deepEqual(result.trackIds, ['track-one']);
  assert.deepEqual(db.read().categories[0]!.challenge?.create, {
    hackathonId: 'event',
    includesOverall: true,
    allowedTracks: { create: [{ trackId: 'track-one' }] },
  });
});

test('foreign or missing membership IDs cannot create a category or audit', async () => {
  const db = database();
  await rejects(
    createCategory(db.ctx, { ...base, challengeIds: ['foreign-challenge'] }),
    'NOT_FOUND',
  );
  await rejects(
    createCategory(db.ctx, {
      kind: 'CHALLENGE',
      name: 'Challenge',
      method: 'RATING_SCALE',
      includesOverall: false,
      trackIds: ['foreign-track'],
    }),
    'NOT_FOUND',
  );
  assert.equal(db.read().categories.length, 0);
  assert.equal(db.read().audits.length, 0);
});

test('membership options reject conflicting modes, wrong subtype, duplicate IDs, and empty restricted selection', async () => {
  const db = database();
  const challenge = {
    kind: 'CHALLENGE',
    name: 'Challenge',
    method: 'RATING_SCALE',
  } as const;
  const invalid: CreateCategoryInput[] = [
    { ...base, includesOverall: false },
    { ...base, trackIds: ['track-one'] },
    { ...base, challengeIds: ['challenge-limited', 'challenge-limited'] },
    { ...challenge, challengeIds: ['challenge-limited'] },
    { ...challenge, includesOverall: false, trackIds: [] },
    {
      ...challenge,
      includesOverall: false,
      trackIds: ['track-one', 'track-one'],
    },
    {
      ...rubricInput(),
      criteria: [
        { name: 'A', weight: 15 },
        { name: 'B', weight: 85 },
      ],
    },
  ];
  for (const input of invalid)
    await rejects(createCategory(db.ctx, input), 'VALIDATION_ERROR');
  assert.equal(db.read().categories.length, 0);
});

test('membership links roll back with category creation if the audit fails', async () => {
  const db = database({ failAudit: true });
  await rejects(
    createCategory(db.ctx, { ...base, challengeIds: ['challenge-limited'] }),
    'INTERNAL_SERVER_ERROR',
  );
  assert.equal(db.read().categories.length, 0);
  assert.equal(db.read().audits.length, 0);
});
