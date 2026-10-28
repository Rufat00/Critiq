import { setRoomTrackAccess } from './set-room-track-access';
import { createMutation } from '../../shared/operations';
import { lockDraft } from '../../hackathon/lib/lock-draft';
import { createRoomSchema } from '../schemas/create-room-schema';
export const createRoom = createMutation({
  name: 'rooms.create',
  schema: createRoomSchema,
  roles: ['OWNER', 'ADMIN'],
})(
  async ({ ctx, input }) => {
    const hackathonId = await lockDraft(ctx);
    const room = await ctx.db.room.create({
      data: {
        hackathonId,
        name: input.name,
        description: input.description || null,
      },
      select: { id: true, name: true, description: true, isActive: true },
    });
    if (input.tracks.length)
      await setRoomTrackAccess(ctx, { roomId: room.id, tracks: input.tracks });
    return room;
  },
  {
    audit: {
      entityType: 'Room',
      getEntityId: ({ result }) => result.id,
      getAfter: ({ result }) => result,
    },
  },
);
