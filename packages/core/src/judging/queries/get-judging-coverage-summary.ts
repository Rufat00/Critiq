import { z } from 'zod';
import { judgingQuery } from '../shared/judging-operation';
import { loadJudgingState } from '../shared/load-judging-state';
import {
  calculateCoverageDeficits,
  summarizeCoverage,
} from '../shared/coverage-math';
export const getJudgingCoverageSummary = judgingQuery(
  'judging.coverage.get',
  z.object({}),
  true,
)(async ({ ctx }) => {
  const state = await loadJudgingState(ctx);
  return state.policy.categories.map((policy) => {
    const category = state.categories.find((c) => c.id === policy.categoryId)!;
    const projects = policy.projectIds.map((projectId) => {
      const completed = new Set(
        category.evaluations
          .filter((e) => e.projectId === projectId)
          .map((e) => e.judgeId),
      ).size;
      const reserved = state.visits.filter(
        (v) =>
          v.projectId === projectId &&
          v.assignments.some(
            (a) =>
              a.categoryId === category.id &&
              ['ASSIGNED', 'IN_PROGRESS'].includes(a.status),
          ),
      ).length;
      return {
        projectId,
        ...calculateCoverageDeficits(completed, reserved, policy),
      };
    });
    return {
      categoryId: category.id,
      projects,
      summary: summarizeCoverage(
        projects.map((p) => p.completed),
        policy.minimumEvaluations,
      ),
    };
  });
});
