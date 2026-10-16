import type { AppContext } from '../../context';
import { AppError, AppErrorCode } from '../../shared/errors';
import { requireJudgeTrack } from './require-judge-track';

export async function requireJudgeMembership(
  ctx: AppContext,
  userId: string,
  categoryId: string,
) {
  await requireJudgeTrack(ctx, categoryId);
  const membership = await ctx.db.judgeCategory.findFirst({
    where: {
      userId,
      categoryId,
      isActive: true,
      user: { role: 'JUDGE', isActive: true },
    },
    select: { userId: true },
  });
  if (!membership)
    throw new AppError(
      AppErrorCode.NOT_FOUND,
      'This judge is no longer in this track. Refresh and try again.',
    );
  const where = { judgeId: userId, categoryId };
  const activity = await Promise.all([
    ctx.db.judgingAssignment.count({ where }),
    ctx.db.evaluation.count({ where }),
    ctx.db.relativeRanking.count({ where }),
  ]);
  if (activity.some(Boolean))
    throw new AppError(
      AppErrorCode.INVALID_STATE,
      'A judge with judging activity cannot be moved or removed during setup.',
    );
}
