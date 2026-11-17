import { calculateOrdinalSuperiority } from '../rating-scale/calculate-ordinal-superiority';
import type { JudgingPolicy } from '../schemas/configure-judging-schema';
import type { OrdinalRating, RankingEvidence } from '../shared/judging-types';
import { derivePairwiseVotes } from '../relative/derive-pairwise-votes';
import { calculateCopeland } from '../relative/calculate-copeland';
import { fitBradleyTerry } from '../relative/fit-bradley-terry';
import { calculateRubricEvaluation } from '../rubric/calculate-rubric-evaluation';
import { aggregateRubricScores } from '../rubric/aggregate-rubric-scores';
import { analyzeJudgeSeverity } from '../rubric/analyze-judge-severity';
import { aggregateRatingScale } from '../rating-scale/aggregate-rating-scale';
import { calculateCompetitionReadiness } from './calculate-competition-readiness';
import { summarizeCoverage } from '../shared/coverage-math';
export type CompetitionEvidence = {
  evaluations: {
    judgeId: string;
    projectId: string;
    ordinalRating: number | null;
    marks: { criterionId: string; value: number }[];
  }[];
  rankings: RankingEvidence[];
  activeAssignments: number;
};
export function calculateCompetitionResults(
  policy: JudgingPolicy['categories'][number],
  evidence: CompetitionEvidence,
) {
  const ids = policy.projectIds;
  const counts = ids.map(
    (id) =>
      new Set(
        evidence.evaluations
          .filter((e) => e.projectId === id)
          .map((e) => e.judgeId),
      ).size,
  );
  let integrityReady =
    new Set(
      evidence.evaluations.map((e) => JSON.stringify([e.judgeId, e.projectId])),
    ).size === evidence.evaluations.length &&
    evidence.evaluations.every((e) => ids.includes(e.projectId));
  let rows: {
      projectId: string;
      score: number | null;
      count: number;
      detail: unknown;
    }[] = [],
    diagnostics: unknown = {},
    structureReady = true;
  if (policy.method === 'RELATIVE') {
    integrityReady =
      integrityReady &&
      evidence.rankings.every((r) => {
        const seen = evidence.evaluations
          .filter((e) => e.judgeId === r.judgeId)
          .map((e) => e.projectId);
        return (
          seen.length === r.orderedProjectIds.length &&
          seen.every((id) => r.orderedProjectIds.includes(id))
        );
      }) &&
      evidence.evaluations.every((e) =>
        evidence.rankings.some(
          (r) =>
            r.judgeId === e.judgeId &&
            r.orderedProjectIds.includes(e.projectId),
        ),
      );
    const matrix = derivePairwiseVotes(ids, evidence.rankings),
      copeland = calculateCopeland(matrix),
      bt = fitBradleyTerry(matrix, policy.lambda);
    structureReady =
      copeland.graph.connected &&
      (policy.relativeEstimator === 'BRADLEY_TERRY_V1'
        ? bt.converged
        : new Set(copeland.graph.degrees).size <= 1);
    rows = ids.map((projectId, i) => ({
      projectId,
      count: counts[i]!,
      score:
        policy.relativeEstimator === 'COPELAND_V1'
          ? copeland.rows[i]!.score
          : bt.rows[i]!.strength,
      detail: { copeland: copeland.rows[i], bradleyTerry: bt.rows[i] },
    }));
    diagnostics = {
      matrix,
      copeland,
      bradleyTerry: bt,
      portfolioSizes: evidence.rankings.map((r) => ({
        judgeId: r.judgeId,
        count: r.orderedProjectIds.length,
      })),
    };
  } else if (policy.method === 'RATING_SCALE') {
    const ratings = evidence.evaluations.map((e) => ({
      judgeId: e.judgeId,
      projectId: e.projectId,
      rating: e.ordinalRating as OrdinalRating,
    }));
    const ratingRows = aggregateRatingScale(ids, ratings);
    diagnostics = {
      pairwise: ratingRows.map((p) => ({
        projectId: p.projectId,
        opponents: ratingRows
          .filter((q) => q.projectId !== p.projectId)
          .map((q) => ({
            projectId: q.projectId,
            superiority: calculateOrdinalSuperiority(
              p.frequencies,
              q.frequencies,
            ),
          })),
      })),
    };
    rows = ratingRows.map((r) => ({
      projectId: r.projectId,
      score: r.score,
      count: r.count,
      detail: { frequencies: r.frequencies },
    }));
  } else {
    const scores = evidence.evaluations.map((e) => ({
      ...e,
      score: calculateRubricEvaluation(policy.rubric, e.marks),
    }));
    rows = ids.map((projectId) => {
      const summary = aggregateRubricScores(
        scores.filter((e) => e.projectId === projectId),
      );
      return {
        projectId,
        score: summary.mean,
        count: summary.count,
        detail: summary,
      };
    });
    diagnostics = analyzeJudgeSeverity(scores);
  }
  const sorted = [...rows].sort(
    (a, b) =>
      (b.score ?? -Infinity) - (a.score ?? -Infinity) ||
      a.projectId.localeCompare(b.projectId),
  );
  let groupScore: number | null = null,
    sharedRank = 0;
  const leaderboard = sorted.map((r, i) => {
    if (r.score === null) return { ...r, rank: null };
    if (groupScore === null || groupScore - r.score > 1e-9) {
      groupScore = r.score;
      sharedRank = i + 1;
    }
    return { ...r, rank: sharedRank };
  });
  const ties = leaderboard
    .filter(
      (r) =>
        r.rank !== null &&
        leaderboard.filter((q) => q.rank === r.rank).length > 1,
    )
    .map((r) => r.projectId);
  const readiness = calculateCompetitionReadiness(
    counts,
    policy.minimumEvaluations,
    evidence.activeAssignments,
    structureReady,
    integrityReady,
  );
  return {
    method: policy.method,
    algorithm:
      policy.method === 'RELATIVE'
        ? policy.relativeEstimator
        : policy.method === 'RUBRIC'
          ? 'WEIGHTED_MEAN_V1'
          : 'ORDINAL_SUPERIORITY_V1',
    leaderboard,
    diagnostics,
    coverage: summarizeCoverage(counts, policy.minimumEvaluations),
    readiness,
    integrityReady,
    structureReady,
    ties,
    unresolvedWinner:
      leaderboard.length > 1 &&
      leaderboard[0]?.rank !== null &&
      leaderboard[0]?.rank === leaderboard[1]?.rank,
    unfinishedTargets: ids.filter(
      (_, i) =>
        counts[i]! < (policy.targetEvaluations ?? policy.desiredEvaluations),
    ),
    tiePolicy:
      'Shared rank within 1e-9 numerical tolerance; award ties require deliberation. IDs affect display order only.',
  };
}
