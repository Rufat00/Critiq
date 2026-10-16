import { createMutation } from '../../shared/operations';
import { AppError, AppErrorCode } from '../../shared/errors';
import { lockJudgeSetup } from '../lib/lock-judge-setup';
import { requireJudgeTrack } from '../lib/require-judge-track';
import { requireJudgeMembership } from '../lib/require-judge-membership';
import { moveJudgeSchema } from '../schemas/move-judge-schema';

export const moveJudge = createMutation({
  name: 'judges.move',
  schema: moveJudgeSchema,
  roles: ['OWNER', 'ADMIN'],
})(
  async ({ ctx, input }) => {
    const hackathonId = await lockJudgeSetup(ctx);
    await requireJudgeMembership(ctx, input.userId, input.categoryId);
    await requireJudgeTrack(ctx, input.targetCategoryId);
    const other = await ctx.db.judgeCategory.count({
      where: {
        userId: input.userId,
        isActive: true,
        categoryId: { not: input.categoryId },
        category: { hackathonId, kind: { in: ['OVERALL', 'TRACK'] } },
      },
    });
    if (other)
      throw new AppError(
        AppErrorCode.CONFLICT,
        'This judge already belongs to another track. Refresh and review their access.',
      );
    await ctx.db.judgeCategory.update({
      where: {
        userId_categoryId: {
          userId: input.userId,
          categoryId: input.categoryId,
        },
      },
      data: { isActive: false, currentRoomId: null },
    });
    await ctx.db.judgeCategory.upsert({
      where: {
        userId_categoryId: {
          userId: input.userId,
          categoryId: input.targetCategoryId,
        },
      },
      create: { userId: input.userId, categoryId: input.targetCategoryId },
      update: { isActive: true, currentRoomId: null, assignedAt: new Date() },
    });
    return input;
  },
  {
    audit: {
      entityType: 'JudgeCategory',
      getEntityId: ({ input }) => input.userId,
      getBefore: ({ input }) => ({ categoryId: input.categoryId }),
      getAfter: ({ input }) => ({ categoryId: input.targetCategoryId }),
    },
  },
);
