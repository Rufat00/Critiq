import { getCoverageStatus } from '../shared/get-coverage-status';
import { z } from 'zod';
import { requireHackathonId } from '../../context';
import { judgingQuery, invalid } from '../shared/judging-operation';
import { loadJudgingState } from '../shared/load-judging-state';
export const getAdminJudgingDashboard = judgingQuery(
  'judging.dashboard',
  z.object({}),
  true,
)(async ({ ctx }) => {
  const event = await ctx.db.hackathon.findUnique({
    where: { id: requireHackathonId(ctx) },
  });
  if (!event) invalid('Hackathon is unavailable.');
  const state = await loadJudgingState(ctx);
  const started = await ctx.db.judgingCategory.findFirst({
    where: { hackathonId: event.id, startedAt: { not: null } },
    orderBy: { startedAt: 'asc' },
    select: { startedAt: true },
  });
  return {
    name: event.name ?? '',
    status: event.status,
    startedAt: started?.startedAt?.toISOString() ?? null,
    tracks: state.policy.categories
      .filter(
        (p) =>
          state.categories.find((c) => c.id === p.categoryId)?.kind !==
          'CHALLENGE',
      )
      .map((policy) => {
        const category = state.categories.find(
          (c) => c.id === policy.categoryId,
        )!;
        return {
          id: category.id,
          name: category.name,
          minimum: policy.minimumEvaluations,
          target: policy.targetEvaluations ?? policy.desiredEvaluations,
          maximum: policy.maximumEvaluations,
          projects: state.projects
            .filter((p) => policy.projectIds.includes(p.id))
            .map((project) => {
              const completed = new Set(
                category.evaluations
                  .filter((e) => e.projectId === project.id)
                  .map((e) => e.judgeId),
              ).size;
              const visits = state.visits.filter(
                (v) =>
                  v.projectId === project.id &&
                  v.assignments.some(
                    (a) =>
                      a.categoryId === category.id &&
                      ['ASSIGNED', 'IN_PROGRESS'].includes(a.status),
                  ),
              );
              return {
                id: project.id,
                name: project.name,
                tableNumber: project.tableNumber,
                completed,
                reserved: visits.length,
                beingJudged: visits.some((v) => v.status === 'IN_PROGRESS'),
                coverageStatus: getCoverageStatus(
                  completed,
                  policy.minimumEvaluations,
                  policy.targetEvaluations ?? policy.desiredEvaluations,
                  policy.maximumEvaluations,
                ),
                assignments: completed + visits.length,
              };
            })
            .sort(
              (a, b) =>
                a.assignments - b.assignments ||
                a.name.localeCompare(b.name) ||
                a.id.localeCompare(b.id),
            ),
        };
      }),
  };
});
export type AdminJudgingDashboard = Awaited<
  ReturnType<typeof getAdminJudgingDashboard>
>;
