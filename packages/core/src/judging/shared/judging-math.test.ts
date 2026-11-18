import { submitRubricEvaluationSchema } from '../schemas/submit-rubric-evaluation-schema';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { derivePairwiseVotes } from '../relative/derive-pairwise-votes';
import { calculateCopeland } from '../relative/calculate-copeland';
import { fitBradleyTerry } from '../relative/fit-bradley-terry';
import { analyzeRelativeGraph } from '../relative/analyze-relative-graph';
import {
  normalizeRubricCriterion,
  calculateRubricEvaluation,
} from '../rubric/calculate-rubric-evaluation';
import { aggregateRubricScores } from '../rubric/aggregate-rubric-scores';
import { analyzeJudgeSeverity } from '../rubric/analyze-judge-severity';
import { calculateOrdinalSuperiority } from '../rating-scale/calculate-ordinal-superiority';
import { aggregateRatingScale } from '../rating-scale/aggregate-rating-scale';
import { calculateCoverageDeficits, summarizeCoverage } from './coverage-math';
import {
  calculateMinRoomVisits,
  calculateRoomProgress,
} from './room-stay-math';
import { checkMinimumFeasibility } from '../planning/check-minimum-feasibility';
import { estimateVisitDuration } from '../planning/estimate-visit-duration';
import { recommendCoverageTargets } from '../planning/recommend-coverage-targets';
import {
  scoreAssignmentCandidates,
  type AssignmentCandidate,
} from '../orchestration/score-assignment-candidates';
import { shouldSwitchRoom } from '../orchestration/should-switch-room';
import { calculatePairGain } from '../orchestration/calculate-pair-gain';
import {
  calculateCompetitionResults,
  type CompetitionEvidence,
} from '../results/calculate-competition-results';
import { analyzeResultUncertainty } from '../results/analyze-result-uncertainty';
import type { JudgingPolicy } from '../schemas/configure-judging-schema';
const near = (a: number, b: number, tolerance = 1e-8) =>
  assert.ok(Math.abs(a - b) < tolerance, `${a} != ${b}`);
const ranking = (judgeId: string, orderedProjectIds: string[]) => ({
  judgeId,
  orderedProjectIds,
  revision: 1,
});
const policy = (
  method: 'RELATIVE' | 'RUBRIC' | 'RATING_SCALE' = 'RELATIVE',
): JudgingPolicy['categories'][number] => ({
  categoryId: 'k',
  method,
  projectIds: ['a', 'b', 'c'],
  minimumEvaluations: 1,
  maximumEvaluations: 9,
  desiredEvaluations: 3,
  relativeEstimator: 'COPELAND_V1',
  lambda: 1,
  criteria: [],
  rubric: [{ id: 'x', weight: 1, lower: 0, upper: 10 }],
  formMinutes: 1,
});

test('strict portfolios produce h choose 2 preferences, preserve exposure and reverse majorities', () => {
  for (let h = 0; h < 15; h++) {
    const ids = Array.from({ length: h }, (_, i) => String(i));
    const matrix = derivePairwiseVotes(ids, [ranking('j', ids)]);
    assert.equal(
      matrix.wins.flat().reduce((a, b) => a + b, 0),
      Math.max(0, (h * (h - 1)) / 2),
    );
    const reversed = derivePairwiseVotes(ids, [
      ranking('j', [...ids].reverse()),
    ]);
    for (let i = 0; i < h; i++)
      for (let j = 0; j < h; j++)
        assert.equal(matrix.wins[i]![j], reversed.wins[j]![i]);
  }
  const m = derivePairwiseVotes(
    ['a', 'b', 'c'],
    [ranking('j', ['a', 'b']), ranking('k', ['b', 'a', 'c'])],
  );
  assert.equal(m.wins[0]![1]! + m.wins[1]![0]!, 2);
  assert.throws(() => derivePairwiseVotes(['a'], [ranking('j', ['a', 'a'])]));
  assert.throws(() => derivePairwiseVotes(['a'], [ranking('j', ['other'])]));
  assert.throws(() =>
    derivePairwiseVotes(['a'], [ranking('j', ['a']), ranking('j', ['a'])]),
  );
});
test('missing pairs remain unobserved, isolated projects and unequal exposure are disclosed', () => {
  const matrix = derivePairwiseVotes(
    ['a', 'b', 'c', 'd'],
    [ranking('j', ['a', 'b', 'c'])],
  );
  const result = calculateCopeland(matrix);
  assert.equal(result.rows[3]!.score, 0);
  assert.equal(result.rows[3]!.normalizedScore, null);
  assert.equal(result.graph.components.length, 2);
  assert.equal(result.graph.observedPairFraction, 0.5);
  assert.equal(result.graph.balancedExposure, false);
  const tied = calculateCopeland(
    derivePairwiseVotes(
      ['a', 'b'],
      [ranking('j', ['a', 'b']), ranking('k', ['b', 'a'])],
    ),
  );
  assert.deepEqual(
    tied.rows.map((r) => r.score),
    [0.5, 0.5],
  );
  const cycle = analyzeRelativeGraph(
    derivePairwiseVotes(
      ['a', 'b', 'c'],
      [
        ranking('j', ['a', 'b']),
        ranking('k', ['b', 'c']),
        ranking('l', ['c', 'a']),
      ],
    ),
  );
  assert.equal(cycle.cycles.length, 1);
  assert.equal(cycle.connected, true);
  assert.throws(() => analyzeRelativeGraph({ projectIds: ['a'], wins: [[1]] }));
});
test('regularized Bradley Terry is finite, centered, convergent and invariant to project ID permutation', () => {
  const ids = ['a', 'b', 'c'];
  const rankings = [
    ranking('j', ids),
    ranking('k', ['a', 'c', 'b']),
    ranking('l', ids),
  ];
  const fit = fitBradleyTerry(derivePairwiseVotes(ids, rankings), 0.1);
  assert.equal(fit.converged, true);
  assert.ok(fit.rows[0]!.strength > fit.rows[1]!.strength);
  near(
    fit.rows.reduce((s, r) => s + r.strength, 0),
    0,
  );
  assert.ok(fit.rows.every((r) => Number.isFinite(r.strength)));
  const other = fitBradleyTerry(
    derivePairwiseVotes(['c', 'a', 'b'], rankings),
    0.1,
  );
  for (const row of fit.rows)
    near(
      row.strength,
      other.rows.find((r) => r.projectId === row.projectId)!.strength,
    );
  assert.equal(
    fitBradleyTerry(
      derivePairwiseVotes(['a', 'b', 'c'], [ranking('j', ['a', 'b'])]),
    ).graph.connected,
    false,
  );
  assert.throws(() => fitBradleyTerry(derivePairwiseVotes([], []), 0));
  const two = fitBradleyTerry(
    {
      projectIds: ['a', 'b'],
      wins: [
        [0, 3],
        [1, 0],
      ],
    },
    1,
  );
  const delta = two.rows[0]!.strength - two.rows[1]!.strength;
  near(3 - 4 / (1 + Math.exp(-delta)) - two.rows[0]!.strength, 0);
});
test('rubric normalization spans 0..100, scales weights and requires complete valid criteria', () => {
  const criteria = [
    { id: 'x', lower: 2, upper: 5, weight: 30 },
    { id: 'y', lower: 0, upper: 10, weight: 70 },
  ];
  assert.equal(
    calculateRubricEvaluation(criteria, [
      { criterionId: 'x', value: 2 },
      { criterionId: 'y', value: 0 },
    ]),
    0,
  );
  assert.equal(
    calculateRubricEvaluation(criteria, [
      { criterionId: 'x', value: 5 },
      { criterionId: 'y', value: 10 },
    ]),
    100,
  );
  const marks = [
    { criterionId: 'x', value: 3 },
    { criterionId: 'y', value: 6 },
  ];
  near(
    calculateRubricEvaluation(criteria, marks),
    calculateRubricEvaluation(
      criteria.map((c) => ({ ...c, weight: c.weight * 9 })),
      marks,
    ),
  );
  for (const [x, l, u] of [
    [-1, 0, 5],
    [6, 0, 5],
    [1, 1, 1],
    [NaN, 0, 5],
  ])
    assert.throws(() => normalizeRubricCriterion(x!, l!, u!));
  assert.throws(() => calculateRubricEvaluation(criteria, marks.slice(1)));
  assert.throws(() =>
    calculateRubricEvaluation(criteria, [marks[0]!, marks[0]!]),
  );
  assert.throws(() =>
    calculateRubricEvaluation(
      criteria.map((c) => ({ ...c, weight: 0 })),
      marks,
    ),
  );
});
test('rubric mean avoids review-count bias; zero/one review have unavailable variance', () => {
  assert.deepEqual(aggregateRubricScores([]), {
    count: 0,
    mean: null,
    median: null,
    sampleSD: null,
  });
  assert.equal(
    aggregateRubricScores([{ judgeId: 'j', score: 70 }]).sampleSD,
    null,
  );
  const equal = aggregateRubricScores([
    { judgeId: 'j', score: 70 },
    { judgeId: 'k', score: 70 },
  ]);
  assert.equal(equal.mean, 70);
  assert.equal(equal.sampleSD, 0);
  const spread = aggregateRubricScores([
    { judgeId: 'j', score: 0 },
    { judgeId: 'k', score: 100 },
  ]);
  assert.equal(spread.median, 50);
  near(spread.sampleSD!, Math.sqrt(5000));
  assert.throws(() =>
    aggregateRubricScores([
      { judgeId: 'j', score: 1 },
      { judgeId: 'j', score: 2 },
    ]),
  );
  assert.equal(
    analyzeJudgeSeverity([
      { judgeId: 'j', projectId: 'a', score: 50 },
      { judgeId: 'k', projectId: 'b', score: 80 },
    ]).reliable,
    false,
  );
});
test('ordinal superiority honors order, symmetry and exact ties without interval arithmetic', () => {
  for (let r = 0; r < 5; r++)
    for (let s = 0; s < 5; s++) {
      const a = [0, 0, 0, 0, 0],
        b = [0, 0, 0, 0, 0];
      a[r] = 1;
      b[s] = 1;
      const o = calculateOrdinalSuperiority(a, b)!;
      assert.equal(o, r > s ? 1 : r === s ? 0.5 : 0);
      near(o + calculateOrdinalSuperiority(b, a)!, 1);
    }
  let seed = 19;
  const rand = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return (seed % 10) + 1;
  };
  for (let i = 0; i < 200; i++) {
    const a = Array.from({ length: 5 }, rand),
      b = Array.from({ length: 5 }, rand);
    near(calculateOrdinalSuperiority(a, a)!, 0.5);
    near(
      calculateOrdinalSuperiority(a, b)! + calculateOrdinalSuperiority(b, a)!,
      1,
    );
  }
  assert.equal(
    calculateOrdinalSuperiority([0, 0, 0, 0, 0], [1, 0, 0, 0, 0]),
    null,
  );
  assert.throws(() => calculateOrdinalSuperiority([1], [1]));
  // Worked specification example: Alpha's 4,4,5 against Beta's 1,5,5.
  near(calculateOrdinalSuperiority([0, 0, 0, 2, 1], [1, 0, 0, 0, 2])!, 4 / 9);
});
test('missing ordinal votes make the whole index provisional; neutral votes are observed', () => {
  const empty = aggregateRatingScale(
    ['a', 'b'],
    [{ projectId: 'a', judgeId: 'j', rating: 3 }],
  );
  assert.equal(empty[0]!.count, 1);
  assert.equal(empty[0]!.score, null);
  assert.equal(empty[1]!.count, 0);
  const tied = aggregateRatingScale(
    ['a', 'b'],
    [
      { projectId: 'a', judgeId: 'j', rating: 4 },
      { projectId: 'b', judgeId: 'k', rating: 4 },
    ],
  );
  assert.equal(tied[0]!.score, 0.5);
  assert.equal(tied[1]!.score, 0.5);
  assert.throws(() =>
    aggregateRatingScale(
      ['a'],
      [{ projectId: 'foreign', judgeId: 'j', rating: 3 }],
    ),
  );
});
test('pending coverage affects dispatch only; coverage diagnostics expose worst projects', () => {
  const d = calculateCoverageDeficits(1, 2, {
    minimumEvaluations: 3,
    maximumEvaluations: 9,
    desiredEvaluations: 6,
  });
  assert.equal(d.minimumDeficit, 0);
  assert.equal(d.completedMinimumDeficit, 2);
  assert.equal(d.targetDeficit, 3);
  const summary = summarizeCoverage([0, 3, 3, 6], 3);
  assert.equal(summary.minimum, 0);
  assert.equal(summary.coverageRate, 0.75);
  assert.equal(summary.variance, 4.5);
  assert.throws(() =>
    calculateCoverageDeficits(0, 0, {
      minimumEvaluations: 3,
      maximumEvaluations: 2,
      desiredEvaluations: 2,
    }),
  );
});
for (const [threshold, count, required] of [
  [0, 12, 0],
  [25, 12, 3],
  [100, 12, 12],
  [25, 7, 2],
  [25, 2, 1],
])
  test(`room threshold ${threshold}% of ${count} needs ${required} distinct visits`, () =>
    assert.equal(calculateMinRoomVisits(threshold!, count!), required));
test('room progress counts each physical project once against its frozen roster', () => {
  const frozen = ['a', 'b'];
  const p = calculateRoomProgress(frozen, ['a', 'a', 'a', 'outside'], 25);
  assert.equal(p.completed, 1);
  assert.equal(p.required, 1);
  assert.equal(p.canMoveNormally, true);
  assert.deepEqual(frozen, ['a', 'b']);
  assert.throws(() => calculateMinRoomVisits(101, 12));
});
test('flow detects qualification bottlenecks despite enough total slots', () => {
  const judges = [
    { id: 'j', slots: 1 },
    { id: 'k', slots: 10 },
  ];
  const demand = ['a', 'b'].map((projectId) => ({
    projectId,
    competitionId: 'k',
    required: 1,
    judgeIds: ['j'],
  }));
  const result = checkMinimumFeasibility(judges, demand);
  assert.equal(result.feasible, false);
  assert.equal(
    result.unmetMinimums.reduce((s, d) => s + d.deficit, 0),
    1,
  );
  assert.equal(result.guaranteed, false);
  assert.equal(
    checkMinimumFeasibility([{ id: 'j', slots: 2 }], demand).feasible,
    true,
  );
});
test('visit duration shares presentation while category form time remains marginal', () => {
  assert.equal(estimateVisitDuration(4, 1, [1, 1, 1]), 8);
  assert.throws(() => estimateVisitDuration(-1, 1, [1]));
});
test('planner keeps impossible minimums and increments feasible targets within available minutes', () => {
  const input = {
    projects: ['a', 'b', 'c'].map((id) => ({
      id,
      roomId: 'r',
      competitionIds: ['k'],
    })),
    judges: ['j', 'l'].map((id) => ({
      id,
      minutes: 12,
      competitionIds: ['k'],
      conflictProjectIds: [],
    })),
    competitions: [
      {
        id: 'k',
        minimumEvaluations: 1,
        maximumEvaluations: 9,
        desiredEvaluations: 6,
        formMinutes: 1,
      },
    ],
    presentationMinutes: 4,
    questionsMinutes: 1,
    travelMinutes: 2,
    reservePercent: 0,
  };
  const plan = recommendCoverageTargets(input);
  assert.equal(plan.feasible, true);
  assert.equal(plan.targets.k, 1);
  assert.ok(plan.judgeLoad.every((j) => j.usedMinutes <= 12));
  assert.equal(plan.guaranteed, false);
  const impossible = recommendCoverageTargets({
    ...input,
    competitions: [{ ...input.competitions[0]!, minimumEvaluations: 3 }],
  });
  assert.equal(impossible.feasible, false);
  assert.equal(impossible.targets.k, 3);
  assert.ok(impossible.unmetMinimums.length);
  const overlap = recommendCoverageTargets({
    ...input,
    projects: [{ id: 'a', roomId: 'r', competitionIds: ['k', 'x'] }],
    judges: [
      {
        id: 'j',
        minutes: 7,
        competitionIds: ['k', 'x'],
        conflictProjectIds: [],
      },
    ],
    competitions: ['k', 'x'].map((id) => ({
      id,
      minimumEvaluations: 1,
      maximumEvaluations: 1,
      desiredEvaluations: 1,
      formMinutes: 1,
    })),
  });
  assert.equal(overlap.visits.length, 1);
  assert.equal(overlap.visits[0]!.competitionIds.length, 2);
  assert.equal(overlap.visits[0]!.minutes, 7);
});
const candidate = (
  projectId: string,
  overrides: Partial<AssignmentCandidate> = {},
): AssignmentCandidate => ({
  projectId,
  roomId: 'r',
  competitionIds: ['k'],
  estimatedMinutes: 6,
  minimumDeficit: 0,
  targetDeficit: 1,
  scarcity: 0,
  pairGain: 0,
  completed: 3,
  travelMinutes: 0,
  ...overrides,
});
test('coverage-first dispatch cannot be outweighed by travel or optional challenges', () => {
  const urgent = candidate('u', {
    minimumDeficit: 1,
    scarcity: 1,
    travelMinutes: 100,
  });
  const extra = candidate('e', {
    competitionIds: ['x', 'y', 'z'],
    pairGain: 100,
  });
  assert.equal(scoreAssignmentCandidates([extra, urgent])[0]!.projectId, 'u');
  assert.deepEqual(
    scoreAssignmentCandidates([extra, urgent], 12),
    scoreAssignmentCandidates([urgent, extra], 12),
  );
});
test('room threshold grants permission; hysteresis prevents unnecessary movement and no-local deadlock', () => {
  const local = candidate('l'),
    remote = candidate('r', { roomId: 'other', travelMinutes: 0.1 });
  assert.equal(shouldSwitchRoom(local, remote, true, 2).kind, 'STAY');
  assert.equal(
    shouldSwitchRoom(local, { ...remote, minimumDeficit: 1 }, false, 2).kind,
    'STAY',
  );
  assert.equal(
    shouldSwitchRoom(undefined, remote, false, 2).reason,
    'NO_FEASIBLE_LOCAL_PROJECT',
  );
  assert.equal(shouldSwitchRoom(undefined, undefined, false, 2).kind, 'WAIT');
  assert.equal(
    shouldSwitchRoom(local, { ...remote, minimumDeficit: 1 }, true, 2).kind,
    'MOVE',
  );
  const matrix = derivePairwiseVotes(
    ['a', 'b', 'c'],
    [ranking('j', ['a', 'b'])],
  );
  assert.equal(calculatePairGain('c', ['a', 'b'], matrix), 2);
  assert.equal(calculatePairGain('a', ['b'], matrix), 0.5);
});
test('readiness uses completed coverage, rejects disconnected results and preserves official award ties', () => {
  const p = policy();
  const evidence: CompetitionEvidence = {
    evaluations: ['a', 'b'].map((projectId) => ({
      projectId,
      judgeId: 'j',
      ordinalRating: null,
      marks: [],
    })),
    rankings: [ranking('j', ['a', 'b'])],
    activeAssignments: 0,
  };
  const result = calculateCompetitionResults(p, evidence);
  assert.equal(result.readiness.ready, false);
  assert.equal(result.coverage.minimum, 0);
  const tied = calculateCompetitionResults(
    { ...policy('RATING_SCALE'), projectIds: ['a', 'b'] },
    {
      evaluations: ['a', 'b'].map((projectId) => ({
        projectId,
        judgeId: 'j',
        ordinalRating: 4,
        marks: [],
      })),
      rankings: [],
      activeAssignments: 1,
    },
  );
  assert.equal(tied.unresolvedWinner, true);
  assert.deepEqual(
    tied.leaderboard.map((r) => r.rank),
    [1, 1],
  );
  assert.equal(tied.readiness.ready, false);
});
test('uncertainty resamples judge clusters deterministically and declines tiny samples', () => {
  const p = { ...policy('RATING_SCALE'), projectIds: ['a', 'b'] };
  const evidence: CompetitionEvidence = {
    evaluations: Array.from({ length: 6 }, (_, i) =>
      ['a', 'b'].map((projectId) => ({
        projectId,
        judgeId: `j${i}`,
        ordinalRating: projectId === 'a' ? 5 : 1,
        marks: [],
      })),
    ).flat(),
    rankings: [],
    activeAssignments: 0,
  };
  const a = analyzeResultUncertainty(p, evidence, 40, 12),
    b = analyzeResultUncertainty(p, evidence, 40, 12);
  assert.deepEqual(a, b);
  assert.equal(a.frequencies[0]!.top1, 1);
  assert.equal(a.frequencies[1]!.top1, 0);
  assert.equal(
    analyzeResultUncertainty(p, {
      ...evidence,
      evaluations: evidence.evaluations.slice(0, 2),
    }).status,
    'INSUFFICIENT_EVIDENCE',
  );
});

test('decimal marks accept exact four-place inputs despite binary floating representation', () => {
  for (const value of [0.0003, 1.2345, 9.9999, 0])
    assert.equal(
      submitRubricEvaluationSchema.safeParse({
        visitId: 'v',
        assignmentId: 'a',
        marks: [{ criterionId: 'c', value }],
      }).success,
      true,
    );
  assert.equal(
    submitRubricEvaluationSchema.safeParse({
      visitId: 'v',
      assignmentId: 'a',
      marks: [{ criterionId: 'c', value: 1.23456 }],
    }).success,
    false,
  );
});

test('numerically shared award ranks form groups without silently selecting a winner', () => {
  const p = {
    ...policy('RUBRIC'),
    rubric: [{ id: 'x', weight: 1, lower: 0, upper: 100 }],
  };
  const result = calculateCompetitionResults(p, {
    evaluations: [
      {
        projectId: 'a',
        judgeId: 'j',
        ordinalRating: null,
        marks: [{ criterionId: 'x', value: 50 + 1.5e-9 }],
      },
      {
        projectId: 'b',
        judgeId: 'k',
        ordinalRating: null,
        marks: [{ criterionId: 'x', value: 50 + 0.75e-9 }],
      },
      {
        projectId: 'c',
        judgeId: 'l',
        ordinalRating: null,
        marks: [{ criterionId: 'x', value: 50 }],
      },
    ],
    rankings: [],
    activeAssignments: 0,
  });
  assert.deepEqual(
    result.leaderboard.map((r) => r.rank),
    [1, 1, 3],
  );
  assert.equal(result.unresolvedWinner, true);
});
