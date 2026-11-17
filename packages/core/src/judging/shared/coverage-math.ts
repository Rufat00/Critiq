import { assertCount, type CoveragePolicy } from './judging-types';
export function calculateCoverageDeficits(
  completed: number,
  reserved: number,
  policy: CoveragePolicy,
) {
  [
    completed,
    reserved,
    policy.minimumEvaluations,
    policy.maximumEvaluations,
    policy.desiredEvaluations,
  ].forEach(assertCount);
  if (
    policy.minimumEvaluations < 1 ||
    policy.maximumEvaluations < policy.desiredEvaluations ||
    policy.desiredEvaluations < policy.minimumEvaluations
  )
    throw new RangeError('Invalid coverage policy.');
  const effective = completed + reserved;
  return {
    completed,
    reserved,
    effective,
    minimumDeficit: Math.max(0, policy.minimumEvaluations - effective),
    targetDeficit: Math.max(0, policy.desiredEvaluations - effective),
    completedMinimumDeficit: Math.max(0, policy.minimumEvaluations - completed),
    remainingCapacity: Math.max(0, policy.maximumEvaluations - effective),
  };
}
export function summarizeCoverage(counts: number[], minimum: number) {
  counts.forEach(assertCount);
  assertCount(minimum);
  const sorted = [...counts].sort((a, b) => a - b);
  const mean = counts.length
    ? counts.reduce((a, b) => a + b, 0) / counts.length
    : 0;
  return {
    minimum: sorted[0] ?? 0,
    mean,
    lowerDecile: sorted[Math.max(0, Math.ceil(counts.length * 0.1) - 1)] ?? 0,
    variance: counts.length
      ? counts.reduce((s, x) => s + (x - mean) ** 2, 0) / counts.length
      : 0,
    coverageRate: counts.length
      ? counts.filter((x) => x >= minimum).length / counts.length
      : 0,
  };
}
