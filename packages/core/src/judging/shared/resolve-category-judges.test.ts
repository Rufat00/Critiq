import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolveCategoryJudges } from './resolve-category-judges';
test('track judges receive only challenges open to their track, with no duplicates', () => {
  const categories = [
    {
      id: 'a',
      kind: 'TRACK',
      track: { id: 'track-a' },
      challenge: null,
      judges: [{ userId: 'alice', categoryId: 'a' }],
    },
    {
      id: 'b',
      kind: 'TRACK',
      track: { id: 'track-b' },
      challenge: null,
      judges: [{ userId: 'bob', categoryId: 'b' }],
    },
    {
      id: 'challenge',
      kind: 'CHALLENGE',
      track: null,
      challenge: { allowedTracks: [{ trackId: 'track-a' }] },
      judges: [
        { userId: 'alice', categoryId: 'challenge' },
        { userId: 'specialist', categoryId: 'challenge' },
      ],
    },
    {
      id: 'other',
      kind: 'CHALLENGE',
      track: null,
      challenge: { allowedTracks: [{ trackId: 'track-b' }] },
      judges: [],
    },
  ];
  const resolved = resolveCategoryJudges(categories);
  assert.deepEqual(
    resolved[2]!.judges.map((j) => j.userId),
    ['alice', 'specialist'],
  );
  assert.deepEqual(resolved[3]!.judges, [
    { userId: 'bob', categoryId: 'other' },
  ]);
  assert.equal(categories[3]!.judges.length, 0);
});
