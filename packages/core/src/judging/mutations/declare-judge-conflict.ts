import { declareJudgeConflictSchema } from '../schemas/declare-judge-conflict-schema';
import {
  judgingMutation,
  invalid,
  forbidden,
  json,
} from '../shared/judging-operation';
export const declareJudgeConflict = judgingMutation(
  'judging.conflicts.declare',
  declareJudgeConflictSchema,
)(async ({ ctx, input, event }) => {
  if (
    !['JUDGING', 'PAUSED'].includes(event.status) ||
    ctx.actor.type !== 'user' ||
    ctx.actor.role !== 'JUDGE'
  )
    invalid('An open session and judge account are required.');
  const judgeId = ctx.actor.userId;
  const project = await ctx.db.project.findFirst({
    where: {
      id: input.projectId,
      hackathonId: event.id,
      OR: [
        { assignments: { some: { judgeId } } },
        {
          track: {
            category: { judges: { some: { userId: judgeId, isActive: true } } },
          },
        },
        {
          challenges: {
            some: {
              challenge: {
                category: {
                  judges: { some: { userId: judgeId, isActive: true } },
                },
              },
            },
          },
        },
      ],
    },
  });
  if (!project) forbidden();
  const evaluations = await ctx.db.evaluation.findMany({
    where: { judgeId, projectId: project.id, isExcluded: false },
    include: { scores: true, category: true },
  });
  if (evaluations.some((e) => e.category.status === 'COMPLETED'))
    invalid(
      'Ask an organizer to reopen the competition before changing published evidence.',
    );
  await ctx.db.judgeConflict.upsert({
    where: { userId_projectId: { userId: judgeId, projectId: project.id } },
    create: { userId: judgeId, projectId: project.id, reason: input.reason },
    update: { reason: input.reason },
  });
  await ctx.db.evaluation.updateMany({
    where: { id: { in: evaluations.map((e) => e.id) } },
    data: { isExcluded: true, exclusionReason: input.reason },
  });
  for (const categoryId of new Set(evaluations.map((e) => e.categoryId))) {
    const where = { categoryId, judgeId };
    const ranks = await ctx.db.relativeRanking.findMany({
      where: { ...where, projectId: { not: project.id } },
      orderBy: { position: 'asc' },
    });
    await ctx.db.relativeRanking.deleteMany({ where });
    if (ranks.length)
      await ctx.db.relativeRanking.createMany({
        data: ranks.map((r, i) => ({
          ...where,
          projectId: r.projectId,
          position: i + 1,
        })),
      });
    await ctx.db.rankingRevision.upsert({
      where: { categoryId_judgeId: where },
      create: { ...where, revision: 1 },
      update: { revision: { increment: 1 } },
    });
  }
  const visits = await ctx.db.judgingVisit.findMany({
    where: {
      hackathonId: event.id,
      projectId: project.id,
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
    data: { status: 'CANCELLED', reason: input.reason, finishedAt: new Date() },
  });
  return {
    judgeId,
    projectId: project.id,
    reason: input.reason,
    excludedEvidence: json(evaluations),
  };
});
