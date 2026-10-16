import { createMutation } from '../../shared/operations';
import { lockDraft } from '../../hackathon/lib/lock-draft';
import { AppError, AppErrorCode } from '../../shared/errors';
import { updateCategorySchema } from '../schemas/update-category-schema';

export const updateCategory = createMutation({
  name: 'categories.update',
  schema: updateCategorySchema,
  roles: ['OWNER', 'ADMIN'],
})(
  async ({ ctx, input }) => {
    const hackathonId = await lockDraft(ctx);
    const category = await ctx.db.judgingCategory.findFirst({
      where: { id: input.categoryId, hackathonId },
      include: {
        track: { include: { allowedChallenges: true } },
        challenge: { include: { allowedTracks: true } },
        rubric: { include: { criteria: { orderBy: { position: 'asc' } } } },
        _count: {
          select: { assignments: true, evaluations: true, rankings: true },
        },
      },
    });
    if (
      !category ||
      (category.kind === 'CHALLENGE'
        ? input.kind !== 'CHALLENGE' ||
          category.challenge?.hackathonId !== hackathonId
        : input.kind !== 'TRACK' ||
          (category.kind === 'TRACK' &&
            category.track?.hackathonId !== hackathonId))
    )
      throw new AppError(
        AppErrorCode.NOT_FOUND,
        'Category not found. Refresh and try again.',
      );
    const duplicate = await ctx.db.judgingCategory.findFirst({
      where: {
        hackathonId,
        id: { not: category.id },
        name: { equals: input.name, mode: 'insensitive' },
      },
      select: { id: true },
    });
    if (duplicate)
      throw new AppError(
        AppErrorCode.CONFLICT,
        'A category with this title already exists.',
        { name: ['Choose a different title.'] },
      );
    const criteria =
      category.rubric?.criteria.map((item) => ({
        name: item.name,
        weight: item.weight.toNumber(),
      })) ?? [];
    const judgingChanged =
      category.method !== input.method ||
      JSON.stringify(criteria) !== JSON.stringify(input.criteria);
    if (
      judgingChanged &&
      (category.rubric?.isLocked ||
        category._count.assignments ||
        category._count.evaluations ||
        category._count.rankings)
    )
      throw new AppError(
        AppErrorCode.INVALID_STATE,
        'The judging method and rubric cannot change after judging activity or rubric locking.',
        { method: ['Keep the existing judging method and rubric.'] },
      );

    const tracks = input.trackIds.length
      ? await ctx.db.track.findMany({
          where: {
            id: { in: input.trackIds },
            hackathonId,
            category: { hackathonId, kind: 'TRACK' },
          },
          select: { id: true },
        })
      : [];
    const challenges = input.challengeIds.length
      ? await ctx.db.challenge.findMany({
          where: {
            id: { in: input.challengeIds },
            hackathonId,
            category: { hackathonId, kind: 'CHALLENGE' },
          },
          select: { id: true },
        })
      : [];
    if (
      tracks.length !== input.trackIds.length ||
      challenges.length !== input.challengeIds.length
    )
      throw new AppError(
        AppErrorCode.NOT_FOUND,
        'A selected category is no longer available. Refresh and try again.',
        {
          ...(tracks.length !== input.trackIds.length
            ? { trackIds: ['Choose tracks from this hackathon.'] }
            : {}),
          ...(challenges.length !== input.challengeIds.length
            ? { challengeIds: ['Choose challenges from this hackathon.'] }
            : {}),
        },
      );
    const previousChallengeIds =
      category.kind === 'OVERALL'
        ? (
            await ctx.db.challenge.findMany({
              where: { hackathonId, includesOverall: true },
              select: { id: true },
            })
          ).map((item) => item.id)
        : (category.track?.allowedChallenges.map((item) => item.challengeId) ??
          []);
    const previousTrackIds =
      category.challenge?.allowedTracks.map((item) => item.trackId) ?? [];
    const removedChallengeIds = previousChallengeIds.filter(
      (id) => !input.challengeIds.includes(id),
    );
    const removedTrackIds = previousTrackIds.filter(
      (id) => !input.trackIds.includes(id),
    );
    const removesOverall =
      category.challenge?.includesOverall && !input.includesOverall;
    const conflictingEntries =
      category.kind === 'CHALLENGE'
        ? removedTrackIds.length || removesOverall
          ? await ctx.db.projectChallenge.count({
              where: {
                challengeId: category.challenge!.id,
                project: {
                  hackathonId,
                  OR: [
                    ...(removedTrackIds.length
                      ? [{ trackId: { in: removedTrackIds } }]
                      : []),
                    ...(removesOverall ? [{ trackId: null }] : []),
                  ],
                },
              },
            })
          : 0
        : removedChallengeIds.length
          ? await ctx.db.projectChallenge.count({
              where: {
                challengeId: { in: removedChallengeIds },
                project: {
                  hackathonId,
                  trackId:
                    category.kind === 'OVERALL' ? null : category.track!.id,
                },
              },
            })
          : 0;
    if (conflictingEntries)
      throw new AppError(
        AppErrorCode.CONFLICT,
        'Projects have entered a challenge in a track you are removing. Remove or move those entries before changing membership.',
        {
          [category.kind === 'CHALLENGE' ? 'trackIds' : 'challengeIds']: [
            'Keep memberships with existing project entries selected.',
          ],
        },
      );

    if (category.kind === 'CHALLENGE') {
      const challengeId = category.challenge!.id;
      await ctx.db.challenge.update({
        where: { id: challengeId, hackathonId },
        data: { includesOverall: input.includesOverall },
      });
      await ctx.db.challengeTrack.deleteMany({
        where: { challengeId, trackId: { in: removedTrackIds } },
      });
      await ctx.db.challengeTrack.createMany({
        data: input.trackIds
          .filter((id) => !previousTrackIds.includes(id))
          .map((trackId) => ({ challengeId, trackId })),
      });
    } else if (category.kind === 'OVERALL') {
      await ctx.db.challenge.updateMany({
        where: { hackathonId, id: { in: removedChallengeIds } },
        data: { includesOverall: false },
      });
      await ctx.db.challenge.updateMany({
        where: { hackathonId, id: { in: input.challengeIds } },
        data: { includesOverall: true },
      });
    } else {
      const trackId = category.track!.id;
      await ctx.db.challengeTrack.deleteMany({
        where: { trackId, challengeId: { in: removedChallengeIds } },
      });
      await ctx.db.challengeTrack.createMany({
        data: input.challengeIds
          .filter((id) => !previousChallengeIds.includes(id))
          .map((challengeId) => ({ challengeId, trackId })),
      });
    }
    if (judgingChanged) {
      if (category.rubric)
        await ctx.db.rubric.delete({ where: { id: category.rubric.id } });
      if (input.method === 'RUBRIC')
        await ctx.db.rubric.create({
          data: {
            categoryId: category.id,
            criteria: {
              create: input.criteria.map((item, position) => ({
                ...item,
                position,
              })),
            },
          },
        });
    }
    await ctx.db.judgingCategory.update({
      where: { id: category.id, hackathonId },
      data: {
        name: input.name,
        description: input.description || null,
        method: input.method,
      },
    });
    return {
      id: category.id,
      name: input.name,
      before: {
        name: category.name,
        description: category.description,
        method: category.method,
        criteria,
        includesOverall: category.challenge?.includesOverall ?? null,
        trackIds: previousTrackIds,
        challengeIds: previousChallengeIds,
      },
      after: {
        name: input.name,
        description: input.description || null,
        method: input.method,
        criteria: input.criteria,
        includesOverall:
          category.kind === 'CHALLENGE' ? input.includesOverall : null,
        trackIds: input.trackIds,
        challengeIds: input.challengeIds,
      },
    };
  },
  {
    audit: {
      entityType: 'JudgingCategory',
      getEntityId: ({ result }) => result.id,
      getBefore: ({ result }) => result.before,
      getAfter: ({ result }) => result.after,
    },
  },
);
