import {
  assertUnique,
  type PairwiseVotes,
  type RankingEvidence,
} from '../shared/judging-types';
export function derivePairwiseVotes(
  projectIds: string[],
  rankings: RankingEvidence[],
): PairwiseVotes {
  assertUnique(projectIds);
  assertUnique(rankings.map((r) => r.judgeId));
  const indices = new Map(projectIds.map((id, i) => [id, i]));
  const wins = projectIds.map(() => projectIds.map(() => 0));
  for (const ranking of rankings) {
    assertUnique(ranking.orderedProjectIds);
    if (!Number.isSafeInteger(ranking.revision) || ranking.revision < 0)
      throw new RangeError('Invalid revision.');
    const order = ranking.orderedProjectIds.map((id) => {
      const i = indices.get(id);
      if (i === undefined) throw new RangeError('Unauthorized project.');
      return i;
    });
    for (let i = 0; i < order.length; i++)
      for (let j = i + 1; j < order.length; j++) wins[order[i]!]![order[j]!]!++;
  }
  return { projectIds: [...projectIds], wins };
}
