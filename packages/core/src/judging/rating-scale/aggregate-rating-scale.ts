import { assertUnique, type OrdinalRating } from '../shared/judging-types';
import { calculateOrdinalSuperiority } from './calculate-ordinal-superiority';
export function aggregateRatingScale(
  projectIds: string[],
  votes: { projectId: string; judgeId: string; rating: OrdinalRating }[],
) {
  assertUnique(projectIds);
  assertUnique(votes.map((v) => JSON.stringify([v.projectId, v.judgeId])));
  const histograms = projectIds.map((projectId) => {
    const frequencies = [0, 0, 0, 0, 0];
    for (const vote of votes.filter((v) => v.projectId === projectId)) {
      if (!Number.isInteger(vote.rating) || vote.rating < 1 || vote.rating > 5)
        throw new RangeError('Invalid ordinal vote.');
      frequencies[vote.rating - 1]!++;
    }
    return {
      projectId,
      frequencies,
      count: frequencies.reduce((a, b) => a + b, 0),
    };
  });
  if (votes.some((v) => !projectIds.includes(v.projectId)))
    throw new RangeError('Ineligible project.');
  const complete = histograms.every((h) => h.count > 0);
  return histograms.map((h, i) => ({
    ...h,
    score:
      complete && histograms.length > 1
        ? histograms.reduce(
            (s, q, j) =>
              s +
              (i === j
                ? 0
                : calculateOrdinalSuperiority(h.frequencies, q.frequencies)!),
            0,
          ) /
          (histograms.length - 1)
        : null,
  }));
}
