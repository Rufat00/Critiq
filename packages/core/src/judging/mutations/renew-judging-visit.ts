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
    Math.min(
      Date.now() + state.policy.reservationMinutes * 60000,
      new Date(state.policy.endsAt).getTime(),
    ),
  );
  if (expiresAt <= new Date()) invalid('The judging window has ended.');
  await ctx.db.judgingVisit.update({
    where: { id: visit.id },
    data: { status: 'IN_PROGRESS', expiresAt },
  });
  await ctx.db.judgingAssignment.updateMany({
    where: { visitId: visit.id, status: 'ASSIGNED' },
    data: { status: 'IN_PROGRESS', expiresAt, startedAt: new Date() },
  });
  return { visitId: visit.id, expiresAt };
});
