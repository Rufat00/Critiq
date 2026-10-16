import type { AppContext } from '../../context';
import { requireHackathonId } from '../../context';
import { AppError, AppErrorCode } from '../../shared/errors';

export async function requireJudgeTrack(ctx: AppContext, categoryId: string) {
  const category = await ctx.db.judgingCategory.findFirst({
    where: {
      id: categoryId,
      hackathonId: requireHackathonId(ctx),
      kind: { in: ['OVERALL', 'TRACK'] },
    },
    select: { id: true, name: true },
  });
  if (!category)
    throw new AppError(
      AppErrorCode.NOT_FOUND,
      'Track not found. Refresh and try again.',
    );
  return category;
}
