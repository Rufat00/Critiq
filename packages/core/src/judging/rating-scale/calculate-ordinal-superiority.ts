import { assertCount } from '../shared/judging-types';
export function calculateOrdinalSuperiority(
  a: readonly number[],
  b: readonly number[],
) {
  if (a.length !== 5 || b.length !== 5)
    throw new RangeError('Five ordered categories are required.');
  [...a, ...b].forEach(assertCount);
  const na = a.reduce((x, y) => x + y, 0),
    nb = b.reduce((x, y) => x + y, 0);
  if (!na || !nb) return null;
  let score = 0;
  for (let r = 0; r < 5; r++)
    for (let s = 0; s < 5; s++)
      score += a[r]! * b[s]! * (r > s ? 1 : r === s ? 0.5 : 0);
  return score / (na * nb);
}
