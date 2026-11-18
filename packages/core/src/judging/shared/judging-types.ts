export type CoveragePolicy = {
  minimumEvaluations: number;
  maximumEvaluations: number;
  desiredEvaluations: number;
};
export type RankingEvidence = {
  judgeId: string;
  orderedProjectIds: string[];
  revision: number;
};
export type PairwiseVotes = { projectIds: string[]; wins: number[][] };
export type OrdinalRating = 1 | 2 | 3 | 4 | 5;
export function assertFinite(value: number, name: string) {
  if (!Number.isFinite(value)) throw new RangeError(`${name} must be finite.`);
}
export function assertCount(value: number) {
  if (!Number.isSafeInteger(value) || value < 0)
    throw new RangeError('Expected a nonnegative integer.');
}
export function assertUnique(values: string[]) {
  if (new Set(values).size !== values.length)
    throw new RangeError('Duplicate identifiers.');
}
