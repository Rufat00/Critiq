import { presentationElapsedSeconds } from '../shared/presentation-timer';
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
  if (event.status !== 'PAUSED') await expireReservations(ctx, event.id);
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
  const now = new Date();
  if (input.status === 'DELIBERATION') {
    if (input.eventName !== event.name)
      invalid('Enter the exact hackathon name to finish judging.');
    // Keep completed evidence. Release unfinished targets atomically with closing.
    await ctx.db.judgingAssignment.updateMany({
      where: {
        category: { hackathonId: event.id },
        status: { in: ['ASSIGNED', 'IN_PROGRESS'] },
      },
      data: {
        status: 'SKIPPED',
        skipReason: 'Organizer finished judging.',
        finishedAt: now,
      },
    });
    const visits = await ctx.db.judgingVisit.findMany({
      where: {
        hackathonId: event.id,
        status: { in: ['ASSIGNED', 'IN_PROGRESS'] },
      },
      include: { assignments: true },
    });
    for (const visit of visits)
      await ctx.db.judgingVisit.update({
        where: { id: visit.id },
        data: {
          status: visit.assignments.some((a) => a.status === 'COMPLETED')
            ? 'COMPLETED'
            : 'SKIPPED',
          finishedAt: now,
          timerRunningSince: null,
          timerElapsedSeconds: presentationElapsedSeconds(visit, now),
        },
      });
  }
  if (input.status === 'PAUSED') {
    const visits = await ctx.db.judgingVisit.findMany({
      where: {
        hackathonId: event.id,
        status: { in: ['ASSIGNED', 'IN_PROGRESS'] },
        timerRunningSince: { not: null },
      },
    });
    for (const visit of visits)
      await ctx.db.judgingVisit.update({
        where: { id: visit.id },
        data: {
          timerRunningSince: null,
          timerElapsedSeconds: presentationElapsedSeconds(visit, now),
        },
      });
  }
  if (input.status === 'JUDGING' && event.judgingPausedAt) {
    const pauseMs = now.getTime() - event.judgingPausedAt.getTime();
    const visits = await ctx.db.judgingVisit.findMany({
      where: {
        hackathonId: event.id,
        status: { in: ['ASSIGNED', 'IN_PROGRESS'] },
      },
    });
    for (const visit of visits) {
      const expiresAt = new Date(visit.expiresAt.getTime() + pauseMs);
      await ctx.db.judgingVisit.update({
        where: { id: visit.id },
        data: { expiresAt },
      });
      await ctx.db.judgingAssignment.updateMany({
        where: {
          visitId: visit.id,
          status: { in: ['ASSIGNED', 'IN_PROGRESS'] },
        },
        data: { expiresAt },
      });
    }
  }
  await ctx.db.hackathon.update({
    where: { id: event.id },
    data: {
      status: input.status,
      judgingPausedAt: input.status === 'PAUSED' ? now : null,
    },
  });
  await ctx.db.judgingCategory.updateMany({
    where: { hackathonId: event.id, status: { in: ['ACTIVE', 'PAUSED'] } },
    data: { status: input.status === 'JUDGING' ? 'ACTIVE' : 'PAUSED' },
  });
  return { previousStatus: event.status, ...input };
});
