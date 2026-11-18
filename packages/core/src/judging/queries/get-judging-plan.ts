import { z } from 'zod';
import { judgingQuery } from '../shared/judging-operation';
import { loadJudgingState } from '../shared/load-judging-state';
import { recommendCoverageTargets } from '../planning/recommend-coverage-targets';
import { calculateRemainingJudgeMinutes } from '../shared/judge-time-math';
import { requireHackathonId } from '../../context';
export const getJudgingPlan = judgingQuery(
  'judging.plan.get',
  z.object({}),
  true,
)(async ({ ctx }) => {
  const config = await ctx.db.judgingConfiguration.findUnique({
    where: { hackathonId: requireHackathonId(ctx) },
  });
  if (!config) return null;
  const state = await loadJudgingState(ctx);
  const history = await ctx.db.judgingVisit.findMany({
    where: { hackathonId: state.hackathonId },
  });
  const stays = await ctx.db.roomStayEpoch.findMany({
    where: { hackathonId: state.hackathonId },
    orderBy: { enteredAt: 'asc' },
  });
  const categories = state.policy.categories.filter((p) =>
    state.categories.some(
      (c) => c.id === p.categoryId && c.status !== 'COMPLETED',
    ),
  );
  const available = state.policy.judges.filter(
    (j) =>
      state.categories.some((c) =>
        c.judges.some((m) => m.userId === j.judgeId),
      ) && !state.visits.some((v) => v.judgeId === j.judgeId),
  );
  const live = recommendCoverageTargets({
    ...state.policy,
    completedEvaluations: state.categories.flatMap((c) =>
      c.evaluations.map((e) => ({
        judgeId: e.judgeId,
        projectId: e.projectId,
        competitionId: c.id,
      })),
    ),
    projects: [...new Set(categories.flatMap((c) => c.projectIds))].map(
      (id) => {
        const project = state.projects.find((p) => p.id === id);
        return {
          id,
          roomId: project?.roomId ?? 'UNAVAILABLE',
          competitionIds: categories
            .filter((c) => c.projectIds.includes(id))
            .map((c) => c.categoryId),
        };
      },
    ),
    competitions: categories.map((c) => ({ ...c, id: c.categoryId })),
    judges: available.map((j) => {
      const epochs = stays.filter((e) => e.judgeId === j.judgeId),
        epoch = epochs.find((e) => e.exitedAt === null);
      return {
        id: j.judgeId,
        minutes: calculateRemainingJudgeMinutes(
          j.availableMinutes,
          history.filter((v) => v.judgeId === j.judgeId),
          epochs,
          state.now,
        ),
        competitionIds: state.categories
          .filter((c) => c.judges.some((m) => m.userId === j.judgeId))
          .map((c) => c.id),
        conflictProjectIds: [
          ...new Set(categories.flatMap((c) => c.projectIds)),
        ].filter((id) => {
          const p = state.projects.find((p) => p.id === id);
          return (
            !p ||
            p.flags.length > 0 ||
            p.conflicts.some((f) => f.userId === j.judgeId)
          );
        }),
        ...(epoch
          ? {
              stay: {
                roomId: epoch.roomId,
                reachableProjectIds: epoch.reachableProjectIds,
                completedProjectIds: history
                  .filter(
                    (v) => v.epochId === epoch.id && v.status === 'COMPLETED',
                  )
                  .map((v) => v.projectId),
              },
            }
          : {}),
      };
    }),
  });
  return {
    ...config,
    live: {
      ...live,
      calculatedAt: state.now,
      warning:
        'Conservative projection for idle available judges; active reservations are shown separately in coverage and are not treated as completed evidence.',
    },
  };
});
