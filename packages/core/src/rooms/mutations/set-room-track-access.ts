import { validateRoomTrackCapacity } from '../lib/validate-room-track-capacity';
import { reassignProjectLocations } from '../../projects/lib/reassign-project-locations';
import { createMutation } from '../../shared/operations';
import { lockDraft } from '../../hackathon/lib/lock-draft';
import { AppError, AppErrorCode } from '../../shared/errors';
import { requireRoom } from '../lib/require-room';
import { setRoomTrackAccessSchema } from '../schemas/set-room-track-access-schema';
export const setRoomTrackAccess = createMutation({
  name: 'rooms.setTrackAccess',
  schema: setRoomTrackAccessSchema,
  roles: ['OWNER', 'ADMIN'],
})(
  async ({ ctx, input }) => {
    const hackathonId = await lockDraft(ctx);
    await requireRoom(ctx, input.roomId, hackathonId);
    const ids = input.tracks.map((t) => t.trackId);
    const valid = await ctx.db.track.count({
      where: {
        id: { in: ids },
        hackathonId,
        category: { hackathonId, kind: { in: ['OVERALL', 'TRACK'] } },
      },
    });
    if (valid !== ids.length)
      throw new AppError(
        AppErrorCode.NOT_FOUND,
        'A selected track is no longer available. Refresh and try again.',
        { tracks: ['Choose tracks from this hackathon.'] },
      );
    await validateRoomTrackCapacity(ctx, input.roomId, input.tracks);
    const before = await ctx.db.trackRoom.findMany({
      where: { roomId: input.roomId },
      select: {
        trackId: true,
        sortOrder: true,
        isActive: true,
        capacity: true,
      },
    });
    await ctx.db.trackRoom.deleteMany({
      where: { roomId: input.roomId, trackId: { notIn: ids } },
    });
    for (const track of input.tracks) {
      await ctx.db.trackRoom.upsert({
        where: {
          trackId_roomId: { trackId: track.trackId, roomId: input.roomId },
        },
        create: {
          trackId: track.trackId,
          roomId: input.roomId,
          capacity: track.capacity,
        },
        update: { capacity: track.capacity },
      });
    }
    await reassignProjectLocations(ctx);
    return { id: input.roomId, before, after: input.tracks };
  },
  {
    audit: {
      entityType: 'Room',
      getEntityId: ({ result }) => result.id,
      getBefore: ({ result }) => result.before,
      getAfter: ({ result }) => result.after,
    },
  },
);
