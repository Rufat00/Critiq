import { requireHackathonId } from '../../context';
import { AppError, AppErrorCode } from '../../shared/errors';
import { createMutation } from '../../shared/operations';
import { formatHackathonSchema } from '../schemas/format-hackathon-schema';

export const formatHackathon = createMutation({
  name: 'hackathon.format',
  schema: formatHackathonSchema,
  roles: ['OWNER'],
})(
  async ({ ctx, input }) => {
    const hackathonId = requireHackathonId(ctx);
    if (ctx.actor.type !== 'user')
      throw new AppError(
        AppErrorCode.FORBIDDEN,
        'Only the owner can format this event.',
      );
    // Explicit full formatting is allowed at any stage. Lock the same event row
    // as configuration mutations and reject stale or mismatched confirmations.
    const locked = await ctx.db.hackathon.updateMany({
      where: { id: hackathonId, name: input.eventName },
      data: { status: 'DRAFT' },
    });
    if (locked.count !== 1)
      throw new AppError(
        AppErrorCode.CONFLICT,
        'The event name does not match. Refresh and enter the current event name exactly.',
        { eventName: ['Enter the current event name exactly as shown.'] },
      );
    const overall = await ctx.db.judgingCategory.findFirst({
      where: { hackathonId, kind: 'OVERALL' },
      select: { id: true },
    });
    if (!overall)
      throw new AppError(
        AppErrorCode.INVALID_STATE,
        'The required Overall category is missing. Formatting could not be completed.',
      );

    // Delete dependent judging data through projects before removing rubrics/users.
    const projects = await ctx.db.project.deleteMany({
      where: { hackathonId },
    });
    await ctx.db.invitation.deleteMany({ where: { hackathonId } });
    const categories = await ctx.db.judgingCategory.deleteMany({
      where: { hackathonId, kind: { not: 'OVERALL' } },
    });
    await ctx.db.rubric.deleteMany({ where: { categoryId: overall.id } });
    await ctx.db.judgeCategory.deleteMany({
      where: { categoryId: overall.id },
    });
    const rooms = await ctx.db.room.deleteMany({ where: { hackathonId } });
    await ctx.db.judgingCategory.update({
      where: { id: overall.id, hackathonId },
      data: {
        name: 'Overall',
        description: 'The default judging track.',
        method: 'RELATIVE',
        status: 'NOT_STARTED',
        timerSeconds: 300,
        minEvaluations: 4,
        targetEvaluations: null,
        isVisible: true,
        isEnabled: true,
        sortOrder: 0,
        startedAt: null,
        endedAt: null,
      },
    });
    // This deployment has one event. Account/session deletion also revokes all
    // non-owner access; keep the owner and the one-time installation claim.
    const accounts = await ctx.db.user.deleteMany({
      where: { id: { not: ctx.actor.userId }, role: { not: 'OWNER' } },
    });
    await ctx.db.verification.deleteMany({});
    await ctx.db.hackathon.update({
      where: { id: hackathonId },
      data: {
        name: null,
        status: 'DRAFT',
        scoreScale: 5,
        roomSwitchPercent: 25,
      },
    });
    return {
      hackathonId,
      previousName: input.eventName,
      deleted: {
        projects: projects.count,
        categories: categories.count,
        rooms: rooms.count,
        accounts: accounts.count,
      },
    };
  },
  {
    audit: {
      entityType: 'Hackathon',
      getEntityId: ({ result }) => result.hackathonId,
      getBefore: ({ result }) => ({ name: result.previousName }),
      getAfter: ({ result }) => ({
        formatted: true,
        name: null,
        deleted: result.deleted,
      }),
    },
  },
);
