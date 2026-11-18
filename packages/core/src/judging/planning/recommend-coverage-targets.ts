import {
  buildInitialJudgePlan,
  type PlanningInput,
} from './build-initial-judge-plan';
export function recommendCoverageTargets(input: PlanningInput) {
  const targets = new Map(
    input.competitions.map((c) => [c.id, c.minimumEvaluations]),
  );
  let plan = buildInitialJudgePlan(input, targets);
  if (plan.feasible) {
    let changed = true;
    while (changed) {
      changed = false;
      for (const c of input.competitions) {
        if (targets.get(c.id)! >= c.desiredEvaluations) continue;
        const next = new Map(targets);
        next.set(c.id, targets.get(c.id)! + 1);
        const trial = buildInitialJudgePlan(input, next);
        if (!trial.unmetTargets.length) {
          targets.set(c.id, next.get(c.id)!);
          plan = trial;
          changed = true;
        }
      }
    }
  }
  return {
    ...plan,
    targets: Object.fromEntries(targets),
    risk: !plan.feasible
      ? ('MINIMUM_SHORTFALL' as const)
      : ('ESTIMATED_FEASIBLE' as const),
  };
}
