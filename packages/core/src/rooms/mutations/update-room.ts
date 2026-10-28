import { setRoomTrackAccess } from './set-room-track-access';
import { reassignProjectLocations } from '../../projects/lib/reassign-project-locations';
import { createMutation } from '../../shared/operations';
import { lockDraft } from '../../hackathon/lib/lock-draft';
import { requireRoom } from '../lib/require-room';
import { updateRoomSchema } from '../schemas/update-room-schema';
export const updateRoom = createMutation({
  name: 'rooms.update',
  schema: updateRoomSchema,
  roles: ['OWNER', 'ADMIN'],
})(
  async ({ ctx, input }) => {
    const hackathonId = await lockDraft(ctx);
    const room = await requireRoom(ctx, input.roomId, hackathonId);
    const before = {
      name: room.name,
      description: room.description,
      isActive: room.isActive,
    };
    const after = {
      name: input.name,
      description: input.description || null,
      isActive: input.isActive,
    };
    await ctx.db.room.update({
      where: { id: room.id, hackathonId },
      data: after,
    });
    if (input.tracks !== undefined)
      await setRoomTrackAccess(ctx, { roomId: room.id, tracks: input.tracks });
    else if (before.isActive !== after.isActive)
      await reassignProjectLocations(ctx);
    return { id: room.id, before, after };
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
