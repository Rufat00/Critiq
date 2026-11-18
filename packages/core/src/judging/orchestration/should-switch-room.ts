import {
  compareCandidates,
  type AssignmentCandidate,
} from './score-assignment-candidates';
export function shouldSwitchRoom(
  local: AssignmentCandidate | undefined,
  remote: AssignmentCandidate | undefined,
  canMoveNormally: boolean,
  hysteresisMinutes: number,
) {
  if (!remote)
    return local
      ? { kind: 'STAY' as const, candidate: local, reason: null }
      : { kind: 'WAIT' as const, candidate: null, reason: null };
  if (!local)
    return {
      kind: canMoveNormally ? ('MOVE' as const) : ('MOVE_EXCEPTION' as const),
      candidate: remote,
      reason: canMoveNormally ? null : 'NO_FEASIBLE_LOCAL_PROJECT',
    };
  if (!canMoveNormally)
    return { kind: 'STAY' as const, candidate: local, reason: null };
  // Travel/hysteresis matters only after the coverage and information tiers.
  const adjusted = {
    ...remote,
    travelMinutes: remote.travelMinutes + hysteresisMinutes,
  };
  return compareCandidates(adjusted, local) < 0
    ? { kind: 'MOVE' as const, candidate: remote, reason: null }
    : { kind: 'STAY' as const, candidate: local, reason: null };
}
