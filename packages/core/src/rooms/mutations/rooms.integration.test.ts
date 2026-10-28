import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';

test(
  'Overall has explicit project, challenge and room memberships, with the same range readiness checks as other tracks',
  { skip: process.env.CRITIQ_DB_INTEGRATION !== '1' },
  async () => {
    const { db } = await import('@critiq/db');
    const { createRoom } = await import('./create-room');
    const { setRoomTrackAccess } = await import('./set-room-track-access');
    const { listRooms } = await import('../queries/list-rooms');
    const { getRoom } = await import('../queries/get-room');
    const { createProject } =
      await import('../../projects/mutations/create-project');
    const { createCategory } =
      await import('../../categories/mutations/create-category');
    const { deleteCategory } =
      await import('../../categories/mutations/delete-category');
    const { updateProject } =
      await import('../../projects/mutations/update-project');
    const { readSetupSnapshot } =
      await import('../../hackathon/lib/read-setup-snapshot');
    const { buildSetupSummary } =
      await import('../../hackathon/lib/build-setup-summary');
    const rollback = new Error('Overall integration check complete');
    try {
      await db.$transaction(
        async (tx) => {
          const hackathon = await tx.hackathon.findFirstOrThrow();
          const owner = await tx.user.findFirstOrThrow({
            where: { role: 'OWNER' },
          });
          const overall = await tx.track.findFirstOrThrow({
            where: { hackathonId: hackathon.id, category: { kind: 'OVERALL' } },
          });
          const ctx = {
            db: tx,
            hackathonId: hackathon.id,
            actor: {
              type: 'user' as const,
              userId: owner.id,
              role: owner.role,
            },
            source: 'web-action' as const,
            request: { ipAddress: null, userAgent: null },
          };
          const room = await createRoom(ctx, {
            name: `Overall hall ${randomUUID()}`,
          });
          const challenge = await createCategory(ctx, {
            kind: 'CHALLENGE',
            name: `Overall prize ${randomUUID()}`,
            method: 'RATING_SCALE',
            trackIds: [overall.id],
          });
          const challengeRow = await tx.challenge.findUniqueOrThrow({
            where: { categoryId: challenge.id },
          });
          const project = await createProject(ctx, {
            name: `Overall project ${randomUUID()}`,
            trackId: overall.id,
            challengeIds: [challengeRow.id],
          });
          await tx.project.createMany({
            data: Array.from({ length: 7 }, () => ({
              hackathonId: hackathon.id,
              trackId: overall.id,
              name: randomUUID(),
            })),
          });
          await tx.project.update({
            where: { id: project.id },
            data: { roomId: room.id, tableNumber: 9 },
          });
          await setRoomTrackAccess(ctx, {
            roomId: room.id,
            tracks: [
              {
                trackId: overall.id,
                ranges: [
                  { fromNumber: 1, toNumber: 4 },
                  { fromNumber: 9, toNumber: 12 },
                ],
              },
            ],
          });
          const overview = await listRooms(ctx, { search: room.name });
          assert.ok(overview.tracks.some((t) => t.id === overall.id));
          assert.equal(overview.items[0]!.trackRooms[0]!.trackId, overall.id);
          assert.equal(overview.items[0]!._count.projects, 8);
          const detail = await getRoom(ctx, { roomId: room.id });
          assert.equal(detail.projects[0]!.track.category.name, 'Overall');
          assert.equal(detail.trackRooms[0]!.tableRanges.length, 2);
          const locationErrors = () =>
            readSetupSnapshot(ctx).then((s) =>
              buildSetupSummary(s).blockers.filter((message) =>
                message.includes('outside the configured'),
              ),
            );
          assert.deepEqual(await locationErrors(), []);
          await setRoomTrackAccess(ctx, {
            roomId: room.id,
            tracks: [
              { trackId: overall.id, ranges: [{ fromNumber: 1, toNumber: 4 }] },
            ],
          });
          assert.deepEqual(await locationErrors(), []);
          assert.equal(
            (await getRoom(ctx, { roomId: room.id })).projects[0]!.tableNumber,
            1,
          );
          const other = await createCategory(ctx, {
            kind: 'TRACK',
            name: `Other ${randomUUID()}`,
            method: 'RELATIVE',
          });
          const otherTrack = await tx.track.findUniqueOrThrow({
            where: { categoryId: other.id },
          });
          await assert.rejects(
            updateProject(ctx, {
              projectId: project.id,
              name: project.name,
              trackId: otherTrack.id,
              challengeIds: [challengeRow.id],
            }),
            { code: 'VALIDATION_ERROR' },
          );
          await updateProject(ctx, {
            projectId: project.id,
            name: project.name,
            trackId: otherTrack.id,
          });
          const moved = await tx.project.findUniqueOrThrow({
            where: { id: project.id },
          });
          assert.equal(moved.roomId, null);
          assert.equal(moved.tableNumber, null);
          await assert.rejects(deleteCategory(ctx, { categoryId: other.id }), {
            code: 'CONFLICT',
          });
          await tx.$executeRawUnsafe('SAVEPOINT occupied_track');
          await assert.rejects(
            tx.track.delete({ where: { id: otherTrack.id } }),
            { code: 'P2003' },
          );
          await tx.$executeRawUnsafe('ROLLBACK TO SAVEPOINT occupied_track');
          await assert.rejects(
            deleteCategory(ctx, { categoryId: overall.categoryId }),
            { code: 'FORBIDDEN' },
          );
          throw rollback;
        },
        { timeout: 15000 },
      );
    } catch (error) {
      if (error !== rollback) throw error;
    } finally {
      await db.$disconnect();
    }
  },
);
