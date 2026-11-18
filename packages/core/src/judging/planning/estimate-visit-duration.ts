import { assertFinite } from '../shared/judging-types';
export function estimateVisitDuration(
  presentation: number,
  questions: number,
  formMinutes: number[],
) {
  for (const x of [presentation, questions, ...formMinutes]) {
    assertFinite(x, 'Minutes');
    if (x < 0) throw new RangeError('Negative duration.');
  }
  const total =
    presentation + questions + formMinutes.reduce((a, b) => a + b, 0);
  if (total <= 0) throw new RangeError('Visit must take time.');
  return total;
}
