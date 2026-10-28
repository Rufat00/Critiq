import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import type { AppContext } from '../../context';
test(
  'room creation/editing saves ranges atomically, reclaims current placements and rejects stale capacity without partial writes',
  { skip: process.env.CRITIQ_DB_INTEGRATION !== '1' },
  async () => {
    const { db } = await import('@critiq/db');
    const { createRoom } = await import('./create-room');
    const { updateRoom } = await import('./update-room');
    const { getRoomEditor } = await import('../queries/get-room-editor');
    const { createCategory } =
      await import('../../categories/mutations/create-category');
    const { createProject } =
      await import('../../projects/mutations/create-project');
    const hackathon = await db.hackathon.findFirstOrThrow(),
      owner = await db.user.findFirstOrThrow({ where: { role: 'OWNER' } });
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
    const ids: string[] = [];
    let roomId: string | undefined;
    try {
      for (let i = 0; i < 2; i++)
        ids.push(
          (await createProject(ctx, { name: randomUUID(), trackId: track.id }))
            .id,
        );
      const options = await getRoomEditor(ctx, {});
      assert.equal(
        options.tracks.find((t) => t.id === track.id)!.remainingProjects,
        2,
      );
      const rejectedName = randomUUID();
      await assert.rejects(
        createRoom(ctx, {
          name: rejectedName,
          tracks: [
            { trackId: track.id, ranges: [{ fromNumber: 25, toNumber: 27 }] },
          ],
        }),
        { code: 'VALIDATION_ERROR' },
      );
      assert.equal(await db.room.count({ where: { name: rejectedName } }), 0);
      const room = await createRoom(ctx, {
        name: randomUUID(),
        tracks: [
          { trackId: track.id, ranges: [{ fromNumber: 25, toNumber: 26 }] },
        ],
      });
      roomId = room.id;
      assert.deepEqual(
        (
          await db.project.findMany({
            where: { id: { in: ids } },
            orderBy: { registrationOrder: 'asc' },
          })
        ).map((p) => p.tableNumber),
        [25, 26],
      );
      assert.equal(
        (await getRoomEditor(ctx, {})).tracks.find((t) => t.id === track.id)!
          .remainingProjects,
        0,
      );
      assert.equal(
        (await getRoomEditor(ctx, { roomId })).tracks.find(
          (t) => t.id === track.id,
        )!.remainingProjects,
        2,
      );
      const name = randomUUID();
      await updateRoom(ctx, {
        roomId,
        name,
        isActive: true,
        tracks: [
          { trackId: track.id, ranges: [{ fromNumber: 100, toNumber: 101 }] },
        ],
      });
      await assert.rejects(
        updateRoom(ctx, {
          roomId,
          name: 'Rejected rename',
          isActive: true,
          tracks: [
            { trackId: track.id, ranges: [{ fromNumber: 100, toNumber: 102 }] },
          ],
        }),
        { code: 'VALIDATION_ERROR' },
      );
      assert.equal(
        (await db.room.findUniqueOrThrow({ where: { id: roomId } })).name,
        name,
      );
      assert.deepEqual(
        (
          await db.project.findMany({
            where: { id: { in: ids } },
            orderBy: { registrationOrder: 'asc' },
          })
        ).map((p) => p.tableNumber),
        [100, 101],
      );
      await assert.rejects(
        getRoomEditor(
          { ...ctx, actor: { type: 'user', userId: owner.id, role: 'JUDGE' } },
          { roomId },
        ),
        { code: 'FORBIDDEN' },
      );
      await assert.rejects(getRoomEditor(ctx, { roomId: 'foreign' }), {
        code: 'NOT_FOUND',
      });
    } finally {
      await db.project.deleteMany({ where: { id: { in: ids } } });
      if (roomId) await db.room.delete({ where: { id: roomId } });
      await db.judgingCategory.delete({ where: { id: category.id } });
      await db.$disconnect();
    }
  },
);
