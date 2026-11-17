import { finalizeCompetitionResultsSchema } from '../schemas/finalize-competition-results-schema';
import {
  judgingMutation,
  invalid,
  conflict,
  json,
} from '../shared/judging-operation';
import { expireReservations } from '../shared/expire-reservations';
import { loadCompetitionResults } from '../shared/load-competition-results';
export const finalizeCompetitionResults = judgingMutation(
  'judging.results.finalize',
  finalizeCompetitionResultsSchema,
  true,
)(async ({ ctx, input, event }) => {
  if (!['PAUSED', 'DELIBERATION'].includes(event.status))
    invalid('Pause or close judging before publishing results.');
  const existing = await ctx.db.competitionResultSnapshot.findFirst({
    where: {
      categoryId: input.categoryId,
      supersededAt: null,
      category: { hackathonId: event.id },
    },
    orderBy: { createdAt: 'desc' },
  });
  if (existing) return existing;
  await expireReservations(ctx, event.id);
  const result = await loadCompetitionResults(ctx, input.categoryId);
  if (result.scoringRevision !== input.expectedScoringRevision)
    conflict(
      'Scoring configuration changed. Review results before publishing.',
    );
  if (result.evidenceFingerprint !== input.expectedEvidenceFingerprint)
    conflict(
      'Judging evidence changed. Review the current results before publishing.',
    );
  if (!result.integrityReady)
    invalid(
      'Resolve scoring and evidence integrity issues before publication.',
    );
  if (result.evidence.activeAssignments)
    invalid(
      'Complete, cancel, or expire active assignments before publication.',
    );
  if (!result.readiness.ready && !input.exceptionReason)
    invalid(
      'Acknowledge coverage or structural exceptions with a reason before publishing.',
    );
  if (result.unresolvedWinner && !input.acknowledgeTies)
    invalid(
      'The leading projects are tied. Explicitly acknowledge the unresolved award tie.',
    );
  const snapshot = await ctx.db.competitionResultSnapshot.create({
    data: {
      categoryId: input.categoryId,
      scoringRevision: result.scoringRevision,
      evidence: json({ policy: result.policy, evidence: result.evidence }),
      results: json({
        ...result,
        state: input.exceptionReason
          ? 'FINALIZED_WITH_EXCEPTIONS'
          : 'FINALIZED',
        tieAcknowledged: input.acknowledgeTies,
      }),
      exceptionReason: input.exceptionReason,
    },
  });
  await ctx.db.judgingCategory.update({
    where: { id: input.categoryId },
    data: { status: 'COMPLETED', endedAt: new Date() },
  });
  return snapshot;
});
