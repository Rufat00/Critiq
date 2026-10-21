import type { AppContext } from '../../context';
import { requireHackathonId } from '../../context';
import { AppError, AppErrorCode } from '../../shared/errors';

export async function validateProjectMembership(
  ctx: AppContext,
  trackId: string,
  challengeIds: string[],
) {
  const hackathonId = requireHackathonId(ctx);
  if (
    !(await ctx.db.track.findFirst({
      where: {
        id: trackId,
        hackathonId,
        category: { hackathonId, kind: { in: ['OVERALL', 'TRACK'] } },
      },
      select: { id: true },
    }))
  )
    throw new AppError(
      AppErrorCode.NOT_FOUND,
      'Choose a track from this hackathon.',
      { trackId: ['This track is no longer available.'] },
    );
  const ids = [...new Set(challengeIds)];
  const eligible = await ctx.db.challenge.count({
    where: {
      hackathonId,
      id: { in: ids },
      category: { hackathonId, kind: 'CHALLENGE' },
      allowedTracks: { some: { trackId } },
    },
  });
  if (eligible !== ids.length)
    throw new AppError(
      AppErrorCode.VALIDATION_ERROR,
      'Some challenges are unavailable for this track.',
      { challengeIds: ['Select challenges that include the chosen track.'] },
    );
  return ids;
}
