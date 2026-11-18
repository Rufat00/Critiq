import { assertUnique } from '../shared/judging-types';
export function aggregateRubricScores(
  evaluations: { judgeId: string; score: number }[],
) {
  assertUnique(evaluations.map((e) => e.judgeId));
  const scores = evaluations.map((e) => e.score).sort((a, b) => a - b),
    count = scores.length;
  if (scores.some((x) => !Number.isFinite(x) || x < 0 || x > 100))
    throw new RangeError('Invalid evaluation score.');
  const mean = count ? scores.reduce((a, b) => a + b, 0) / count : null;
  return {
    count,
    mean,
    median: count
      ? (scores[Math.floor((count - 1) / 2)]! +
          scores[Math.floor(count / 2)]!) /
        2
      : null,
    sampleSD:
      count >= 2
        ? Math.sqrt(
            scores.reduce((s, x) => s + (x - mean!) ** 2, 0) / (count - 1),
          )
        : null,
  };
}
