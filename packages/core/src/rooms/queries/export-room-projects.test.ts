import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { AppContext } from '../../context';
process.env.DATABASE_URL ??=
  'postgresql://test:test@127.0.0.1:5432/critiq_test';
const { exportRoomProjects } = await import('./export-room-projects');

function fixture() {
  const queries: Record<string, unknown>[] = [];
  const ctx = {
    db: {
      project: {
        findMany: async (query: Record<string, unknown>) => {
          queries.push(query);
          return Array.from({ length: 30 }, (_, index) => ({
            name:
              index === 0 ? '=HYPERLINK("unsafe")' : 'Project, "é"\nnext line',
            tableNumber: index === 29 ? null : index + 1,
            room:
              index === 29
                ? null
                : { name: 'Hall', description: 'First floor,\nby "stairs"' },
          }));
        },
      },
    },
    actor: { type: 'user', userId: 'admin', role: 'ADMIN' },
    hackathonId: 'event',
    source: 'web-action',
    request: {},
  } as unknown as AppContext;
  return { ctx, queries };
}

test('exports every project with room details, escaped CSV, formula protection, and unassigned locations', async () => {
  const { ctx, queries } = fixture();
  const result = await exportRoomProjects(ctx, {});
  assert.equal(result.projectCount, 30);
  assert.ok(
    result.csv.startsWith(
      '\uFEFF"Project name","Table number","Room name","Room description"\r\n',
    ),
  );
  assert.ok(
    result.csv.includes(
      '"\'=HYPERLINK(""unsafe"")","1","Hall","First floor,\nby ""stairs"""',
    ),
  );
  assert.ok(result.csv.includes('"Project, ""é""\nnext line"'));
  assert.ok(result.csv.endsWith(',"","Unassigned",""\r\n'));
  assert.deepEqual(queries[0]!.where, {
    hackathonId: 'event',
    OR: [{ roomId: null }, { room: { is: { hackathonId: 'event' } } }],
  });
  assert.equal(queries[0]!.take, undefined);
  assert.equal(queries[0]!.skip, undefined);
  assert.deepEqual(queries[0]!.orderBy, [
    { room: { name: 'asc' } },
    { tableNumber: { sort: 'asc', nulls: 'last' } },
    { name: 'asc' },
    { id: 'asc' },
  ]);
});

test('room searches normalize like the overview and scope projects and related rooms', async () => {
  const { ctx, queries } = fixture();
  await exportRoomProjects(ctx, { search: '  North   Hall ' });
  assert.deepEqual(queries[0]!.where, {
    hackathonId: 'event',
    room: {
      is: {
        hackathonId: 'event',
        name: { contains: 'North Hall', mode: 'insensitive' },
      },
    },
  });
});

test('rejects unauthorized roles, missing scope, and invalid input before reading projects', async () => {
  const { ctx, queries } = fixture();
  for (const role of ['JUDGE', 'PARTICIPANT']) {
    await assert.rejects(
      exportRoomProjects(
        {
          ...ctx,
          actor: { type: 'user', userId: 'other', role },
        } as AppContext,
        {},
      ),
      { code: 'FORBIDDEN' },
    );
  }
  await assert.rejects(exportRoomProjects({ ...ctx, hackathonId: null }, {}));
  await assert.rejects(exportRoomProjects(ctx, { search: 'a'.repeat(201) }), {
    code: 'VALIDATION_ERROR',
  });
  assert.equal(queries.length, 0);
});

test('empty exports return a header and zero projects', async () => {
  const { ctx } = fixture();
  ctx.db.project.findMany = (async () => []) as typeof ctx.db.project.findMany;
  const result = await exportRoomProjects(ctx, {});
  assert.equal(result.projectCount, 0);
  assert.equal(
    result.csv,
    '\uFEFF"Project name","Table number","Room name","Room description"\r\n',
  );
});
