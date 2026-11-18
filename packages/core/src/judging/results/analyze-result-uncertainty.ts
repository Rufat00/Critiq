import type { JudgingPolicy } from '../schemas/configure-judging-schema';
import {
  calculateCompetitionResults,
  type CompetitionEvidence,
} from './calculate-competition-results';
// Resample whole judge portfolios, preserving correlations across all observations and pairs.
export function analyzeResultUncertainty(
  policy: JudgingPolicy['categories'][number],
  evidence: CompetitionEvidence,
  iterations = 200,
  seed = 1,
) {
  if (!Number.isSafeInteger(iterations) || iterations < 1 || iterations > 2000)
    throw new RangeError('Invalid bootstrap iterations.');
  const judges = [
    ...new Set(evidence.evaluations.map((e) => e.judgeId)),
  ].sort();
  if (
    judges.length < 5 ||
    policy.projectIds.some(
      (id) => evidence.evaluations.filter((e) => e.projectId === id).length < 3,
    )
  )
    return {
      status: 'INSUFFICIENT_EVIDENCE' as const,
      frequencies: [],
      iterations: 0,
    };
  let state = seed >>> 0;
  const random = () => {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    return state / 4294967296;
  };
  const totals = new Map(
    policy.projectIds.map((id) => [id, { top1: 0, top3: 0 }]),
  );
  let scored = 0;
  for (let b = 0; b < iterations; b++) {
    const evaluations: CompetitionEvidence['evaluations'] = [],
      rankings: CompetitionEvidence['rankings'] = [];
    for (let i = 0; i < judges.length; i++) {
      const id = judges[Math.floor(random() * judges.length)]!,
        copy = `cluster-${i}`;
      evaluations.push(
        ...evidence.evaluations
          .filter((e) => e.judgeId === id)
          .map((e) => ({ ...e, judgeId: copy })),
      );
      rankings.push(
        ...evidence.rankings
          .filter((r) => r.judgeId === id)
          .map((r) => ({ ...r, judgeId: copy })),
      );
    }
    const result = calculateCompetitionResults(policy, {
      evaluations,
      rankings,
      activeAssignments: 0,
    });
    if (result.leaderboard.some((r) => r.score === null)) continue;
    scored++;
    for (const row of result.leaderboard) {
      const total = totals.get(row.projectId)!;
      if (row.rank === 1) total.top1++;
      if (row.rank !== null && row.rank <= 3) total.top3++;
    }
  }
  return {
    status: 'CONDITIONAL_JUDGE_BOOTSTRAP' as const,
    iterations: scored,
    seed,
    frequencies: policy.projectIds.map((projectId) => ({
      projectId,
      top1: scored ? totals.get(projectId)!.top1 / scored : null,
      top3: scored ? totals.get(projectId)!.top3 / scored : null,
    })),
    assumption:
      'Conditional on observed judges and assignment design; shared ties count as selections, frequencies need not sum to one.',
  };
}
