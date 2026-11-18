import { skipJudgingVisitSchema } from '../schemas/skip-judging-visit-schema';
import { judgingMutation, invalid } from '../shared/judging-operation';
export const cancelJudgingVisit = judgingMutation(
  'judging.visits.cancel',
  skipJudgingVisitSchema,
  true,
)(async ({ ctx, input, event }) => {
  if (!['JUDGING', 'PAUSED'].includes(event.status))
    invalid('The session is closed.');
  const visit = await ctx.db.judgingVisit.findFirst({
    where: { id: input.visitId, hackathonId: event.id },
  });
  if (!visit) invalid('Visit is unavailable.');
  if (!['ASSIGNED', 'IN_PROGRESS'].includes(visit.status))
    return { visitId: visit.id, status: visit.status };
  await ctx.db.judgingAssignment.updateMany({
    where: { visitId: visit.id, status: { in: ['ASSIGNED', 'IN_PROGRESS'] } },
    data: {
      status: 'CANCELLED',
      skipReason: input.reason,
      finishedAt: new Date(),
    },
  });
  await ctx.db.judgingVisit.update({
    where: { id: visit.id },
    data: { status: 'CANCELLED', reason: input.reason, finishedAt: new Date() },
  });
  return { visitId: visit.id, status: 'CANCELLED' as const };
});
