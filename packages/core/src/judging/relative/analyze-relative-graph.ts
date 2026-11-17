import {
  assertCount,
  assertUnique,
  type PairwiseVotes,
} from '../shared/judging-types';
export function analyzeRelativeGraph({ projectIds, wins }: PairwiseVotes) {
  assertUnique(projectIds);
  if (
    wins.length !== projectIds.length ||
    wins.some((row) => row.length !== projectIds.length)
  )
    throw new RangeError('Invalid vote matrix.');
  wins.flat().forEach(assertCount);
  if (wins.some((r, i) => r[i] !== 0))
    throw new RangeError('Self comparisons are invalid.');
  const degrees = projectIds.map(() => 0),
    exposures: number[] = [],
    components: string[][] = [],
    seen = new Set<number>();
  for (let i = 0; i < projectIds.length; i++)
    for (let j = i + 1; j < projectIds.length; j++) {
      const n = wins[i]![j]! + wins[j]![i]!;
      if (n) {
        degrees[i]!++;
        degrees[j]!++;
        exposures.push(n);
      }
    }
  for (let i = 0; i < projectIds.length; i++)
    if (!seen.has(i)) {
      const queue = [i],
        component: string[] = [];
      seen.add(i);
      for (const x of queue) {
        component.push(projectIds[x]!);
        for (let y = 0; y < projectIds.length; y++)
          if (!seen.has(y) && wins[x]![y]! + wins[y]![x]! > 0) {
            seen.add(y);
            queue.push(y);
          }
      }
      components.push(component);
    }
  const possible = (projectIds.length * (projectIds.length - 1)) / 2;
  const cycles: string[][] = [];
  for (let i = 0; i < projectIds.length; i++)
    for (let j = i + 1; j < projectIds.length; j++)
      for (let k = j + 1; k < projectIds.length; k++) {
        const beats = (a: number, b: number) => wins[a]![b]! > wins[b]![a]!;
        if (
          (beats(i, j) && beats(j, k) && beats(k, i)) ||
          (beats(j, i) && beats(i, k) && beats(k, j))
        )
          cycles.push([projectIds[i]!, projectIds[j]!, projectIds[k]!]);
      }
  return {
    components,
    degrees,
    minimumDegree: degrees.length ? Math.min(...degrees) : 0,
    observedPairFraction: possible ? exposures.length / possible : 0,
    exposures,
    connected: projectIds.length > 0 && components.length === 1,
    balancedExposure:
      degrees.length > 0 && Math.max(...degrees) - Math.min(...degrees) <= 1,
    cycles,
  };
}
