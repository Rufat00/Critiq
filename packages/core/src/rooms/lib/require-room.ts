import type { AppContext } from '../../context';
import { AppError, AppErrorCode } from '../../shared/errors';
export async function requireRoom(
  ctx: AppContext,
  roomId: string,
  hackathonId: string,
) {
  const room = await ctx.db.room.findFirst({
    where: { id: roomId, hackathonId },
  });
  if (!room)
    throw new AppError(
      AppErrorCode.NOT_FOUND,
      'Room not found. Refresh and try again.',
    );
  return room;
}
