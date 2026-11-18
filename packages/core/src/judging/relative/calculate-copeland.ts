import type { PairwiseVotes } from '../shared/judging-types';
import { analyzeRelativeGraph } from './analyze-relative-graph';
export function calculateCopeland(matrix: PairwiseVotes) {
  const graph = analyzeRelativeGraph(matrix);
  return {
    graph,
    rows: matrix.projectIds.map((projectId, i) => {
      let score = 0;
      for (let j = 0; j < matrix.projectIds.length; j++)
        if (i !== j && matrix.wins[i]![j]! + matrix.wins[j]![i]! > 0)
          score +=
            matrix.wins[i]![j]! > matrix.wins[j]![i]!
              ? 1
              : matrix.wins[i]![j] === matrix.wins[j]![i]
                ? 0.5
                : 0;
      return {
        projectId,
        score,
        observedOpponentCount: graph.degrees[i]!,
        normalizedScore: graph.degrees[i] ? score / graph.degrees[i]! : null,
      };
    }),
  };
}
