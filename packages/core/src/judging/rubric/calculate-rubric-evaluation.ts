import { assertFinite, assertUnique } from '../shared/judging-types';
export type RubricCriterion = {
  id: string;
  weight: number;
  lower: number;
  upper: number;
};
export function normalizeRubricCriterion(
  value: number,
  lower: number,
  upper: number,
) {
  [value, lower, upper].forEach((x) => assertFinite(x, 'Criterion'));
  if (upper <= lower || value < lower || value > upper)
    throw new RangeError('Criterion is outside its published range.');
  return (value - lower) / (upper - lower);
}
export function calculateRubricEvaluation(
  criteria: RubricCriterion[],
  marks: { criterionId: string; value: number }[],
) {
  assertUnique(criteria.map((c) => c.id));
  assertUnique(marks.map((m) => m.criterionId));
  if (!criteria.length || criteria.length !== marks.length)
    throw new RangeError('All criteria are required.');
  const values = new Map(marks.map((m) => [m.criterionId, m.value]));
  let total = 0,
    weights = 0;
  for (const c of criteria) {
    assertFinite(c.weight, 'Weight');
    if (c.weight <= 0 || !values.has(c.id))
      throw new RangeError('Invalid rubric.');
    total +=
      c.weight * normalizeRubricCriterion(values.get(c.id)!, c.lower, c.upper);
    weights += c.weight;
  }
  return (100 * total) / weights;
}
