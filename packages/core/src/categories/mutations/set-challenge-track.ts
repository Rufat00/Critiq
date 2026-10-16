import { createMutation } from '../../shared/operations';
import { AppError, AppErrorCode } from '../../shared/errors';
import { lockDraft } from '../../hackathon/lib/lock-draft';
import { setChallengeTrackSchema } from '../schemas/set-challenge-track-schema';

export const setChallengeTrack = createMutation({
  name: 'categories.set-challenge-track',
  schema: setChallengeTrackSchema,
  roles: ['OWNER', 'ADMIN'],
})(
  async ({ ctx, input }) => {
    const hackathonId = await lockDraft(ctx);
    const trackCategory = await ctx.db.judgingCategory.findFirst({
      where: {
        id: input.trackCategoryId,
        hackathonId,
        kind: { in: ['OVERALL', 'TRACK'] },
      },
      select: {
        id: true,
        name: true,
        kind: true,
        track: { select: { id: true, hackathonId: true } },
      },
    });
    if (
      !trackCategory ||
      (trackCategory.kind === 'TRACK' &&
        (!trackCategory.track ||
          trackCategory.track.hackathonId !== hackathonId))
    )
      throw new AppError(
        AppErrorCode.NOT_FOUND,
        'Track not found. Refresh and try again.',
      );
    const challengeCategory = await ctx.db.judgingCategory.findFirst({
      where: { id: input.challengeCategoryId, hackathonId, kind: 'CHALLENGE' },
      select: {
        id: true,
        name: true,
        challenge: {
          select: { id: true, hackathonId: true, includesOverall: true },
        },
      },
    });
    const challenge = challengeCategory?.challenge;
    if (
      !challengeCategory ||
      !challenge ||
      challenge.hackathonId !== hackathonId
    )
      throw new AppError(
        AppErrorCode.NOT_FOUND,
        'Challenge not found. Refresh and try again.',
      );
    const trackId =
      trackCategory.kind === 'OVERALL' ? null : trackCategory.track!.id;
    const existing = trackId
      ? await ctx.db.challengeTrack.findUnique({
          where: {
            challengeId_trackId: { challengeId: challenge.id, trackId },
          },
          select: { challengeId: true },
        })
      : null;
    const previouslyIncluded =
      trackId === null ? challenge.includesOverall : existing !== null;
    if (previouslyIncluded !== input.included) {
      if (!input.included) {
        const entries = await ctx.db.projectChallenge.count({
          where: {
            challengeId: challenge.id,
            project: { hackathonId, trackId },
          },
        });
        if (entries > 0)
          throw new AppError(
            AppErrorCode.CONFLICT,
            'Projects in this track have entered this challenge. Remove or move those entries before excluding the track.',
          );
      }
      if (trackId === null) {
        await ctx.db.challenge.update({
          where: { id: challenge.id, hackathonId },
          data: { includesOverall: input.included },
        });
      } else if (input.included) {
        await ctx.db.challengeTrack.upsert({
          where: {
            challengeId_trackId: { challengeId: challenge.id, trackId },
          },
          create: { challengeId: challenge.id, trackId },
          update: {},
        });
      } else {
        await ctx.db.challengeTrack.deleteMany({
          where: { challengeId: challenge.id, trackId },
        });
      }
    }
    return {
      challengeCategoryId: challengeCategory.id,
      challengeName: challengeCategory.name,
      trackCategoryId: trackCategory.id,
      trackName: trackCategory.name,
      previouslyIncluded,
      included: input.included,
    };
  },
  {
    audit: {
      entityType: 'JudgingCategory',
      getEntityId: ({ result }) => result.challengeCategoryId,
      getBefore: ({ result }) => ({
        trackCategoryId: result.trackCategoryId,
        included: result.previouslyIncluded,
      }),
      getAfter: ({ result }) => ({
        trackCategoryId: result.trackCategoryId,
        included: result.included,
      }),
    },
  },
);
