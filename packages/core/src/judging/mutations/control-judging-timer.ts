import { controlJudgingTimerSchema } from '../schemas/control-judging-timer-schema';
import { judgingMutation, invalid } from '../shared/judging-operation';
import { requireVisit } from '../shared/require-visit';
import { presentationElapsedSeconds } from '../shared/presentation-timer';
export const controlJudgingTimer = judgingMutation(
  'judging.timer.control',
  controlJudgingTimerSchema,
)(async ({ ctx, input, event }) => {
  if (event.status !== 'JUDGING') invalid('Judging is not running.');
  const visit = await requireVisit(ctx, input.visitId);
  const now = new Date();
  if (visit.presentationFinishedAt) {
    if (input.action === 'FINISH') return { visitId: visit.id };
    invalid('This presentation has finished. Submit your evaluation.');
  }
  if (input.action !== 'START' && !visit.timerStartedAt)
    invalid('Start the presentation first.');
  await ctx.db.judgingVisit.update({
    where: { id: visit.id },
    data: {
      status: 'IN_PROGRESS',
      timerStartedAt: visit.timerStartedAt ?? now,
      timerElapsedSeconds: presentationElapsedSeconds(visit, now),
      timerRunningSince:
        input.action === 'PAUSE' || input.action === 'FINISH' ? null : now,
      presentationFinishedAt: input.action === 'FINISH' ? now : null,
    },
  });
  await ctx.db.judgingAssignment.updateMany({
    where: { visitId: visit.id, status: 'ASSIGNED' },
    data: { status: 'IN_PROGRESS', startedAt: now },
  });
  return { visitId: visit.id };
});
