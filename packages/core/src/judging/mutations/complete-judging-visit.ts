import { completeJudgingVisitSchema } from '../schemas/complete-judging-visit-schema';
import { judgingMutation, invalid } from '../shared/judging-operation';
import { requireVisit } from '../shared/require-visit';
export const completeJudgingVisit = judgingMutation(
  'judging.visits.complete',
  completeJudgingVisitSchema,
)(async ({ ctx, input, event }) => {
  if (event.status !== 'JUDGING')
    invalid('Visits can only complete while judging is running.');
  const visit = await requireVisit(ctx, input.visitId, true);
  if (visit.status === 'COMPLETED')
    return { visitId: visit.id, status: visit.status };
  if (
    visit.assignments.some(
      (a) => !['COMPLETED', 'SKIPPED'].includes(a.status),
    ) ||
    !visit.assignments.some((a) => a.status === 'COMPLETED')
  )
    invalid(
      'Complete each targeted evaluation or skip it with a reason before finishing this visit.',
    );
  await ctx.db.judgingVisit.update({
    where: { id: visit.id },
    data: { status: 'COMPLETED', finishedAt: new Date() },
  });
  return { visitId: visit.id, status: 'COMPLETED' as const };
});
