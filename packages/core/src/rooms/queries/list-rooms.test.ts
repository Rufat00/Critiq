import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { AppContext } from '../../context';
process.env.DATABASE_URL ??=
  'postgresql://test:test@127.0.0.1:5432/critiq_test';
const { listRooms } = await import('./list-rooms');
const { getRoom } = await import('./get-room');

test('overview normalizes search, uses the same scoped room filter for items/count, and keeps global summary counts', async () => {
  let listWhere: unknown;
  const projectFilters: unknown[] = [];
  const db = {
    hackathon: { findUnique: async () => ({ status: 'READY' }) },
    room: {
      findMany: async ({
        where,
        skip,
        take,
        select,
      }: {
        where: unknown;
        skip: number;
        take: number;
        select: { _count: unknown; trackRooms: { where: unknown } };
      }) => {
        listWhere = where;
        assert.equal(skip, 25);
        assert.equal(take, 25);
        assert.deepEqual(select._count, {
          select: { projects: { where: { hackathonId: 'event' } } },
        });
        assert.deepEqual(select.trackRooms.where, {
          track: { hackathonId: 'event' },
        });
        return [{ id: 'room' }];
      },
      count: async ({ where }: { where: { name?: unknown } }) => {
        if (where.name) {
          assert.deepEqual(where, listWhere);
          return 30;
        }
        assert.deepEqual(where, { hackathonId: 'event' });
        return 50;
      },
    },
    project: {
      count: async ({
        where,
      }: {
        where: { hackathonId: string; roomId: unknown };
      }) => {
        assert.equal(where.hackathonId, 'event');
        projectFilters.push(where);
        return where.roomId === null ? 7 : 42;
      },
    },
    track: {
      findMany: async ({ where }: { where: unknown }) => {
        assert.deepEqual(where, {
          hackathonId: 'event',
          category: {
            hackathonId: 'event',
            kind: { in: ['OVERALL', 'TRACK'] },
          },
        });
        return [];
      },
    },
  };
  const ctx = {
    db,
    actor: { type: 'user', userId: 'admin', role: 'ADMIN' },
    hackathonId: 'event',
    source: 'web-page',
    request: {},
  } as unknown as AppContext;
  const data = await listRooms(ctx, {
    search: '  North   Hall ',
    pagination: { page: 2, pageSize: 25 },
  });
  assert.deepEqual(listWhere, {
    hackathonId: 'event',
    name: { contains: 'North Hall', mode: 'insensitive' },
  });
  assert.deepEqual(data.summary, { rooms: 50, placed: 42, unassigned: 7 });
  assert.deepEqual(data.pagination, {
    page: 2,
    pageSize: 25,
    totalItems: 30,
    totalPages: 2,
    hasNextPage: false,
    hasPreviousPage: true,
  });
  assert.equal(data.locked, true);
  assert.deepEqual(projectFilters, [
    { hackathonId: 'event', roomId: { not: null } },
    { hackathonId: 'event', roomId: null },
  ]);
});
test('empty searches retain requested pages and disable both pagination directions', async () => {
  const db = {
    hackathon: { findUnique: async () => ({ status: 'DRAFT' }) },
    room: { findMany: async () => [], count: async () => 0 },
    project: { count: async () => 0 },
    track: { findMany: async () => [] },
  };
  const ctx = {
    db,
    actor: { type: 'user', userId: 'admin', role: 'ADMIN' },
    hackathonId: 'event',
    source: 'web-page',
    request: {},
  } as unknown as AppContext;
  const data = await listRooms(ctx, { pagination: { page: 4, pageSize: 10 } });
  assert.equal(data.pagination.page, 4);
  assert.equal(data.pagination.totalPages, 0);
  assert.equal(data.pagination.hasNextPage, false);
  assert.equal(data.pagination.hasPreviousPage, false);
  assert.equal(data.locked, false);
});
test('room details scope both assigned projects and configured tracks to the trusted hackathon', async () => {
  const db = {
    room: {
      findFirst: async ({
        where,
        select,
      }: {
        where: unknown;
        select: {
          projects: { where: unknown };
          trackRooms: { where: unknown };
        };
      }) => {
        assert.deepEqual(where, { id: 'room', hackathonId: 'event' });
        assert.deepEqual(select.projects.where, { hackathonId: 'event' });
        assert.deepEqual(select.trackRooms.where, {
          track: { hackathonId: 'event' },
        });
        return { id: 'room', projects: [], trackRooms: [] };
      },
    },
  };
  const ctx = {
    db,
    actor: { type: 'user', userId: 'admin', role: 'ADMIN' },
    hackathonId: 'event',
    source: 'web-page',
    request: {},
  } as unknown as AppContext;
  const room = await getRoom(ctx, { roomId: 'room' });
  assert.equal(room.id, 'room');
});
