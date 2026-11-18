import { updateRelativeRankingSchema } from '../schemas/update-relative-ranking-schema';
import {
  judgingMutation,
  invalid,
  forbidden,
  conflict,
} from '../shared/judging-operation';
import { saveEvaluation } from '../shared/save-evaluation';
export const updateRelativeRanking = judgingMutation(
  'judging.rankings.update',
  updateRelativeRankingSchema,
)(async ({ ctx, input, event }) => {
  if (event.status !== 'JUDGING')
    invalid('Rankings can only change while judging is running.');
  if (ctx.actor.type !== 'user') forbidden();
  const judgeId = ctx.actor.userId;
  const category = await ctx.db.judgingCategory.findFirst({
    where: {
      id: input.categoryId,
      hackathonId: event.id,
      isEnabled: true,
      status: 'ACTIVE',
      method: 'RELATIVE',
      judges: { some: { userId: judgeId, isActive: true } },
    },
  });
  if (!category) forbidden();
  const revision = await ctx.db.rankingRevision.findUnique({
    where: { categoryId_judgeId: { categoryId: category.id, judgeId } },
  });
  const existing = await ctx.db.relativeRanking.findMany({
    where: { categoryId: category.id, judgeId },
    orderBy: { position: 'asc' },
  });
  // A replay after a committed ranking is harmless, but never accepts a changed stale order.
  if ((revision?.revision ?? 0) !== input.expectedRevision) {
    if (
      revision?.revision === input.expectedRevision + 1 &&
      JSON.stringify(existing.map((r) => r.projectId)) ===
        JSON.stringify(input.orderedProjectIds)
    )
      return {
        revision: revision.revision,
        orderedProjectIds: input.orderedProjectIds,
      };
    conflict(
      'Your ranking changed in another request. Refresh before reordering.',
    );
  }
  if (input.visitId && input.assignmentId) {
    const assignment = await ctx.db.judgingAssignment.findFirst({
      where: {
        id: input.assignmentId,
        categoryId: category.id,
        judgeId,
        visitId: input.visitId,
      },
    });
    if (!assignment) forbidden();
    await saveEvaluation(
      ctx,
      { visitId: input.visitId, assignmentId: input.assignmentId },
      'RELATIVE',
    );
  }
  const observations = await ctx.db.evaluation.findMany({
    where: { categoryId: category.id, judgeId, isExcluded: false },
    select: { projectId: true },
  });
  if (
    observations.length !== input.orderedProjectIds.length ||
    observations.some((e) => !input.orderedProjectIds.includes(e.projectId))
  )
    invalid(
      'Provide a complete ordering of every project you have evaluated in this competition.',
    );
  await ctx.db.relativeRanking.deleteMany({
    where: { categoryId: category.id, judgeId },
  });
  await ctx.db.relativeRanking.createMany({
    data: input.orderedProjectIds.map((projectId, i) => ({
      categoryId: category.id,
      judgeId,
      projectId,
      position: i + 1,
    })),
  });
  const next = (revision?.revision ?? 0) + 1;
  await ctx.db.rankingRevision.upsert({
    where: { categoryId_judgeId: { categoryId: category.id, judgeId } },
    create: { categoryId: category.id, judgeId, revision: next },
    update: { revision: next },
  });
  return { revision: next, orderedProjectIds: input.orderedProjectIds };
});
