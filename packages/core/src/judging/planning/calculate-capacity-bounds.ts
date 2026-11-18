import { assertFinite } from '../shared/judging-types';
export function calculateCapacityBounds(
  judges: { availableMinutes: number }[],
  visitMinutes: { optimistic: number; expected: number; conservative: number },
  reservePercent = 15,
) {
  for (const n of [
    ...judges.map((j) => j.availableMinutes),
    ...Object.values(visitMinutes),
    reservePercent,
  ]) {
    assertFinite(n, 'Planning input');
    if (n < 0) throw new RangeError('Negative capacity input.');
  }
  if (
    visitMinutes.optimistic <= 0 ||
    visitMinutes.expected < visitMinutes.optimistic ||
    visitMinutes.conservative < visitMinutes.expected ||
    reservePercent > 50
  )
    throw new RangeError('Invalid capacity scenarios.');
  const slots = (duration: number) =>
    judges.reduce(
      (s, j) =>
        s +
        Math.floor(
          (j.availableMinutes * (1 - reservePercent / 100)) / duration,
        ),
      0,
    );
  return {
    optimistic: slots(visitMinutes.optimistic),
    expected: slots(visitMinutes.expected),
    conservative: slots(visitMinutes.conservative),
    guaranteed: false,
    warning:
      'Physical visit upper bounds exclude qualification and room sequencing constraints.',
  };
}
