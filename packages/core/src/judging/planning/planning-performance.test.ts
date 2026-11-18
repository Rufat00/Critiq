import assert from 'node:assert/strict';
import { test } from 'node:test';
import { recommendCoverageTargets } from './recommend-coverage-targets';

test('a 101-project event with 40 judges calculates coverage responsively', () => {
  const input = {
    projects: Array.from({ length: 101 }, (_, index) => ({
      id: `project-${index}`,
      roomId: `room-${index % 4}`,
      competitionIds: [
        index % 2 ? 'beginner' : 'overall',
        'challenge-a',
        'challenge-b',
      ],
    })),
    judges: Array.from({ length: 40 }, (_, index) => ({
      id: `judge-${index}`,
      minutes: 2000,
      competitionIds: [
        index % 2 ? 'beginner' : 'overall',
        'challenge-a',
        'challenge-b',
      ],
      conflictProjectIds: [] as string[],
    })),
    competitions: ['overall', 'beginner', 'challenge-a', 'challenge-b'].map(
      (id) => ({
        id,
        minimumEvaluations: 4,
        maximumEvaluations: 9,
        desiredEvaluations: 9,
        formMinutes: 1,
      }),
    ),
    presentationMinutes: 5,
    questionsMinutes: 0,
    travelMinutes: 2,
    reservePercent: 15,
    minRoomCompletionPercent: 25,
  };
  const started = performance.now();
  const plan = recommendCoverageTargets(input);
  const elapsed = performance.now() - started;
  assert.equal(plan.feasible, true);
  assert.equal(plan.unmetTargets.length, 0);
  assert.ok(Object.values(plan.targets).every((target) => target === 9));
  assert.equal(plan.quotas.length, 303);
  assert.ok(plan.quotas.every((quota) => quota.planned === 9));
  assert.ok(elapsed < 10000, `Planning blocked for ${Math.round(elapsed)} ms.`);
});
