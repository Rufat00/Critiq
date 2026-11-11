import { createMutation } from '../../shared/operations';
import { AppError, AppErrorCode } from '../../shared/errors';
import { lockDraft } from '../lib/lock-draft';
import { resetHackathonDataSchema } from '../schemas/reset-hackathon-data-schema';
import { reassignProjectLocations } from '../../projects/lib/reassign-project-locations';

export const resetHackathonData = createMutation({
  name: 'hackathon.data.reset',
  schema: resetHackathonDataSchema,
  roles: ['OWNER'],
})(
  async ({ ctx, input }) => {
    const hackathonId = await lockDraft(ctx);
    // Even a manually reopened draft must not erase judging history.
    const [started, assignments, evaluations, rankings, flags] =
      await Promise.all([
        ctx.db.judgingCategory.count({
          where: {
            hackathonId,
            OR: [{ startedAt: { not: null } }, { rubric: { isLocked: true } }],
          },
        }),
        ctx.db.judgingAssignment.count({
          where: { category: { hackathonId } },
        }),
        ctx.db.evaluation.count({ where: { category: { hackathonId } } }),
        ctx.db.relativeRanking.count({ where: { category: { hackathonId } } }),
        ctx.db.projectFlag.count({ where: { project: { hackathonId } } }),
      ]);
    if (started || assignments || evaluations || rankings || flags)
      throw new AppError(
        AppErrorCode.INVALID_STATE,
        'Data cannot be reset after judging activity has been recorded.',
      );

    let deleted = 0;
    if (input.section === 'projects') {
      deleted = (await ctx.db.project.deleteMany({ where: { hackathonId } }))
        .count;
    } else if (input.section === 'judges') {
      // Accounts belong to this single-installation deployment; never delete organizers.
      const judges = await ctx.db.user.findMany({
        where: { role: 'JUDGE' },
        select: { id: true },
      });
      const judgeIds = judges.map((judge) => judge.id);
      await ctx.db.invitation.deleteMany({
        where: {
          hackathonId,
          OR: [{ role: 'JUDGE' }, { createdById: { in: judgeIds } }],
        },
      });
      await ctx.db.invitation.updateMany({
        where: { hackathonId, redeemedById: { in: judgeIds } },
        data: { redeemedById: null },
      });
      await ctx.db.invitationRedemption.deleteMany({
        where: { userId: { in: judgeIds }, invitation: { hackathonId } },
      });
      deleted = (
        await ctx.db.user.deleteMany({
          where: { role: 'JUDGE', id: { in: judgeIds } },
        })
      ).count;
    } else if (input.section === 'categories') {
      const overall = await ctx.db.judgingCategory.findFirst({
        where: { hackathonId, kind: 'OVERALL' },
        select: { id: true, track: { select: { id: true } } },
      });
      if (!overall?.track)
        throw new AppError(
          AppErrorCode.INVALID_STATE,
          'The required Overall category is missing. Categories could not be reset.',
        );
      await ctx.db.project.updateMany({
        where: { hackathonId },
        data: { trackId: overall.track.id },
      });
      deleted = (
        await ctx.db.judgingCategory.deleteMany({
          where: { hackathonId, kind: { not: 'OVERALL' } },
        })
      ).count;
      await ctx.db.rubric.deleteMany({ where: { categoryId: overall.id } });
      await ctx.db.judgeCategory.deleteMany({
        where: { categoryId: overall.id },
      });
      await ctx.db.invitationCategory.deleteMany({
        where: { categoryId: overall.id },
      });
      await ctx.db.categoryProjectPriority.deleteMany({
        where: { categoryId: overall.id },
      });
      await ctx.db.judgingCategory.update({
        where: { id: overall.id, hackathonId },
        data: {
          name: 'Overall',
          description: null,
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
      await reassignProjectLocations(ctx);
    } else {
      await ctx.db.judgeCategory.updateMany({
        where: { category: { hackathonId } },
        data: { currentRoomId: null },
      });
      await ctx.db.project.updateMany({
        where: { hackathonId },
        data: { roomId: null, tableNumber: null },
      });
      deleted = (await ctx.db.room.deleteMany({ where: { hackathonId } }))
        .count;
    }
    return { hackathonId, section: input.section, deleted };
  },
  {
    audit: {
      entityType: 'Hackathon',
      getEntityId: ({ result }) => result.hackathonId,
      getAfter: ({ result }) => ({
        section: result.section,
        deleted: result.deleted,
        acknowledged: true,
      }),
    },
  },
);
