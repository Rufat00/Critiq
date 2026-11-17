import { excludeEvaluationSchema } from '../schemas/exclude-evaluation-schema';
import { judgingMutation, invalid, json } from '../shared/judging-operation';
export const excludeEvaluation = judgingMutation(
  'judging.evaluations.exclude',
  excludeEvaluationSchema,
  true,
)(async ({ ctx, input, event }) => {
  if (event.status !== 'PAUSED')
    invalid('Pause judging before excluding evidence.');
  const evaluation = await ctx.db.evaluation.findFirst({
    where: { id: input.evaluationId, category: { hackathonId: event.id } },
    include: { scores: true, category: true },
  });
  if (!evaluation) invalid('Evaluation is unavailable.');
  if (evaluation.category.status === 'COMPLETED')
    invalid('Reopen the competition before changing published evidence.');
  if (evaluation.isExcluded) return { evaluation: json(evaluation) };
  await ctx.db.evaluation.update({
    where: { id: evaluation.id },
    data: { isExcluded: true, exclusionReason: input.reason },
  });
  const where = {
    categoryId: evaluation.categoryId,
    judgeId: evaluation.judgeId,
  };
  const remaining = await ctx.db.relativeRanking.findMany({
    where: { ...where, projectId: { not: evaluation.projectId } },
    orderBy: { position: 'asc' },
  });
  await ctx.db.relativeRanking.deleteMany({ where });
  if (remaining.length)
    await ctx.db.relativeRanking.createMany({
      data: remaining.map((r, i) => ({
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
  return { evaluation: json(evaluation), reason: input.reason, excluded: true };
});
