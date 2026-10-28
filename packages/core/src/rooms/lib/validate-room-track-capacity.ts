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
    let end = -1,
      covered = 0;
    for (const range of [...track.ranges].sort(
      (a, b) => a.fromNumber - b.fromNumber,
    )) {
      covered += Math.max(
        0,
        range.toNumber - Math.max(end + 1, range.fromNumber) + 1,
      );
      end = Math.max(end, range.toNumber);
    }
    if (covered > remaining)
      throw new AppError(
        AppErrorCode.VALIDATION_ERROR,
        'This track has fewer remaining projects than the selected table ranges.',
        {
          [`tracks.${index}.ranges`]: [
            `Only ${remaining} projects are available for this room. Reduce the ranges or refresh to see current availability.`,
          ],
        },
      );
  }
}
