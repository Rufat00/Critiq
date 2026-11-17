import { createHash } from 'node:crypto';
import type { AppContext } from '../../context';
import { loadJudgingState } from './load-judging-state';
import { invalid } from './judging-operation';
import {
  calculateCompetitionResults,
  type CompetitionEvidence,
} from '../results/calculate-competition-results';
export async function loadCompetitionResults(
  ctx: AppContext,
  categoryId: string,
) {
  const state = await loadJudgingState(ctx),
    policy = state.policy.categories.find((c) => c.categoryId === categoryId),
    category = state.categories.find((c) => c.id === categoryId);
  if (!policy || !category) invalid('Competition is unavailable.');
  const evaluations = await ctx.db.evaluation.findMany({
    where: {
      categoryId,
      isExcluded: false,
      category: { hackathonId: state.hackathonId },
    },
    include: { scores: { orderBy: { criterionId: 'asc' } } },
    orderBy: { id: 'asc' },
  });
  const revisions = await ctx.db.rankingRevision.findMany({
    where: { categoryId },
  });
  const evidence: CompetitionEvidence = {
    evaluations: evaluations.map((e) => ({
      judgeId: e.judgeId,
      projectId: e.projectId,
      ordinalRating: e.ordinalRating,
      marks: e.scores.map((s) => ({
        criterionId: s.criterionId,
        value: Number(s.score),
      })),
    })),
    rankings: [...new Set(category.rankings.map((r) => r.judgeId))]
      .sort()
      .map((judgeId) => ({
        judgeId,
        revision: revisions.find((r) => r.judgeId === judgeId)?.revision ?? 0,
        orderedProjectIds: category.rankings
          .filter((r) => r.judgeId === judgeId)
          .sort((a, b) => a.position - b.position)
          .map((r) => r.projectId),
      })),
    activeAssignments: state.visits.reduce(
      (sum, v) =>
        sum +
        v.assignments.filter(
          (a) =>
            a.categoryId === categoryId &&
            ['ASSIGNED', 'IN_PROGRESS'].includes(a.status),
        ).length,
      0,
    ),
  };
  const result = calculateCompetitionResults(policy, evidence);
  return {
    evidenceFingerprint: createHash('sha256')
      .update(JSON.stringify(evidence))
      .digest('hex'),
    scoringRevision: state.config.revision,
    policy,
    evidence,
    ...result,
  };
}
