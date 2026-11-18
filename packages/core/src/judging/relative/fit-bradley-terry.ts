import type { PairwiseVotes } from '../shared/judging-types';
import { analyzeRelativeGraph } from './analyze-relative-graph';
const sigmoid = (x: number) =>
  x >= 0 ? 1 / (1 + Math.exp(-x)) : Math.exp(x) / (1 + Math.exp(x));
export function fitBradleyTerry(
  matrix: PairwiseVotes,
  lambda = 1,
  tolerance = 1e-10,
  maximumIterations = 10000,
) {
  const graph = analyzeRelativeGraph(matrix),
    n = matrix.projectIds.length;
  if (
    !Number.isFinite(lambda) ||
    lambda <= 0 ||
    !Number.isFinite(tolerance) ||
    tolerance <= 0 ||
    !Number.isSafeInteger(maximumIterations) ||
    maximumIterations < 1
  )
    throw new RangeError('Invalid solver parameters.');
  const theta = Array<number>(n).fill(0);
  // The weighted graph Laplacian Hessian has spectral norm <= max weighted degree / 2.
  const lipschitz =
    lambda +
    Math.max(
      0,
      ...matrix.wins.map((row, i) =>
        row.reduce((s, w, j) => s + w + matrix.wins[j]![i]!, 0),
      ),
    ) /
      2;
  let converged = n === 0,
    iterations = 0;
  for (; iterations < maximumIterations; iterations++) {
    const gradient = theta.map((t) => -lambda * t);
    for (let i = 0; i < n; i++)
      for (let j = i + 1; j < n; j++) {
        const w = matrix.wins[i]![j]!,
          v = matrix.wins[j]![i]!,
          g = w - (w + v) * sigmoid(theta[i]! - theta[j]!);
        gradient[i]! += g;
        gradient[j]! -= g;
      }
    if (Math.max(0, ...gradient.map(Math.abs)) < tolerance) {
      converged = true;
      break;
    }
    for (let i = 0; i < n; i++) theta[i]! += gradient[i]! / lipschitz;
    const mean = theta.reduce((a, b) => a + b, 0) / (n || 1);
    for (let i = 0; i < n; i++) theta[i]! -= mean;
  }
  return {
    rows: matrix.projectIds.map((projectId, i) => ({
      projectId,
      strength: theta[i]!,
    })),
    converged,
    iterations,
    graph,
    lambda,
  };
}
