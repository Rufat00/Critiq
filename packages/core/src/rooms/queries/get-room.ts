import { z } from 'zod';
import { requireHackathonId } from '../../context';
import { createQuery } from '../../shared/operations';
import { AppError, AppErrorCode } from '../../shared/errors';
export const getRoom = createQuery({
  name: 'rooms.get',
  schema: z.object({ roomId: z.string().min(1) }),
  roles: ['OWNER', 'ADMIN'],
})(async ({ ctx, input }) => {
  const hackathonId = requireHackathonId(ctx);
  const room = await ctx.db.room.findFirst({
    where: { id: input.roomId, hackathonId },
    select: {
      id: true,
      name: true,
      description: true,
      isActive: true,
      trackRooms: {
        where: { track: { hackathonId } },
        orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
        select: {
          trackId: true,
          isActive: true,
          track: { select: { category: { select: { name: true } } } },
          capacity: true,
        },
      },
      projects: {
        where: { hackathonId },
        orderBy: [
          { tableNumber: { sort: 'asc', nulls: 'last' } },
          { name: 'asc' },
          { id: 'asc' },
        ],
        select: {
          id: true,
          name: true,
          tableNumber: true,
          trackId: true,
          track: { select: { category: { select: { name: true } } } },
        },
      },
    },
  });
  if (!room)
    throw new AppError(
      AppErrorCode.NOT_FOUND,
      'Room not found. Refresh and try again.',
    );
  return room;
});
export type RoomDetail = Awaited<ReturnType<typeof getRoom>>;
