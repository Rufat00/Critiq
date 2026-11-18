import { setJudgeJudgingAvailabilitySchema } from '../schemas/set-judge-judging-availability-schema';
import {
  judgingMutation,
  invalid,
  forbidden,
} from '../shared/judging-operation';
export const setJudgeJudgingAvailability = judgingMutation(
  'judging.judges.availability',
  setJudgeJudgingAvailabilitySchema,
)(async ({ ctx, input, event }) => {
  if (
    !['JUDGING', 'PAUSED'].includes(event.status) ||
    ctx.actor.type !== 'user'
  )
    invalid('The session is not open.');
  const judgeId = input.judgeId ?? ctx.actor.userId;
  if (ctx.actor.role === 'JUDGE' && judgeId !== ctx.actor.userId) forbidden();
  const judge = await ctx.db.user.findFirst({
    where: {
      id: judgeId,
      isActive: true,
      role: 'JUDGE',
      categoryMemberships: {
        some: { isActive: true, category: { hackathonId: event.id } },
      },
    },
  });
  if (!judge) forbidden();
  await ctx.db.user.update({
    where: { id: judgeId },
    data: { isJudgingAvailable: input.available },
  });
  if (!input.available) {
    const visits = await ctx.db.judgingVisit.findMany({
      where: {
        hackathonId: event.id,
        judgeId,
        status: { in: ['ASSIGNED', 'IN_PROGRESS'] },
      },
    });
    await ctx.db.judgingAssignment.updateMany({
      where: {
        visitId: { in: visits.map((v) => v.id) },
        status: { in: ['ASSIGNED', 'IN_PROGRESS'] },
      },
      data: {
        status: 'CANCELLED',
        skipReason: input.reason,
        finishedAt: new Date(),
      },
    });
    await ctx.db.judgingVisit.updateMany({
      where: { id: { in: visits.map((v) => v.id) } },
      data: {
        status: 'CANCELLED',
        reason: input.reason,
        finishedAt: new Date(),
      },
    });
    await ctx.db.roomStayEpoch.updateMany({
      where: { hackathonId: event.id, judgeId, exitedAt: null },
      data: { exitedAt: new Date(), moveReason: 'JUDGE_BREAK' },
    });
  }
  return { judgeId, available: input.available, reason: input.reason };
});
