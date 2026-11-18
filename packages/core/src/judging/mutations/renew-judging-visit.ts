import { completeJudgingVisitSchema } from '../schemas/complete-judging-visit-schema';
import { judgingMutation, invalid } from '../shared/judging-operation';
import { requireVisit } from '../shared/require-visit';
import { loadJudgingState } from '../shared/load-judging-state';
export const renewJudgingVisit = judgingMutation(
  'judging.visits.renew',
  completeJudgingVisitSchema,
)(async ({ ctx, input, event }) => {
  if (event.status !== 'JUDGING') invalid('Judging is not running.');
  const visit = await requireVisit(ctx, input.visitId);
  const state = await loadJudgingState(ctx);
  const expiresAt = new Date(
    Date.now() + state.policy.reservationMinutes * 60000,
  );
  await ctx.db.judgingVisit.update({
    where: { id: visit.id },
    data: { expiresAt },
  });
  await ctx.db.judgingAssignment.updateMany({
    where: { visitId: visit.id, status: { in: ['ASSIGNED', 'IN_PROGRESS'] } },
    data: { expiresAt },
  });
  return { visitId: visit.id, expiresAt };
});
