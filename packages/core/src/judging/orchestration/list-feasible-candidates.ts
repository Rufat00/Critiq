import { analyzeRelativeGraph } from '../relative/analyze-relative-graph';
import type { JudgingState } from '../shared/load-judging-state';
import { eligibleCategories } from '../shared/assignment-eligibility';
import { calculateCoverageDeficits } from '../shared/coverage-math';
import { derivePairwiseVotes } from '../relative/derive-pairwise-votes';
import { calculatePairGain } from './calculate-pair-gain';
import { estimateVisitDuration } from '../planning/estimate-visit-duration';
import type { AssignmentCandidate } from './score-assignment-candidates';
export function listFeasibleCandidates(
  state: JudgingState,
  judgeId: string,
  currentRoomId: string | undefined,
  remainingMinutes: number,
): AssignmentCandidate[] {
  const candidates: AssignmentCandidate[] = [];
  for (const project of state.projects) {
    if (!project.roomId || state.visits.some((v) => v.projectId === project.id))
      continue;
    let minimumDeficit = 0,
      targetDeficit = 0,
      scarcity = 0,
      completed = 0,
      pairGain = 0;
    const categories = eligibleCategories(state, judgeId, project)
      .filter(
        (c) =>
          !state.excluded.some(
            (e) =>
              e.judgeId === judgeId &&
              e.projectId === project.id &&
              e.categoryId === c.id,
          ) &&
          !c.evaluations.some(
            (e) => e.projectId === project.id && e.judgeId === judgeId,
          ),
      )
      .filter((c) => {
        const policy = state.policy.categories.find(
          (p) => p.categoryId === c.id,
        )!;
        const n = new Set(
          c.evaluations
            .filter((e) => e.projectId === project.id)
            .map((e) => e.judgeId),
        ).size;
        const pending = state.visits.filter(
          (v) =>
            v.projectId === project.id &&
            v.assignments.some(
              (a) =>
                a.categoryId === c.id &&
                ['ASSIGNED', 'IN_PROGRESS'].includes(a.status),
            ),
        ).length;
        const d = calculateCoverageDeficits(n, pending, {
          ...policy,
          desiredEvaluations:
            policy.targetEvaluations ?? policy.desiredEvaluations,
        });
        if (!d.remainingCapacity) return false;
        minimumDeficit = Math.max(minimumDeficit, d.minimumDeficit);
        targetDeficit = Math.max(targetDeficit, d.targetDeficit);
        completed = Math.max(completed, n);
        const eligible = c.judges.filter(
          (j) =>
            !project.conflicts.some((f) => f.userId === j.userId) &&
            !c.evaluations.some(
              (e) => e.judgeId === j.userId && e.projectId === project.id,
            ) &&
            state.policy.judges.some(
              (b) => b.judgeId === j.userId && b.availableMinutes > 0,
            ),
        ).length;
        scarcity = Math.max(scarcity, d.minimumDeficit / Math.max(1, eligible));
        if (c.method === 'RELATIVE') {
          const ids = policy.projectIds;
          const rankings = [...new Set(c.rankings.map((r) => r.judgeId))].map(
            (id) => ({
              judgeId: id,
              revision: 0,
              orderedProjectIds: c.rankings
                .filter((r) => r.judgeId === id && ids.includes(r.projectId))
                .sort((a, b) => a.position - b.position)
                .map((r) => r.projectId),
            }),
          );
          const matrix = derivePairwiseVotes(ids, rankings);
          const graph = analyzeRelativeGraph(matrix);
          const current = graph.components.findIndex((c) =>
            c.includes(project.id),
          );
          const portfolio =
            rankings.find((r) => r.judgeId === judgeId)?.orderedProjectIds ??
            [];
          pairGain +=
            2 *
            Math.min(
              2,
              new Set(
                portfolio
                  .map((id) =>
                    graph.components.findIndex((c) => c.includes(id)),
                  )
                  .filter((component) => component !== current),
              ).size,
            );
          pairGain += calculatePairGain(
            project.id,
            rankings.find((r) => r.judgeId === judgeId)?.orderedProjectIds ??
              [],
            matrix,
          );
        }
        return true;
      });
    if (!categories.length) continue;
    const estimatedMinutes = estimateVisitDuration(
      state.policy.presentationMinutes,
      state.policy.questionsMinutes,
      categories.map(
        (c) =>
          state.policy.categories.find((p) => p.categoryId === c.id)!
            .formMinutes,
      ),
    );
    const travelMinutes =
      currentRoomId && currentRoomId !== project.roomId
        ? state.policy.travelMinutes
        : 0;
    if (
      estimatedMinutes + travelMinutes > remainingMinutes ||
      state.now.getTime() + (estimatedMinutes + travelMinutes) * 60000 >
        new Date(state.policy.endsAt).getTime()
    )
      continue;
    // Preserve a specialist's remaining budget for exclusive unmet demands elsewhere.
    const exclusiveMinutes = state.projects
      .filter((p) => p.id !== project.id)
      .reduce((sum, p) => {
        const needs = eligibleCategories(state, judgeId, p).filter((c) => {
          const policy = state.policy.categories.find(
            (x) => x.categoryId === c.id,
          )!;
          const n = c.evaluations.filter((e) => e.projectId === p.id).length;
          const available = c.judges.filter(
            (j) =>
              !p.conflicts.some((f) => f.userId === j.userId) &&
              !c.evaluations.some(
                (e) => e.projectId === p.id && e.judgeId === j.userId,
              ),
          );
          return (
            n < policy.minimumEvaluations &&
            available.length <= policy.minimumEvaluations - n
          );
        });
        return (
          sum +
          (needs.length
            ? estimateVisitDuration(
                state.policy.presentationMinutes,
                state.policy.questionsMinutes,
                needs.map(
                  (c) =>
                    state.policy.categories.find((x) => x.categoryId === c.id)!
                      .formMinutes,
                ),
              )
            : 0)
        );
      }, 0);
    const essentialHere = categories.some((c) => {
      const p = state.policy.categories.find((x) => x.categoryId === c.id)!;
      return (
        c.evaluations.filter((e) => e.projectId === project.id).length <
          p.minimumEvaluations &&
        c.judges.filter(
          (j) =>
            !project.conflicts.some((f) => f.userId === j.userId) &&
            !c.evaluations.some(
              (e) => e.projectId === project.id && e.judgeId === j.userId,
            ),
        ).length <=
          p.minimumEvaluations -
            c.evaluations.filter((e) => e.projectId === project.id).length
      );
    });
    if (
      !essentialHere &&
      remainingMinutes - estimatedMinutes - travelMinutes < exclusiveMinutes
    )
      continue;
    candidates.push({
      projectId: project.id,
      roomId: project.roomId,
      competitionIds: categories.map((c) => c.id),
      estimatedMinutes,
      minimumDeficit,
      targetDeficit,
      scarcity,
      completed,
      pairGain,
      travelMinutes,
    });
  }
  return candidates;
}
