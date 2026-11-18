import { submitRubricEvaluationSchema } from '../schemas/submit-rubric-evaluation-schema';
import { judgingMutation, invalid } from '../shared/judging-operation';
import { saveEvaluation } from '../shared/save-evaluation';
export const submitRubricEvaluation = judgingMutation(
  'judging.evaluations.rubric.submit',
  submitRubricEvaluationSchema,
)(async ({ ctx, input, event }) => {
  if (event.status !== 'JUDGING')
    invalid('Scores can only be submitted while judging is running.');
  const evaluation = await saveEvaluation(ctx, input, 'RUBRIC');
  return {
    ...evaluation,
    rubricTotal:
      evaluation.rubricTotal === null ? null : Number(evaluation.rubricTotal),
    scores: evaluation.scores.map((s) => ({ ...s, score: Number(s.score) })),
  };
});
