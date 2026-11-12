import { createMutation } from '../../shared/operations';
import { lockDraft } from '../../hackathon/lib/lock-draft';
import { reassignProjectLocations } from '../../projects/lib/reassign-project-locations';
import { requireRoom } from '../lib/require-room';
import { deleteRoomSchema } from '../schemas/delete-room-schema';

export const deleteRoom = createMutation({
  name: 'rooms.delete',
  schema: deleteRoomSchema,
  roles: ['OWNER', 'ADMIN'],
})(
  async ({ ctx, input }) => {
    const hackathonId = await lockDraft(ctx);
    const room = await requireRoom(ctx, input.roomId, hackathonId);
    const before = {
      id: room.id,
      name: room.name,
      description: room.description,
      isActive: room.isActive,
    };
    // Reassign before deletion so placement audits retain the original room ID
    // and projects with judging activity are protected before the FK is cleared.
    await ctx.db.room.update({
      where: { id: room.id, hackathonId },
      data: { isActive: false },
    });
    await reassignProjectLocations(ctx);
    await ctx.db.room.delete({ where: { id: room.id, hackathonId } });
    return before;
  },
  {
    audit: {
      entityType: 'Room',
      getEntityId: ({ result }) => result.id,
      getBefore: ({ result }) => result,
      getAfter: () => ({ deleted: true }),
    },
  },
);
