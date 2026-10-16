import { createMutation } from '../../shared/operations';
import { lockJudgeSetup } from '../lib/lock-judge-setup';
import { requireJudgeMembership } from '../lib/require-judge-membership';
import { removeJudgeSchema } from '../schemas/remove-judge-schema';

export const removeJudge = createMutation({
  name: 'judges.remove',
  schema: removeJudgeSchema,
  roles: ['OWNER', 'ADMIN'],
})(
  async ({ ctx, input }) => {
    await lockJudgeSetup(ctx);
    await requireJudgeMembership(ctx, input.userId, input.categoryId);
    await ctx.db.judgeCategory.update({
      where: { userId_categoryId: input },
      data: { isActive: false, currentRoomId: null },
    });
    return input;
  },
  {
    audit: {
      entityType: 'JudgeCategory',
      getEntityId: ({ input }) => input.userId,
      getBefore: ({ input }) => ({
        categoryId: input.categoryId,
        isActive: true,
      }),
      getAfter: () => ({ isActive: false }),
    },
  },
);
