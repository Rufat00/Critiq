'use server';

import { revalidatePath } from 'next/cache';
import {
  getAdminJudgingDashboard,
  getJudgingSetup,
  setJudgeJudgingAvailability,
  configureJudging,
  getJudgingPlan,
  getJudgingCoverageSummary,
  getCompetitionResults,
  transitionJudging,
  cancelJudgingVisit,
  finalizeCompetitionResults,
  reopenCompetition,
  excludeEvaluation,
  setProjectJudgingAvailability,
} from '@critiq/core/judging';
import { createSafeAction } from '@/lib/actions/create-safe-action';

const configureJudgingSafely = createSafeAction(configureJudging);
export async function configureJudgingAction(
  input: Parameters<typeof configureJudging>[1],
) {
  return configureJudgingSafely(input);
}

const getJudgingPlanSafely = createSafeAction(getJudgingPlan);
export async function getJudgingPlanAction(
  input: Parameters<typeof getJudgingPlan>[1],
) {
  return getJudgingPlanSafely(input);
}

const getJudgingCoverageSummarySafely = createSafeAction(
  getJudgingCoverageSummary,
);
export async function getJudgingCoverageSummaryAction(
  input: Parameters<typeof getJudgingCoverageSummary>[1],
) {
  return getJudgingCoverageSummarySafely(input);
}

const getCompetitionResultsSafely = createSafeAction(getCompetitionResults);
export async function getCompetitionResultsAction(
  input: Parameters<typeof getCompetitionResults>[1],
) {
  return getCompetitionResultsSafely(input);
}

const transitionJudgingSafely = createSafeAction(transitionJudging);
export async function transitionJudgingAction(
  input: Parameters<typeof transitionJudging>[1],
) {
  const result = await transitionJudgingSafely(input);
  if (result.ok) revalidatePath('/', 'layout');
  return result;
}

const cancelJudgingVisitSafely = createSafeAction(cancelJudgingVisit);
export async function cancelJudgingVisitAction(
  input: Parameters<typeof cancelJudgingVisit>[1],
) {
  return cancelJudgingVisitSafely(input);
}

const finalizeCompetitionResultsSafely = createSafeAction(
  finalizeCompetitionResults,
);
export async function finalizeCompetitionResultsAction(
  input: Parameters<typeof finalizeCompetitionResults>[1],
) {
  return finalizeCompetitionResultsSafely(input);
}

const reopenCompetitionSafely = createSafeAction(reopenCompetition);
export async function reopenCompetitionAction(
  input: Parameters<typeof reopenCompetition>[1],
) {
  return reopenCompetitionSafely(input);
}

const excludeEvaluationSafely = createSafeAction(excludeEvaluation);
export async function excludeEvaluationAction(
  input: Parameters<typeof excludeEvaluation>[1],
) {
  return excludeEvaluationSafely(input);
}

const setProjectJudgingAvailabilitySafely = createSafeAction(
  setProjectJudgingAvailability,
);
export async function setProjectJudgingAvailabilityAction(
  input: Parameters<typeof setProjectJudgingAvailability>[1],
) {
  return setProjectJudgingAvailabilitySafely(input);
}

const setJudgeJudgingAvailabilitySafely = createSafeAction(
  setJudgeJudgingAvailability,
);
export async function setJudgeJudgingAvailabilityAction(
  input: Parameters<typeof setJudgeJudgingAvailability>[1],
) {
  return setJudgeJudgingAvailabilitySafely(input);
}

const getDashboardSafely = createSafeAction(getAdminJudgingDashboard);
export async function getAdminJudgingDashboardAction() {
  return getDashboardSafely({});
}
const getSetupSafely = createSafeAction(getJudgingSetup);
export async function getJudgingSetupAction() {
  return getSetupSafely({});
}
