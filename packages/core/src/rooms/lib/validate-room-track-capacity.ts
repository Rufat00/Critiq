import type { AppContext } from '../../context';
import { requireHackathonId } from '../../context';
import { AppError, AppErrorCode } from '../../shared/errors';
import type { SetRoomTrackAccessInput } from '../schemas/set-room-track-access-schema';

export async function validateRoomTrackCapacity(
  ctx: AppContext,
  roomId: string,
  tracks: SetRoomTrackAccessInput['tracks'],
) {
  const hackathonId = requireHackathonId(ctx);
  for (const [index, track] of tracks.entries()) {
    const remaining = await ctx.db.project.count({
      where: {
        hackathonId,
        trackId: track.trackId,
        OR: [{ roomId: null }, { roomId }],
      },
    });
    if (track.capacity > remaining)
      throw new AppError(
        AppErrorCode.VALIDATION_ERROR,
        'This track has fewer available projects than the selected spots.',
        {
          [`tracks.${index}.capacity`]: [
            `Only ${remaining} projects are available for this room. Reduce the spots or refresh to see current availability.`,
          ],
        },
      );
  }
}
