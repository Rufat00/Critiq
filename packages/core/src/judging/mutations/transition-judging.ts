import { transitionJudgingSchema } from '../schemas/transition-judging-schema';
import { judgingMutation, invalid } from '../shared/judging-operation';
import { expireReservations } from '../shared/expire-reservations';
export const transitionJudging = judgingMutation(
  'judging.transition',
  transitionJudgingSchema,
  true,
)(async ({ ctx, input, event }) => {
  const allowed: Record<string, string[]> = {
    JUDGING: ['PAUSED', 'DELIBERATION'],
    PAUSED: ['JUDGING', 'DELIBERATION'],
    DELIBERATION: ['COMPLETED'],
  };
  if (!allowed[event.status]?.includes(input.status))
    invalid('That judging stage transition is not allowed.');
  await expireReservations(ctx, event.id);
  if (
    input.status === 'COMPLETED' &&
    (await ctx.db.judgingCategory.count({
      where: {
        hackathonId: event.id,
        isEnabled: true,
        status: { not: 'COMPLETED' },
      },
    }))
  )
    invalid('Finalize every enabled competition before completing the event.');
  if (
    input.status === 'DELIBERATION' &&
    (await ctx.db.judgingVisit.count({
      where: {
        hackathonId: event.id,
        status: { in: ['ASSIGNED', 'IN_PROGRESS'] },
      },
    }))
  )
    invalid('Resolve active visits before closing judging.');
  await ctx.db.hackathon.update({
    where: { id: event.id },
    data: { status: input.status },
  });
  await ctx.db.judgingCategory.updateMany({
    where: { hackathonId: event.id, status: { in: ['ACTIVE', 'PAUSED'] } },
    data: { status: input.status === 'JUDGING' ? 'ACTIVE' : 'PAUSED' },
  });
  return { previousStatus: event.status, ...input };
});
