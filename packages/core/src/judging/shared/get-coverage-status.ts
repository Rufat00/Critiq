export function getCoverageStatus(
  completed: number,
  minimum: number,
  target: number,
  maximum: number,
) {
  if (completed < minimum) return 'BELOW_MINIMUM' as const;
  if (completed < target) return 'BELOW_TARGET' as const;
  if (completed >= maximum || (completed > target && completed >= maximum - 1))
    return 'NEAR_MAXIMUM' as const;
  return 'TARGET_REACHED' as const;
}
