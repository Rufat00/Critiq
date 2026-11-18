import { AppError, AppErrorCode } from '../../shared/errors';
import type { AppContext } from '../../context';
import { requireVisit } from './require-visit';
import { loadJudgingState } from './load-judging-state';
import { conflict, forbidden, invalid } from './judging-operation';
import { calculateRubricEvaluation } from '../rubric/calculate-rubric-evaluation';
export async function saveEvaluation(
  ctx: AppContext,
  input: {
    visitId: string;
    assignmentId: string;
    notes?: string;
    rating?: number;
    marks?: { criterionId: string; value: number }[];
  },
  method: 'RUBRIC' | 'RATING_SCALE' | 'RELATIVE',
) {
  const visit = await requireVisit(ctx, input.visitId, true);
  const assignment = visit.assignments.find((a) => a.id === input.assignmentId);
  if (!assignment || assignment.category.method !== method) forbidden();
  const state = await loadJudgingState(ctx),
    policy = state.policy.categories.find(
      (c) => c.categoryId === assignment.categoryId,
    );
  if (!policy || !policy.projectIds.includes(visit.projectId)) forbidden();
  if (assignment.evaluation?.isExcluded)
    invalid('This evaluation has been excluded by an organizer.');
  if (assignment.evaluation) {
    const existing = assignment.evaluation;
    const same =
      method === 'RELATIVE' ||
      (method === 'RATING_SCALE'
        ? existing.ordinalRating === input.rating
        : JSON.stringify(
            existing.scores.map((s) => [s.criterionId, Number(s.score)]).sort(),
          ) ===
          JSON.stringify(
            input.marks!.map((m) => [m.criterionId, m.value]).sort(),
          ));
    if (!same || (existing.notes ?? '') !== (input.notes ?? ''))
      conflict('This evaluation is already submitted with different values.');
    return existing;
  }
  if (
    visit.status === 'COMPLETED' ||
    !['ASSIGNED', 'IN_PROGRESS'].includes(assignment.status)
  )
    invalid('This evaluation is no longer open.');
  let score: number | undefined;
  if (method === 'RUBRIC') {
    try {
      score = calculateRubricEvaluation(policy.rubric, input.marks!);
    } catch {
      throw new AppError(
        AppErrorCode.VALIDATION_ERROR,
        'Submit every published criterion once, within its allowed range.',
        {
          marks: [
            'Check the published ranges and complete each criterion exactly once.',
          ],
        },
      );
    }
  }
  const count = await ctx.db.evaluation.count({
    where: {
      categoryId: assignment.categoryId,
      projectId: visit.projectId,
      isExcluded: false,
    },
  });
  if (count >= policy.maximumEvaluations)
    conflict('Maximum coverage has been reached.');
  const evaluation = await ctx.db.evaluation.create({
    data: {
      assignmentId: assignment.id,
      categoryId: assignment.categoryId,
      judgeId: visit.judgeId,
      projectId: visit.projectId,
      scoringRevision: state.config.revision,
      notes: input.notes,
      ordinalRating: input.rating,
      ...(score === undefined ? {} : { rubricTotal: score }),
      ...(input.marks
        ? {
            scores: {
              create: input.marks.map((m) => ({
                criterionId: m.criterionId,
                score: m.value,
              })),
            },
          }
        : {}),
    },
    include: { scores: true },
  });
  await ctx.db.judgingAssignment.update({
    where: { id: assignment.id },
    data: { status: 'COMPLETED', finishedAt: new Date() },
  });
  return evaluation;
}
