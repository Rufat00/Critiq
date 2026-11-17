import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { JudgingState } from '../shared/load-judging-state';
import { listFeasibleCandidates } from './list-feasible-candidates';
function state(): JudgingState {
  const category = (id: string, judgeIds: string[]) => ({
    id,
    status: 'ACTIVE',
    method: 'RATING_SCALE',
    judges: judgeIds.map((userId) => ({ userId })),
    evaluations: [],
    rankings: [],
  });
  const project = (id: string, k: string) => ({
    id,
    roomId: 'r',
    flags: [],
    conflicts: [],
    track: { categoryId: k },
    challenges: [],
  });
  return {
    now: new Date('2026-11-17T10:00:00Z'),
    policy: {
      endsAt: '2026-11-17T12:00:00Z',
      presentationMinutes: 4,
      questionsMinutes: 1,
      travelMinutes: 2,
      judges: [
        { judgeId: 'specialist', availableMinutes: 6 },
        { judgeId: 'generalist', availableMinutes: 6 },
      ],
      categories: [
        {
          categoryId: 'general',
          projectIds: ['generic'],
          minimumEvaluations: 1,
          maximumEvaluations: 2,
          desiredEvaluations: 1,
          formMinutes: 1,
        },
        {
          categoryId: 'hardware',
          projectIds: ['niche'],
          minimumEvaluations: 1,
          maximumEvaluations: 1,
          desiredEvaluations: 1,
          formMinutes: 1,
        },
      ],
    },
    projects: [project('generic', 'general'), project('niche', 'hardware')],
    categories: [
      category('general', ['specialist', 'generalist']),
      category('hardware', ['specialist']),
    ],
    visits: [],
    excluded: [],
  } as unknown as JudgingState;
}
test('dispatch preserves the last specialist for an exclusively qualified minimum', () => {
  const candidates = listFeasibleCandidates(state(), 'specialist', 'r', 6);
  assert.deepEqual(
    candidates.map((c) => c.projectId),
    ['niche'],
  );
  assert.deepEqual(
    listFeasibleCandidates(state(), 'generalist', 'r', 6).map(
      (c) => c.projectId,
    ),
    ['generic'],
  );
});
test('hard eligibility rejects conflicts, unavailable projects, duplicates and exhausted category capacity', () => {
  const snapshot = state();
  snapshot.projects[0]!.conflicts.push({ userId: 'generalist' } as never);
  assert.equal(
    listFeasibleCandidates(snapshot, 'generalist', 'r', 30).length,
    0,
  );
  const absent = state();
  absent.projects[0]!.flags.push({ type: 'UNAVAILABLE' } as never);
  assert.equal(listFeasibleCandidates(absent, 'generalist', 'r', 30).length, 0);
  const completed = state();
  completed.categories[0]!.evaluations.push({
    projectId: 'generic',
    judgeId: 'generalist',
  } as never);
  assert.equal(
    listFeasibleCandidates(completed, 'generalist', 'r', 30).length,
    0,
  );
  const capped = state();
  capped.categories[0]!.evaluations.push(
    ...['a', 'b'].map(
      (judgeId) => ({ projectId: 'generic', judgeId }) as never,
    ),
  );
  assert.equal(listFeasibleCandidates(capped, 'generalist', 'r', 30).length, 0);
  const reserved = state();
  reserved.visits.push({ projectId: 'generic', assignments: [] } as never);
  assert.equal(
    listFeasibleCandidates(reserved, 'generalist', 'r', 30).length,
    0,
  );
  assert.equal(listFeasibleCandidates(state(), 'generalist', 'r', 5).length, 0);
  const ended = state();
  ended.now = new Date('2026-11-17T12:00:01Z');
  assert.equal(listFeasibleCandidates(ended, 'generalist', 'r', 30).length, 0);
});
