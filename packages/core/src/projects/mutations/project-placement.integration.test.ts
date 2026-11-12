import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import type { AppContext } from '../../context';
const integration = { skip: process.env.CRITIQ_DB_INTEGRATION !== '1' };
async function fixture() {
  const { db } = await import('@critiq/db');
  const { createProject } = await import('./create-project');
  const { updateProject } = await import('./update-project');
  const { deleteProject } = await import('./delete-project');
  const { importProjects } = await import('./import-projects');
  const { createRoom } = await import('../../rooms/mutations/create-room');
  const { updateRoom } = await import('../../rooms/mutations/update-room');
  const { deleteRoom } = await import('../../rooms/mutations/delete-room');
  const { setRoomTrackAccess } =
    await import('../../rooms/mutations/set-room-track-access');
  const { createCategory } =
    await import('../../categories/mutations/create-category');
  const hackathon = await db.hackathon.findFirstOrThrow();
  const owner = await db.user.findFirstOrThrow({ where: { role: 'OWNER' } });
  const overall = await db.track.findFirstOrThrow({
    where: { category: { kind: 'OVERALL' } },
  });
  const ctx: AppContext = {
    db,
    hackathonId: hackathon.id,
    actor: { type: 'user', userId: owner.id, role: owner.role },
    source: 'web-action',
    request: { ipAddress: null, userAgent: null },
  };
  return {
    db,
    ctx,
    overall,
    createProject,
    updateProject,
    deleteProject,
    importProjects,
    createRoom,
    updateRoom,
    deleteRoom,
    setRoomTrackAccess,
    createCategory,
  };
}
async function rollbackCheck(
  run: (f: Awaited<ReturnType<typeof fixture>>) => Promise<void>,
) {
  const f = await fixture();
  const rollback = new Error('Placement verification complete');
  try {
    await f.db.$transaction(
      async (tx) => {
        await run({ ...f, ctx: { ...f.ctx, db: tx } });
        throw rollback;
      },
      { timeout: 20000 },
    );
  } catch (error) {
    if (error !== rollback) throw error;
  } finally {
    await f.db.$disconnect();
  }
}

test(
  'projects fill room capacities in registration order and reflow on deletion, track moves and room status',
  integration,
  async () =>
    rollbackCheck(async (f) => {
      const { ctx } = f,
        tx = ctx.db;
      const first = await f.createProject(ctx, {
        name: 'Z first',
        trackId: f.overall.id,
      });
      const second = await f.createProject(ctx, {
        name: 'A second',
        trackId: f.overall.id,
      });
      const third = await f.createProject(ctx, {
        name: 'Third',
        trackId: f.overall.id,
      });
      const fourth = await f.createProject(ctx, {
        name: 'Fourth',
        trackId: f.overall.id,
      });
      assert.equal(first.roomId, null);
      const a = await f.createRoom(ctx, { name: randomUUID() }),
        b = await f.createRoom(ctx, { name: randomUUID() });
      const access = {
        roomId: a.id,
        tracks: [
          {
            trackId: f.overall.id,
            capacity: 3,
          },
        ],
      };
      await f.setRoomTrackAccess(ctx, access);
      const read = (id: string) =>
        tx.project.findUniqueOrThrow({ where: { id } });
      assert.equal((await read(third.id)).tableNumber, 3);
      assert.equal((await read(fourth.id)).roomId, null);
      await f.setRoomTrackAccess(ctx, {
        roomId: b.id,
        tracks: [{ trackId: f.overall.id, capacity: 1 }],
      });
      await tx.trackRoom.updateMany({
        where: { roomId: b.id },
        data: { sortOrder: 1 },
      });
      await f.setRoomTrackAccess(ctx, access);
      assert.equal((await read(first.id)).tableNumber, 1);
      assert.equal((await read(second.id)).tableNumber, 2);
      assert.equal((await read(fourth.id)).tableNumber, 4);
      const audits = await tx.auditLog.count({
        where: { action: 'projects.place' },
      });
      await f.setRoomTrackAccess(ctx, access);
      assert.equal(
        await tx.auditLog.count({ where: { action: 'projects.place' } }),
        audits,
      );
      await f.updateProject(ctx, {
        projectId: second.id,
        name: 'Renamed Z',
        trackId: f.overall.id,
      });
      assert.equal((await read(second.id)).tableNumber, 2);
      await f.deleteProject(ctx, { projectId: first.id });
      assert.equal((await read(second.id)).tableNumber, 1);
      assert.equal((await read(third.id)).tableNumber, 2);
      assert.equal((await read(fourth.id)).tableNumber, 3);
      const category = await f.createCategory(ctx, {
        kind: 'TRACK',
        name: randomUUID(),
        method: 'RELATIVE',
      });
      const other = await tx.track.findUniqueOrThrow({
        where: { categoryId: category.id },
      });
      await f.updateProject(ctx, {
        projectId: second.id,
        name: second.name,
        trackId: other.id,
      });
      await f.setRoomTrackAccess(ctx, {
        roomId: a.id,
        tracks: [
          { trackId: f.overall.id, capacity: 2 },
          { trackId: other.id, capacity: 1 },
        ],
      });
      assert.equal((await read(second.id)).tableNumber, 1);
      assert.equal((await read(third.id)).tableNumber, 2);
      await f.updateRoom(ctx, { roomId: a.id, name: a.name, isActive: false });
      assert.equal((await read(second.id)).roomId, null);
      assert.equal((await read(third.id)).tableNumber, 1);
      assert.equal((await read(fourth.id)).roomId, null);
      await f.setRoomTrackAccess(ctx, {
        roomId: b.id,
        tracks: [{ trackId: f.overall.id, capacity: 2 }],
      });
      assert.equal((await read(fourth.id)).tableNumber, 2);
      await f.updateRoom(ctx, { roomId: a.id, name: a.name, isActive: true });
      assert.equal((await read(second.id)).tableNumber, 1);
      assert.equal((await read(third.id)).tableNumber, 2);
      const occupied = await tx.project.findMany({
        where: { roomId: { not: null } },
        select: { roomId: true, tableNumber: true },
      });
      assert.equal(
        new Set(occupied.map((p) => p.tableNumber)).size,
        occupied.length,
      );
    }),
);

test(
  'bulk imports retain CSV order and adding spots places the waiting projects',
  integration,
  async () =>
    rollbackCheck(async (f) => {
      const { ctx } = f;
      const imported = await f.importProjects(ctx, {
        format: 'csv',
        csv: 'Z first,,,,,,,Submitted\nA second,,,,,,,Submitted\nM third,,,,,,,Submitted',
      });
      assert.equal(imported.placed, 0);
      assert.equal(imported.unassigned, 3);
      const room = await f.createRoom(ctx, { name: randomUUID() });
      await f.setRoomTrackAccess(ctx, {
        roomId: room.id,
        tracks: [{ trackId: f.overall.id, capacity: 3 }],
      });
      const projects = await ctx.db.project.findMany({
        where: { id: { in: imported.ids } },
        orderBy: { registrationOrder: 'asc' },
      });
      assert.deepEqual(
        projects.map((p) => p.id),
        imported.ids,
      );
      assert.deepEqual(
        projects.map((p) => p.tableNumber),
        [1, 2, 3],
      );
      const overflow = await f.createProject(ctx, {
        name: 'After import',
        trackId: f.overall.id,
      });
      assert.equal(overflow.tableNumber, null);
      await f.setRoomTrackAccess(ctx, {
        roomId: room.id,
        tracks: [{ trackId: f.overall.id, capacity: 4 }],
      });
      assert.equal(
        (await ctx.db.project.findUniqueOrThrow({ where: { id: overflow.id } }))
          .tableNumber,
        4,
      );
    }),
);

test(
  'placement audits roll back capacity/status changes, and concurrent creates cannot share a table',
  integration,
  async () => {
    const f = await fixture(),
      { db, ctx } = f;
    const category = await f.createCategory(ctx, {
      kind: 'TRACK',
      name: randomUUID(),
      method: 'RELATIVE',
    });
    const track = await db.track.findUniqueOrThrow({
      where: { categoryId: category.id },
    });
    const room = await f.createRoom(ctx, { name: randomUUID() });
    const ids: string[] = [];
    const failingDb = {
      $transaction: (run: (tx: unknown) => Promise<unknown>) =>
        db.$transaction((tx) =>
          run(
            new Proxy(tx, {
              get(target, key) {
                if (key === 'auditLog')
                  return {
                    create: async ({ data }: { data: { action: string } }) => {
                      if (data.action === 'projects.place')
                        throw new Error('Placement audit failed');
                      return target.auditLog.create({ data: data as never });
                    },
                  };
                return Reflect.get(target, key);
              },
            }),
          ),
        ),
    };
    const faultyCtx = { ...ctx, db: failingDb as unknown as AppContext['db'] };
    try {
      const first = await f.createProject(ctx, {
        name: randomUUID(),
        trackId: track.id,
      });
      ids.push(first.id);
      const access = {
        roomId: room.id,
        tracks: [{ trackId: track.id, capacity: 1 }],
      };
      await assert.rejects(f.setRoomTrackAccess(faultyCtx, access), {
        code: 'INTERNAL_SERVER_ERROR',
      });
      assert.equal(await db.trackRoom.count({ where: { roomId: room.id } }), 0);
      assert.equal(
        (await db.project.findUniqueOrThrow({ where: { id: first.id } }))
          .roomId,
        null,
      );
      await f.setRoomTrackAccess(ctx, access);
      await assert.rejects(
        f.updateRoom(faultyCtx, {
          roomId: room.id,
          name: room.name,
          isActive: false,
        }),
        { code: 'INTERNAL_SERVER_ERROR' },
      );
      assert.equal(
        (await db.room.findUniqueOrThrow({ where: { id: room.id } })).isActive,
        true,
      );
      await db.project.delete({ where: { id: first.id } });
      const concurrent = await Promise.all([
        f.createProject(ctx, { name: randomUUID(), trackId: track.id }),
        f.createProject(ctx, { name: randomUUID(), trackId: track.id }),
      ]);
      ids.push(...concurrent.map((p) => p.id));
      const ordered = await db.project.findMany({
        where: { id: { in: concurrent.map((p) => p.id) } },
        orderBy: { registrationOrder: 'asc' },
      });
      assert.deepEqual(
        ordered.map((p) => p.tableNumber),
        [1, null],
      );
    } finally {
      await db.project.deleteMany({ where: { id: { in: ids } } });
      await db.room.delete({ where: { id: room.id } });
      await db.judgingCategory.delete({ where: { id: category.id } });
      await db.$disconnect();
    }
  },
);

test(
  '101 projects share global numbers across tracks and rooms; judging activity blocks renumbering atomically',
  integration,
  async () =>
    rollbackCheck(async (f) => {
      const { ctx } = f;
      const category = await f.createCategory(ctx, {
        kind: 'TRACK',
        name: randomUUID(),
        method: 'RELATIVE',
      });
      const track = await ctx.db.track.findUniqueOrThrow({
        where: { categoryId: category.id },
      });
      await ctx.db.project.createMany({
        data: Array.from({ length: 101 }, (_, index) => ({
          hackathonId: ctx.hackathonId!,
          trackId: index % 2 ? track.id : f.overall.id,
          name: `Project ${index + 1}`,
        })),
      });
      const first = await f.createRoom(ctx, {
        name: randomUUID(),
        tracks: [
          { trackId: f.overall.id, capacity: 25 },
          { trackId: track.id, capacity: 30 },
        ],
      });
      await f.createRoom(ctx, {
        name: randomUUID(),
        tracks: [
          { trackId: f.overall.id, capacity: 26 },
          { trackId: track.id, capacity: 20 },
        ],
      });
      const read = () =>
        ctx.db.project.findMany({
          where: { hackathonId: ctx.hackathonId! },
          orderBy: { registrationOrder: 'asc' },
        });
      const before = await read();
      assert.deepEqual(
        before.map((project) => project.tableNumber).sort((a, b) => a! - b!),
        Array.from({ length: 101 }, (_, index) => index + 1),
      );
      const firstNumbers = before
        .filter((project) => project.roomId === first.id)
        .map((project) => project.tableNumber)
        .sort((a, b) => a! - b!);
      assert.deepEqual(
        firstNumbers,
        Array.from({ length: 55 }, (_, index) => index + 1),
      );
      assert.equal(new Set(before.map((project) => project.roomId)).size, 2);
      const project = before[100]!;
      const judge = await ctx.db.user.create({
        data: {
          id: randomUUID(),
          name: 'Judge',
          email: `${randomUUID()}@example.test`,
        },
      });
      await ctx.db.judgingAssignment.create({
        data: {
          categoryId: f.overall.categoryId,
          projectId: project.id,
          judgeId: judge.id,
        },
      });
      const auditCount = await ctx.db.auditLog.count();
      // A savepoint permits asserting rollback inside the surrounding test transaction.
      await ctx.db.$executeRawUnsafe('SAVEPOINT protected_placement');
      await assert.rejects(
        f.updateRoom(ctx, {
          roomId: first.id,
          name: 'Must roll back',
          isActive: true,
          tracks: [
            { trackId: f.overall.id, capacity: 24 },
            { trackId: track.id, capacity: 30 },
          ],
        }),
        { code: 'INVALID_STATE' },
      );
      await ctx.db.$executeRawUnsafe(
        'ROLLBACK TO SAVEPOINT protected_placement',
      );
      assert.deepEqual(await read(), before);
      assert.equal(
        (await ctx.db.room.findUniqueOrThrow({ where: { id: first.id } })).name,
        first.name,
      );
      assert.equal(await ctx.db.auditLog.count(), auditCount);
    }),
);

test(
  'deleting a mixed-track room leaves consecutive number blocks in every remaining room',
  integration,
  async () =>
    rollbackCheck(async (f) => {
      const { ctx } = f;
      const category = await f.createCategory(ctx, {
        kind: 'TRACK',
        name: randomUUID(),
        method: 'RELATIVE',
      });
      const track = await ctx.db.track.findUniqueOrThrow({
        where: { categoryId: category.id },
      });
      for (let index = 0; index < 8; index++)
        await f.createProject(ctx, {
          name: randomUUID(),
          trackId: index % 2 ? track.id : f.overall.id,
        });
      const first = await f.createRoom(ctx, {
        name: randomUUID(),
        tracks: [
          { trackId: f.overall.id, capacity: 1 },
          { trackId: track.id, capacity: 2 },
        ],
      });
      const removed = await f.createRoom(ctx, {
        name: randomUUID(),
        tracks: [
          { trackId: f.overall.id, capacity: 1 },
          { trackId: track.id, capacity: 1 },
        ],
      });
      const last = await f.createRoom(ctx, {
        name: randomUUID(),
        tracks: [
          { trackId: f.overall.id, capacity: 2 },
          { trackId: track.id, capacity: 1 },
        ],
      });
      await f.deleteRoom(ctx, { roomId: removed.id });
      const projects = await ctx.db.project.findMany({
        where: { hackathonId: ctx.hackathonId! },
        orderBy: { tableNumber: { sort: 'asc', nulls: 'last' } },
      });
      assert.deepEqual(
        projects
          .filter((project) => project.roomId === first.id)
          .map((project) => project.tableNumber),
        [1, 2, 3],
      );
      assert.deepEqual(
        projects
          .filter((project) => project.roomId === last.id)
          .map((project) => project.tableNumber),
        [4, 5, 6],
      );
      assert.equal(
        projects.filter(
          (project) => project.roomId === null && project.tableNumber === null,
        ).length,
        2,
      );
    }),
);
