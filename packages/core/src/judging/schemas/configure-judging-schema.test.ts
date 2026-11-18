import assert from 'node:assert/strict';
import { test } from 'node:test';
import { configureJudgingSchema } from './configure-judging-schema';
const input = {
  expectedRevision: 0,
  categories: [
    {
      categoryId: 'track',
      minimumEvaluations: 4,
      maximumEvaluations: 9,
      desiredEvaluations: 9,
    },
  ],
};
test('missing judges produces an actionable error instead of blaming track limits', () => {
  const result = configureJudgingSchema.safeParse({ ...input, judges: [] });
  assert.equal(result.success, false);
  if (result.success) return;
  assert.deepEqual(
    result.error.issues.map((issue) => issue.path),
    [['judges']],
  );
  assert.equal(
    result.error.issues[0]!.message,
    'Add at least one active judge with track access before calculating the judging plan.',
  );
});
test('valid track limits and a qualified judge do not require a planned duration', () => {
  assert.equal(
    configureJudgingSchema.safeParse({
      ...input,
      judges: [{ judgeId: 'judge' }],
    }).success,
    true,
  );
});
