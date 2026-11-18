export type AssignmentCandidate = {
  projectId: string;
  roomId: string;
  competitionIds: string[];
  estimatedMinutes: number;
  minimumDeficit: number;
  scarcity: number;
  pairGain: number;
  targetDeficit: number;
  completed: number;
  travelMinutes: number;
  ambiguity?: number;
};
export function candidatePriority(c: AssignmentCandidate) {
  return [
    Number(c.minimumDeficit > 0),
    c.scarcity,
    c.minimumDeficit,
    c.pairGain,
    -c.completed,
    c.targetDeficit,
    c.minimumDeficit ? 0 : (c.ambiguity ?? 0),
    -c.travelMinutes,
  ];
}
export function compareCandidates(
  a: AssignmentCandidate,
  b: AssignmentCandidate,
) {
  const x = candidatePriority(a),
    y = candidatePriority(b);
  for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return y[i]! - x[i]!;
  return 0;
}
export function scoreAssignmentCandidates(
  candidates: AssignmentCandidate[],
  seed = 1,
) {
  const hash = (s: string) => {
    let n = seed | 0;
    for (const c of s) n = Math.imul(n ^ c.charCodeAt(0), 16777619);
    return n >>> 0;
  };
  return [...candidates].sort(
    (a, b) =>
      compareCandidates(a, b) ||
      hash(a.projectId) - hash(b.projectId) ||
      a.projectId.localeCompare(b.projectId),
  );
}
