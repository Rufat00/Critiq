import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getFullCoveragePlanningMinutes } from './get-full-coverage-planning-minutes';
import { recommendCoverageTargets } from './recommend-coverage-targets';
test('open-ended planning allows every eligible project regardless of total presentation time', () => {
  const timing = {
    presentationMinutes: 60,
    questionsMinutes: 0,
    travelMinutes: 2,
    reservePercent: 15,
  };
  const projects = Array.from({ length: 30 }, (_, i) => ({
    id: `project-${i}`,
    roomId: 'room',
    competitionIds: ['track'],
  }));
  const minutes = getFullCoveragePlanningMinutes({
    ...timing,
    projectCount: projects.length,
    formMinutes: [1],
  });
  assert.ok(minutes > 1440);
  const plan = recommendCoverageTargets({
    ...timing,
    projects,
    competitions: [
      {
        id: 'track',
        minimumEvaluations: 1,
        desiredEvaluations: 1,
        maximumEvaluations: 1,
        formMinutes: 1,
      },
    ],
    judges: [
      {
        id: 'judge',
        minutes,
        competitionIds: ['track'],
        conflictProjectIds: [],
      },
    ],
  });
  assert.equal(plan.feasible, true);
  assert.equal(plan.unmetTargets.length, 0);
  assert.equal(plan.visits.length, projects.length);
});
