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
    // Ready allows only judge edits and explicit stage transitions. Lock the
    // event row so formatting cannot bypass that boundary.
    const locked = await ctx.db.hackathon.updateMany({
      where: {
        id: hackathonId,
        name: input.eventName,
        status: { not: 'READY' },
      },
      data: { status: 'DRAFT' },
    });
    if (locked.count !== 1)
      throw new AppError(
        AppErrorCode.CONFLICT,
        'Return to draft before formatting a ready event. Otherwise, refresh and enter the current event name exactly.',
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
    await ctx.db.judgingVisit.deleteMany({ where: { hackathonId } });
    await ctx.db.roomStayEpoch.deleteMany({ where: { hackathonId } });
    await ctx.db.judgingConfiguration.deleteMany({ where: { hackathonId } });
    await ctx.db.competitionResultSnapshot.deleteMany({
      where: { category: { hackathonId } },
    });
    await ctx.db.rankingRevision.deleteMany({
      where: { category: { hackathonId } },
    });
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
        minEvaluations: 3,
        maxEvaluations: 9,
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
        judgingSeconds: 300,
        judgingPausedAt: null,
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
