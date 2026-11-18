import type { PlanningInput } from '../planning/build-initial-judge-plan';
type RepairPlan = {
  unmetMinimums: { deficit: number }[];
  unmetTargets: { deficit: number }[];
  visits: { minutes: number }[];
};
// Bounded deterministic restart repair: change portfolio/judge tie order, never constraints or quotas.
export function repairAssignmentPlan<T extends RepairPlan>(
  input: PlanningInput,
  build: (input: PlanningInput) => T,
) {
  let best = build(input);
  let attempts = 1;
  const priority = (p: T) => [
    p.unmetMinimums.reduce((s, d) => s + d.deficit, 0),
    p.unmetTargets.reduce((s, d) => s + d.deficit, 0),
    p.visits.reduce((s, v) => s + v.minutes, 0),
  ];
  if (best.unmetTargets.length)
    for (let i = 0; i < 3; i++) {
      const projects =
        i === 0
          ? [...input.projects].reverse()
          : [...input.projects.slice(i + 1), ...input.projects.slice(0, i + 1)];
      const judges =
        i === 1
          ? [...input.judges].reverse()
          : [...input.judges.slice(i + 1), ...input.judges.slice(0, i + 1)];
      const trial = build({ ...input, projects, judges });
      attempts++;
      const a = priority(trial),
        b = priority(best);
      for (let k = 0; k < a.length; k++) {
        if (a[k] === b[k]) continue;
        if (a[k]! < b[k]!) best = trial;
        break;
      }
    }
  return { ...best, repairAttempts: attempts };
}
