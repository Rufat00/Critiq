import { assertCount } from './judging-types';
export function calculateMinRoomVisits(
  thresholdPercent: number,
  frozenReachableProjects: number,
) {
  assertCount(thresholdPercent);
  assertCount(frozenReachableProjects);
  if (thresholdPercent > 100) throw new RangeError('Invalid room threshold.');
  return Math.ceil((thresholdPercent * frozenReachableProjects) / 100);
}
export function calculateRoomProgress(
  reachableProjectIds: string[],
  completedProjectIds: string[],
  thresholdPercent: number,
) {
  const reachable = new Set(reachableProjectIds);
  const completed = new Set(
    completedProjectIds.filter((id) => reachable.has(id)),
  ).size;
  const required = calculateMinRoomVisits(thresholdPercent, reachable.size);
  return {
    completed,
    required,
    canMoveNormally: completed >= required,
    completionPercent: reachable.size ? (100 * completed) / reachable.size : 0,
  };
}
