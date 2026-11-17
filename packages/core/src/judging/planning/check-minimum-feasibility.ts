import { assertCount, assertUnique } from '../shared/judging-types';
export type ReviewDemand = {
  competitionId: string;
  projectId: string;
  required: number;
  judgeIds: string[];
};
// Integral max-flow relaxation: every judge/project/category edge has capacity one.
export function checkMinimumFeasibility(
  judges: { id: string; slots: number }[],
  demands: ReviewDemand[],
) {
  assertUnique(judges.map((j) => j.id));
  assertUnique(
    demands.map((d) => JSON.stringify([d.competitionId, d.projectId])),
  );
  judges.forEach((j) => assertCount(j.slots));
  demands.forEach((d) => {
    assertCount(d.required);
    assertUnique(d.judgeIds);
  });
  const n = 2 + judges.length + demands.length,
    s = n - 2,
    t = n - 1,
    capacity = Array.from({ length: n }, () => Array<number>(n).fill(0));
  judges.forEach((j, i) => {
    capacity[s]![i] = j.slots;
    demands.forEach((d, k) => {
      if (d.judgeIds.includes(j.id)) capacity[i]![judges.length + k] = 1;
    });
  });
  demands.forEach((d, k) => (capacity[judges.length + k]![t] = d.required));
  while (true) {
    const prev = Array<number>(n).fill(-1),
      queue = [s];
    prev[s] = s;
    for (const u of queue)
      for (let v = 0; v < n; v++)
        if (prev[v] === -1 && capacity[u]![v]! > 0) {
          prev[v] = u;
          queue.push(v);
        }
    if (prev[t] === -1) break;
    let v = t;
    while (v !== s) {
      const u = prev[v]!;
      capacity[u]![v]!--;
      capacity[v]![u]!++;
      v = u;
    }
  }
  const unmetMinimums = demands.flatMap((d, k) =>
    capacity[judges.length + k]![t]! > 0
      ? [
          {
            competitionId: d.competitionId,
            projectId: d.projectId,
            deficit: capacity[judges.length + k]![t]!,
          },
        ]
      : [],
  );
  return {
    feasible: unmetMinimums.length === 0,
    guaranteed: false,
    unmetMinimums,
    warnings: [
      'Capacity relaxation excludes room sequencing and shared form timing; it is not a schedule guarantee.',
    ],
  };
}
