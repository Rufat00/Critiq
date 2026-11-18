import { submitRatingVoteSchema } from '../schemas/submit-rating-vote-schema';
import { judgingMutation, invalid } from '../shared/judging-operation';
import { saveEvaluation } from '../shared/save-evaluation';
export const submitRatingVote = judgingMutation(
  'judging.evaluations.rating.submit',
  submitRatingVoteSchema,
)(async ({ ctx, input, event }) => {
  if (event.status !== 'JUDGING')
    invalid('Votes can only be submitted while judging is running.');
  const evaluation = await saveEvaluation(ctx, input, 'RATING_SCALE');
  return {
    ...evaluation,
    rubricTotal:
      evaluation.rubricTotal === null ? null : Number(evaluation.rubricTotal),
    scores: evaluation.scores.map((s) => ({ ...s, score: Number(s.score) })),
  };
});
