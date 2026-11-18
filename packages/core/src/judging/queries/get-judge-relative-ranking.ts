import { getCompetitionResultsSchema } from '../schemas/get-competition-results-schema';
import { judgingQuery, forbidden } from '../shared/judging-operation';
import { requireHackathonId } from '../../context';
export const getJudgeRelativeRanking = judgingQuery(
  'judging.rankings.current',
  getCompetitionResultsSchema,
)(async ({ ctx, input }) => {
  if (ctx.actor.type !== 'user') forbidden();
  const judgeId = ctx.actor.userId;
  const category = await ctx.db.judgingCategory.findFirst({
    where: {
      id: input.categoryId,
      hackathonId: requireHackathonId(ctx),
      method: 'RELATIVE',
      judges: { some: { userId: judgeId, isActive: true } },
    },
  });
  if (!category) forbidden();
  const revision = await ctx.db.rankingRevision.findUnique({
    where: { categoryId_judgeId: { categoryId: category.id, judgeId } },
  });
  const rankings = await ctx.db.relativeRanking.findMany({
    where: { categoryId: category.id, judgeId },
    orderBy: { position: 'asc' },
    include: { project: { select: { id: true, name: true } } },
  });
  return {
    revision: revision?.revision ?? 0,
    projects: rankings.map((r) => r.project),
  };
});
