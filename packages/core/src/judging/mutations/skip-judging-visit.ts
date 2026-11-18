import { skipJudgingVisitSchema } from '../schemas/skip-judging-visit-schema';
import { judgingMutation, invalid } from '../shared/judging-operation';
import { requireVisit } from '../shared/require-visit';
export const skipJudgingVisit = judgingMutation(
  'judging.visits.skip',
  skipJudgingVisitSchema,
)(async ({ ctx, input, event }) => {
  if (!['JUDGING', 'PAUSED'].includes(event.status))
    invalid('This judging session is closed.');
  const visit = await requireVisit(ctx, input.visitId);
  if (
    input.assignmentId &&
    !visit.assignments.some((a) => a.id === input.assignmentId)
  )
    invalid('The evaluation is not part of this visit.');
  await ctx.db.judgingAssignment.updateMany({
    where: {
      visitId: visit.id,
      ...(input.assignmentId ? { id: input.assignmentId } : {}),
      status: { in: ['ASSIGNED', 'IN_PROGRESS'] },
    },
    data: {
      status: 'SKIPPED',
      skipReason: input.reason,
      finishedAt: new Date(),
    },
  });
  if (!input.assignmentId)
    await ctx.db.judgingVisit.update({
      where: { id: visit.id },
      data: {
        status: visit.assignments.some((a) => a.status === 'COMPLETED')
          ? 'COMPLETED'
          : 'SKIPPED',
        reason: input.reason,
        finishedAt: new Date(),
      },
    });
  return { visitId: visit.id, reason: input.reason };
});
