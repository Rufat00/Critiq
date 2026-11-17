import { judgingQuery } from '../shared/judging-operation';
import { getCompetitionResultsSchema } from '../schemas/get-competition-results-schema';
import { loadCompetitionResults } from '../shared/load-competition-results';
import { analyzeResultUncertainty } from '../results/analyze-result-uncertainty';
export const getCompetitionResults = judgingQuery(
  'judging.results.get',
  getCompetitionResultsSchema,
  true,
)(async ({ ctx, input }) => {
  const result = await loadCompetitionResults(ctx, input.categoryId);
  const published = await ctx.db.competitionResultSnapshot.findFirst({
    where: {
      categoryId: input.categoryId,
      supersededAt: null,
      category: { hackathonId: ctx.hackathonId! },
    },
    orderBy: { createdAt: 'desc' },
  });
  return {
    ...result,
    uncertainty: input.includeUncertainty
      ? analyzeResultUncertainty(result.policy, result.evidence)
      : { status: 'NOT_REQUESTED' as const },
    published,
  };
});
