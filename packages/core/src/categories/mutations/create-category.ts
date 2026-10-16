import { createMutation } from '../../shared/operations';
import { lockDraft } from '../../hackathon/lib/lock-draft';
import { AppError, AppErrorCode } from '../../shared/errors';
import { createCategorySchema } from '../schemas/create-category-schema';

export const createCategory = createMutation({
  name: 'categories.create',
  schema: createCategorySchema,
  roles: ['OWNER', 'ADMIN'],
})(
  async ({ ctx, input }) => {
    const hackathonId = await lockDraft(ctx);
    const existing = await ctx.db.judgingCategory.findFirst({
      where: { hackathonId, name: { equals: input.name, mode: 'insensitive' } },
      select: { id: true },
    });
    if (existing)
      throw new AppError(
        AppErrorCode.CONFLICT,
        'A category with this title already exists.',
        { name: ['Choose a different title.'] },
      );
    const tracks = input.trackIds.length
      ? await ctx.db.track.findMany({
          where: {
            hackathonId,
            id: { in: input.trackIds },
            category: { hackathonId, kind: 'TRACK' },
          },
          select: { id: true },
        })
      : [];
    if (tracks.length !== input.trackIds.length)
      throw new AppError(
        AppErrorCode.NOT_FOUND,
        'A selected track is no longer available. Refresh and try again.',
        { trackIds: ['Choose tracks from this hackathon.'] },
      );
    const challenges = input.challengeIds.length
      ? await ctx.db.challenge.findMany({
          where: {
            hackathonId,
            id: { in: input.challengeIds },
            category: { hackathonId, kind: 'CHALLENGE' },
          },
          select: { id: true },
        })
      : [];
    if (challenges.length !== input.challengeIds.length)
      throw new AppError(
        AppErrorCode.NOT_FOUND,
        'A selected challenge is no longer available. Refresh and try again.',
        { challengeIds: ['Choose challenges from this hackathon.'] },
      );
    const category = await ctx.db.judgingCategory.create({
      data: {
        hackathonId,
        kind: input.kind,
        name: input.name,
        description: input.description || null,
        method: input.method,
        ...(input.kind === 'TRACK'
          ? {
              track: {
                create: {
                  hackathonId,
                  disqualifiesFromOverall: true,
                  ...(challenges.length
                    ? {
                        allowedChallenges: {
                          create: challenges.map((challenge) => ({
                            challengeId: challenge.id,
                          })),
                        },
                      }
                    : {}),
                },
              },
            }
          : {
              challenge: {
                create: {
                  hackathonId,
                  includesOverall: input.includesOverall,
                  ...(tracks.length
                    ? {
                        allowedTracks: {
                          create: tracks.map((track) => ({
                            trackId: track.id,
                          })),
                        },
                      }
                    : {}),
                },
              },
            }),
        ...(input.method === 'RUBRIC'
          ? {
              rubric: {
                create: {
                  criteria: {
                    create: input.criteria.map((item, position) => ({
                      name: item.name,
                      weight: item.weight,
                      position,
                    })),
                  },
                },
              },
            }
          : {}),
      },
      select: {
        id: true,
        name: true,
        kind: true,
        description: true,
        method: true,
      },
    });
    return {
      ...category,
      criteria: input.criteria,
      includesOverall:
        input.kind === 'CHALLENGE' ? input.includesOverall : null,
      trackIds: tracks.map((track) => track.id),
      challengeIds: challenges.map((challenge) => challenge.id),
    };
  },
  {
    audit: {
      entityType: 'JudgingCategory',
      getEntityId: ({ result }) => result.id,
      getAfter: ({ result }) => ({
        ...result,
        criteria: result.criteria.map((item) => ({
          name: item.name,
          weight: item.weight,
        })),
      }),
    },
  },
);
