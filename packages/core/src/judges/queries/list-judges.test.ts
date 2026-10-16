import assert from 'node:assert/strict';
import { test } from 'node:test';
process.env.DATABASE_URL ??=
  'postgresql://test:test@127.0.0.1:5432/critiq_test';
const { listJudges } = await import('./list-judges');
const { judgeDatabase } = await import('../lib/judges.fixture');
const { paginationMetadata } =
  await import('../../shared/pagination/pagination');

test('search is normalized, scope matches the count query, pagination takes the requested slice', async () => {
  const db = judgeDatabase();
  const result = await listJudges(db.ctx, {
    filters: { categoryId: 'overall' },
    search: '  Judge   Name  ',
    pagination: { page: 2, pageSize: 25 },
  });
  assert.equal(result.items.length, 12);
  assert.equal(result.items[0]!.id, '25');
  assert.deepEqual(result.pagination, {
    page: 2,
    pageSize: 25,
    totalItems: 37,
    totalPages: 2,
    hasNextPage: false,
    hasPreviousPage: true,
  });
  assert.deepEqual(db.whereReads[0], db.whereReads[1]);
  assert.match(JSON.stringify(db.whereReads[0]), /Judge Name/u);
  assert.match(JSON.stringify(db.whereReads[0]), /event/u);
  assert.match(JSON.stringify(db.whereReads[0]), /JUDGE/u);
});

test('empty pagination retains requested page and disables both navigation flags', () => {
  assert.deepEqual(paginationMetadata(8, 25, 0), {
    page: 8,
    pageSize: 25,
    totalItems: 0,
    totalPages: 0,
    hasNextPage: false,
    hasPreviousPage: false,
  });
});

test('list rejects unauthorized roles, foreign categories, and unsupported page sizes', async () => {
  const db = judgeDatabase();
  await assert.rejects(
    listJudges(
      { ...db.ctx, actor: { type: 'user', userId: 'judge', role: 'JUDGE' } },
      { filters: { categoryId: 'overall' } },
    ),
    { code: 'FORBIDDEN' },
  );
  await assert.rejects(
    listJudges(db.ctx, { filters: { categoryId: 'foreign' } }),
    { code: 'NOT_FOUND' },
  );
  await assert.rejects(
    listJudges(db.ctx, {
      filters: { categoryId: 'overall' },
      pagination: { pageSize: 11 as 10 },
    }),
    { code: 'VALIDATION_ERROR' },
  );
});
