import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import type { AppContext } from '../../context';

test(
  'deletion reassigns projects, retains original placement audits, and rolls back on audit failure or judging activity',
  { skip: process.env.CRITIQ_DB_INTEGRATION !== '1' },
  async () => {
    const { db } = await import('@critiq/db');
    const { deleteRoom } = await import('./delete-room');
    const { createRoom } = await import('./create-room');
    const { createCategory } =
      await import('../../categories/mutations/create-category');
    const { createProject } =
      await import('../../projects/mutations/create-project');
    const hackathon = await db.hackathon.findFirstOrThrow();
    const owner = await db.user.findFirstOrThrow({ where: { role: 'OWNER' } });
    const ctx: AppContext = {
      db,
      hackathonId: hackathon.id,
      actor: { type: 'user', userId: owner.id, role: owner.role },
      source: 'web-action',
      request: { ipAddress: null, userAgent: null },
    };
    const category = await createCategory(ctx, {
      kind: 'TRACK',
      name: randomUUID(),
      method: 'RELATIVE',
    });
    const track = await db.track.findUniqueOrThrow({
      where: { categoryId: category.id },
    });
    const roomIds: string[] = [];
    const judgeId = randomUUID();
    try {
      for (let index = 0; index < 3; index++)
        await createProject(ctx, { name: randomUUID(), trackId: track.id });
      const first = await createRoom(ctx, {
        name: randomUUID(),
        tracks: [{ trackId: track.id, capacity: 2 }],
      });
      roomIds.push(first.id);
      const second = await createRoom(ctx, {
        name: randomUUID(),
        tracks: [{ trackId: track.id, capacity: 1 }],
      });
      roomIds.push(second.id);
      const read = () =>
        db.project.findMany({
          where: { trackId: track.id },
          orderBy: { registrationOrder: 'asc' },
        });
      const before = await read();
      await deleteRoom(ctx, { roomId: first.id });
      assert.equal(await db.room.count({ where: { id: first.id } }), 0);
      assert.equal(
        await db.trackRoom.count({ where: { roomId: first.id } }),
        0,
      );
      const after = await read();
      assert.equal(after.length, 3);
      assert.deepEqual(
        after.map((project) => [project.roomId, project.tableNumber]),
        [
          [second.id, 1],
          [null, null],
          [null, null],
        ],
      );
      const placementAudit = await db.auditLog.findFirstOrThrow({
        where: { action: 'projects.place', entityId: before[0]!.id },
        orderBy: { createdAt: 'desc' },
      });
      assert.equal(
        (placementAudit.metadata as { before: { roomId: string } }).before
          .roomId,
        first.id,
      );
      assert.equal(
        (placementAudit.metadata as { after: { roomId: string } }).after.roomId,
        second.id,
      );
      const deletionAudit = await db.auditLog.findFirstOrThrow({
        where: { action: 'rooms.delete', entityId: first.id },
      });
      assert.equal(
        (deletionAudit.metadata as { before: { isActive: boolean } }).before
          .isActive,
        true,
      );
      assert.deepEqual(
        (deletionAudit.metadata as { after: { deleted: boolean } }).after,
        { deleted: true },
      );
      await assert.rejects(deleteRoom(ctx, { roomId: first.id }), {
        code: 'NOT_FOUND',
      });

      const third = await createRoom(ctx, {
        name: randomUUID(),
        tracks: [{ trackId: track.id, capacity: 2 }],
      });
      roomIds.push(third.id);
      const protectedLocations = await read();
      const auditCount = await db.auditLog.count();
      const failingDb = {
        $transaction: (run: (tx: unknown) => Promise<unknown>) =>
          db.$transaction((tx) =>
            run(
              new Proxy(tx, {
                get(target, key) {
                  if (key === 'auditLog')
                    return {
                      create: async ({
                        data,
                      }: {
                        data: { action: string };
                      }) => {
                        if (data.action === 'rooms.delete')
                          throw new Error('Deletion audit failed');
                        return target.auditLog.create({ data: data as never });
                      },
                    };
                  return Reflect.get(target, key);
                },
              }),
            ),
          ),
      };
      await assert.rejects(
        deleteRoom(
          { ...ctx, db: failingDb as unknown as AppContext['db'] },
          { roomId: third.id },
        ),
        { code: 'INTERNAL_SERVER_ERROR' },
      );
      assert.deepEqual(await read(), protectedLocations);
      assert.equal(
        (await db.room.findUniqueOrThrow({ where: { id: third.id } })).isActive,
        true,
      );
      assert.equal(await db.auditLog.count(), auditCount);

      await db.user.create({
        data: {
          id: judgeId,
          name: 'Test judge',
          email: `${judgeId}@example.test`,
        },
      });
      await db.judgingAssignment.create({
        data: {
          categoryId: category.id,
          judgeId,
          projectId: protectedLocations[1]!.id,
        },
      });
      await assert.rejects(deleteRoom(ctx, { roomId: third.id }), {
        code: 'INVALID_STATE',
      });
      assert.deepEqual(await read(), protectedLocations);
      assert.equal(
        (await db.room.findUniqueOrThrow({ where: { id: third.id } })).isActive,
        true,
      );
      assert.equal(await db.auditLog.count(), auditCount);
    } finally {
      await db.judgingAssignment.deleteMany({
        where: { categoryId: category.id },
      });
      await db.project.deleteMany({ where: { trackId: track.id } });
      await db.room.deleteMany({ where: { id: { in: roomIds } } });
      await db.judgingCategory.delete({ where: { id: category.id } });
      await db.user.deleteMany({ where: { id: judgeId } });
      await db.$disconnect();
    }
  },
);
