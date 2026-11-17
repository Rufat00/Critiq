import { setProjectJudgingAvailabilitySchema } from '../schemas/set-project-judging-availability-schema';
import { judgingMutation, invalid } from '../shared/judging-operation';
export const setProjectJudgingAvailability = judgingMutation(
  'judging.projects.availability',
  setProjectJudgingAvailabilitySchema,
  true,
)(async ({ ctx, input, event }) => {
  if (
    !['JUDGING', 'PAUSED'].includes(event.status) ||
    ctx.actor.type !== 'user'
  )
    invalid('The session is not open.');
  const project = await ctx.db.project.findFirst({
    where: { id: input.projectId, hackathonId: event.id },
  });
  if (!project) invalid('Project is unavailable.');
  if (input.available)
    await ctx.db.projectFlag.updateMany({
      where: {
        projectId: project.id,
        type: { in: ['ABSENT', 'UNAVAILABLE'] },
        status: 'OPEN',
      },
      data: {
        status: 'RESOLVED',
        resolvedAt: new Date(),
        resolvedById: ctx.actor.userId,
        resolution: input.reason,
      },
    });
  else {
    await ctx.db.projectFlag.create({
      data: {
        projectId: project.id,
        reportedById: ctx.actor.userId,
        type: 'UNAVAILABLE',
        note: input.reason,
      },
    });
    const visits = await ctx.db.judgingVisit.findMany({
      where: {
        projectId: project.id,
        hackathonId: event.id,
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
  }
  return input;
});
