export function calculateCompetitionReadiness(
  counts: number[],
  minimum: number,
  activeAssignments: number,
  structureReady: boolean,
  integrityReady = true,
) {
  const reasons: string[] = [];
  if (!counts.length) reasons.push('No eligible projects.');
  if (counts.some((n) => n < minimum))
    reasons.push('Minimum distinct-judge coverage is unmet.');
  if (activeAssignments)
    reasons.push('Active assignments must be completed, expired, or canceled.');
  if (!structureReady)
    reasons.push(
      'Comparison connectivity or opponent exposure is insufficient.',
    );
  if (!integrityReady)
    reasons.push('Scoring configuration or evidence integrity is unresolved.');
  return {
    ready: reasons.length === 0,
    provisional: reasons.length > 0,
    reasons,
  };
}
