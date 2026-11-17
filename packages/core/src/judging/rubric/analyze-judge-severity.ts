import { aggregateRubricScores } from './aggregate-rubric-scores';
export function analyzeJudgeSeverity(
  evaluations: { judgeId: string; projectId: string; score: number }[],
) {
  const judges = [...new Set(evaluations.map((e) => e.judgeId))];
  const rows = judges.map((judgeId) => ({
    judgeId,
    ...aggregateRubricScores(
      evaluations
        .filter((e) => e.judgeId === judgeId)
        .map((e) => ({ judgeId: e.projectId, score: e.score })),
    ),
  }));
  const overlap = judges.flatMap((a, i) =>
    judges.slice(i + 1).map((b) => ({
      judges: [a, b],
      sharedProjects: evaluations.filter(
        (e) =>
          e.judgeId === a &&
          evaluations.some(
            (f) => f.judgeId === b && f.projectId === e.projectId,
          ),
      ).length,
    })),
  );
  return {
    rows,
    overlap,
    reliable: false,
    warning:
      'Raw judge means confound severity and project strength. No automatic calibration is applied.',
  };
}
