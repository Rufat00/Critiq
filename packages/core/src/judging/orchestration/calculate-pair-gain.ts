import type { PairwiseVotes } from '../shared/judging-types';
export function calculatePairGain(
  projectId: string,
  portfolio: string[],
  matrix: PairwiseVotes,
) {
  const i = matrix.projectIds.indexOf(projectId);
  if (i < 0) throw new RangeError('Ineligible project.');
  return portfolio.reduce((s, id) => {
    const j = matrix.projectIds.indexOf(id);
    if (j < 0 || j === i) return s;
    return s + 1 / (1 + matrix.wins[i]![j]! + matrix.wins[j]![i]!);
  }, 0);
}
