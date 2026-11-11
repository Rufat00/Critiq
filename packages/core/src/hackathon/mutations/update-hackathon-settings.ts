import { createMutation } from '../../shared/operations';
import { lockDraft } from '../lib/lock-draft';
import { AppError, AppErrorCode } from '../../shared/errors';
import { updateHackathonSettingsSchema } from '../schemas/update-hackathon-settings-schema';

export const updateHackathonSettings = createMutation({
  name: 'hackathon.settings.update',
  schema: updateHackathonSettingsSchema,
  roles: ['OWNER', 'ADMIN'],
})(
  async ({ ctx, input }) => {
    const id = await lockDraft(ctx);
    const before = await ctx.db.hackathon.findUnique({
      where: { id },
      select: { name: true, scoreScale: true, roomSwitchPercent: true },
    });
    if (!before)
      throw new AppError(AppErrorCode.NOT_FOUND, 'Hackathon not found.');
    // Draft may be revisited later; never change the meaning of existing scores.
    if (before.scoreScale !== input.scoreScale) {
      const started = await ctx.db.judgingCategory.count({
        where: {
          hackathonId: id,
          OR: [
            { startedAt: { not: null } },
            { rubric: { isLocked: true } },
            { evaluations: { some: {} } },
          ],
        },
      });
      if (started)
        throw new AppError(
          AppErrorCode.INVALID_STATE,
          'The scoring system cannot change after judging has started.',
          {
            scoreScale: [
              'The score scale is locked because judging has started.',
            ],
          },
        );
    }
    const settings = await ctx.db.hackathon.update({
      where: { id },
      data: input,
      select: {
        id: true,
        name: true,
        scoreScale: true,
        roomSwitchPercent: true,
        status: true,
      },
    });
    return { settings, before, after: input };
  },
  {
    audit: {
      entityType: 'Hackathon',
      getEntityId: ({ result }) => result.settings.id,
      getBefore: ({ result }) => result.before,
      getAfter: ({ result }) => result.after,
    },
  },
);
