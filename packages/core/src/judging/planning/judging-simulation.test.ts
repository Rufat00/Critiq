import assert from 'node:assert/strict';
import { test } from 'node:test';
import { recommendCoverageTargets } from './recommend-coverage-targets';
import { calculateCapacityBounds } from './calculate-capacity-bounds';
import { derivePairwiseVotes } from '../relative/derive-pairwise-votes';
import { calculateCopeland } from '../relative/calculate-copeland';
import { fitBradleyTerry } from '../relative/fit-bradley-terry';
import { aggregateRatingScale } from '../rating-scale/aggregate-rating-scale';
import { aggregateRubricScores } from '../rubric/aggregate-rubric-scores';
import type { OrdinalRating } from '../shared/judging-types';

test('capacity scenarios reserve time and remain upper bounds rather than feasibility guarantees', () => {
  const estimate = calculateCapacityBounds(
    [{ availableMinutes: 60 }, { availableMinutes: 30 }],
    { optimistic: 5, expected: 6, conservative: 10 },
    0,
  );
  assert.deepEqual(
    [estimate.optimistic, estimate.expected, estimate.conservative],
    [18, 15, 9],
  );
  assert.equal(estimate.guaranteed, false);
  assert.throws(() =>
    calculateCapacityBounds([], {
      optimistic: 6,
      expected: 5,
      conservative: 10,
    }),
  );
});
for (const threshold of [0, 25, 50, 100])
  test(`seeded planning scenarios preserve constraints at ${threshold}% room stays`, () => {
    for (let seed = 1; seed <= 24; seed++) {
      let state = seed;
      const random = () => {
        state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
        return state / 4294967296;
      };
      const projects = Array.from({ length: 8 }, (_, i) => ({
        id: `p${i}`,
        roomId: `room${i % 2}`,
        competitionIds: i % 3 === 0 ? ['track', 'challenge'] : ['track'],
      }));
      const judges = Array.from({ length: 6 }, (_, i) => ({
        id: `j${i}`,
        minutes: 40 + Math.floor(random() * 30),
        competitionIds: i < 3 ? ['track', 'challenge'] : ['track'],
        conflictProjectIds: projects
          .filter(() => random() < 0.1)
          .map((p) => p.id),
      }));
      const input = {
        projects,
        judges,
        competitions: ['track', 'challenge'].map((id) => ({
          id,
          minimumEvaluations: 2,
          maximumEvaluations: 4,
          desiredEvaluations: 3,
          formMinutes: 1,
        })),
        presentationMinutes: 4,
        questionsMinutes: 1,
        travelMinutes: 2,
        reservePercent: 15,
        minRoomCompletionPercent: threshold,
      };
      const plan = recommendCoverageTargets(input),
        again = recommendCoverageTargets(input);
      assert.deepEqual(plan, again);
      assert.equal(plan.guaranteed, false);
      const pairs = new Set<string>(),
        counts = new Map<string, number>();
      for (const visit of plan.visits) {
        const judge = judges.find((j) => j.id === visit.judgeId)!,
          project = projects.find((p) => p.id === visit.projectId)!;
        const key = JSON.stringify([judge.id, project.id]);
        assert.ok(!pairs.has(key));
        pairs.add(key);
        assert.ok(!judge.conflictProjectIds.includes(project.id));
        for (const k of visit.competitionIds) {
          assert.ok(judge.competitionIds.includes(k));
          assert.ok(project.competitionIds.includes(k));
          const q = JSON.stringify([project.id, k]);
          counts.set(q, (counts.get(q) ?? 0) + 1);
          assert.ok(counts.get(q)! <= 4);
        }
      }
      for (const load of plan.judgeLoad)
        assert.ok(
          load.usedMinutes <=
            judges.find((j) => j.id === load.judgeId)!.minutes * 0.85 + 1e-9,
        );
      if (plan.feasible)
        for (const project of projects)
          for (const k of project.competitionIds)
            assert.ok(counts.get(JSON.stringify([project.id, k]))! >= 2);
    }
  });
test('separate seeded balanced panels recover an unambiguous winner across all scoring methods', () => {
  // Smoke validation, not a claim of optimal scheduling or real-world identification accuracy.
  for (let seed = 100; seed < 120; seed++) {
    let state = seed;
    const random = () => {
      state = (Math.imul(state, 1103515245) + 12345) >>> 0;
      return state / 4294967296;
    };
    const ids = ['best', 'middle', 'last'];
    const judges = Array.from({ length: 9 }, (_, i) => `j${i}`);
    const rankings = judges.map((judgeId) => ({
      judgeId,
      revision: 1,
      orderedProjectIds: random() < 0.15 ? ['middle', 'best', 'last'] : ids,
    }));
    const matrix = derivePairwiseVotes(ids, rankings),
      copeland = calculateCopeland(matrix),
      bt = fitBradleyTerry(matrix, 1);
    assert.ok(copeland.rows[0]!.score > copeland.rows[1]!.score);
    assert.ok(bt.rows[0]!.strength > bt.rows[1]!.strength);
    const ordinal = aggregateRatingScale(
      ids,
      judges.flatMap((judgeId) =>
        ids.map((projectId, i) => ({
          judgeId,
          projectId,
          rating: (5 - i * 2) as OrdinalRating,
        })),
      ),
    );
    assert.ok(ordinal[0]!.score! > ordinal[1]!.score!);
    const rubric = ids.map((_, i) =>
      aggregateRubricScores(
        judges.map((judgeId) => ({
          judgeId,
          score: 90 - i * 30 + random() * 5,
        })),
      ),
    );
    assert.ok(rubric[0]!.mean! > rubric[1]!.mean!);
  }
});
