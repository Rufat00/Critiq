import { z } from 'zod';
import { requireHackathonId } from '../../context';
import { AppError, AppErrorCode } from '../../shared/errors';
import { createMutation } from '../../shared/operations';
import { readSetupSnapshot } from '../lib/read-setup-snapshot';
import { buildSetupSummary } from '../lib/build-setup-summary';

export const startHackathonJudging = createMutation({
  name: 'hackathon.start-judging',
  schema: z.object({}),
  roles: ['OWNER', 'ADMIN'],
})(
  async ({ ctx }) => {
    const id = requireHackathonId(ctx);
    // Serialize with judge edits, configuration writes and returning to draft.
    const locked = await ctx.db.hackathon.updateMany({
      where: { id, status: 'READY' },
      data: { status: 'JUDGING' },
    });
    if (locked.count !== 1)
      throw new AppError(
        AppErrorCode.INVALID_STATE,
        'Only a ready hackathon can start judging. Refresh to see the current stage.',
      );
    const snapshot = await readSetupSnapshot(ctx);
    if (buildSetupSummary(snapshot).blockers.length)
      throw new AppError(
        AppErrorCode.INVALID_STATE,
        'Your setup has blocking issues. Return to draft to fix them before starting.',
      );
    if (
      snapshot.hackathon.categories.some(
        (category) =>
          category.status !== 'NOT_STARTED' || category.startedAt !== null,
      )
    )
      throw new AppError(
        AppErrorCode.INVALID_STATE,
        'Judging has already started for a category. Refresh and review the event.',
      );
    const startedAt = new Date();
    await ctx.db.judgingCategory.updateMany({
      where: { hackathonId: id, isEnabled: true },
      data: { status: 'ACTIVE', startedAt },
    });
    await ctx.db.rubric.updateMany({
      where: { category: { hackathonId: id, isEnabled: true } },
      data: { isLocked: true },
    });
    return { id, startedAt: startedAt.toISOString() };
  },
  {
    audit: {
      entityType: 'Hackathon',
      getEntityId: ({ result }) => result.id,
      getBefore: () => ({ status: 'READY' }),
      getAfter: ({ result }) => ({
        status: 'JUDGING',
        startedAt: result.startedAt,
      }),
    },
  },
);
