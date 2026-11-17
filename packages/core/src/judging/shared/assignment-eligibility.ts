import type { JudgingState } from './load-judging-state';
export function eligibleCategories(
  state: JudgingState,
  judgeId: string,
  project: JudgingState['projects'][number],
) {
  if (
    project.flags.length ||
    project.conflicts.some((c) => c.userId === judgeId)
  )
    return [];
  return state.categories.filter(
    (c) =>
      c.status === 'ACTIVE' &&
      c.judges.some((j) => j.userId === judgeId) &&
      state.policy.categories
        .find((p) => p.categoryId === c.id)
        ?.projectIds.includes(project.id) &&
      (project.track.categoryId === c.id ||
        project.challenges.some((e) => e.challenge.categoryId === c.id)),
  );
}
