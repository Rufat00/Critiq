'use server';

import {
  controlJudgingTimer,
  declareJudgeConflict,
  setJudgeJudgingAvailability,
  requestNextAssignment,
  submitRubricEvaluation,
  submitRatingVote,
  updateRelativeRanking,
  completeJudgingVisit,
  skipJudgingVisit,
  renewJudgingVisit,
  moveJudge,
  getJudgeCurrentAssignment,
  getJudgeRelativeRanking,
} from '@critiq/core/judging';
import { createSafeAction } from '@/lib/actions/create-safe-action';

const requestNextAssignmentSafely = createSafeAction(requestNextAssignment);
export async function requestNextAssignmentAction(
  input: Parameters<typeof requestNextAssignment>[1],
) {
  return requestNextAssignmentSafely(input);
}

const submitRubricEvaluationSafely = createSafeAction(submitRubricEvaluation);
export async function submitRubricEvaluationAction(
  input: Parameters<typeof submitRubricEvaluation>[1],
) {
  return submitRubricEvaluationSafely(input);
}

const submitRatingVoteSafely = createSafeAction(submitRatingVote);
export async function submitRatingVoteAction(
  input: Parameters<typeof submitRatingVote>[1],
) {
  return submitRatingVoteSafely(input);
}

const updateRelativeRankingSafely = createSafeAction(updateRelativeRanking);
export async function updateRelativeRankingAction(
  input: Parameters<typeof updateRelativeRanking>[1],
) {
  return updateRelativeRankingSafely(input);
}

const completeJudgingVisitSafely = createSafeAction(completeJudgingVisit);
export async function completeJudgingVisitAction(
  input: Parameters<typeof completeJudgingVisit>[1],
) {
  return completeJudgingVisitSafely(input);
}

const skipJudgingVisitSafely = createSafeAction(skipJudgingVisit);
export async function skipJudgingVisitAction(
  input: Parameters<typeof skipJudgingVisit>[1],
) {
  return skipJudgingVisitSafely(input);
}

const renewJudgingVisitSafely = createSafeAction(renewJudgingVisit);
export async function renewJudgingVisitAction(
  input: Parameters<typeof renewJudgingVisit>[1],
) {
  return renewJudgingVisitSafely(input);
}

const moveJudgeSafely = createSafeAction(moveJudge);
export async function moveJudgeAction(input: Parameters<typeof moveJudge>[1]) {
  return moveJudgeSafely(input);
}

const getJudgeCurrentAssignmentSafely = createSafeAction(
  getJudgeCurrentAssignment,
);
export async function getJudgeCurrentAssignmentAction(
  input: Parameters<typeof getJudgeCurrentAssignment>[1],
) {
  return getJudgeCurrentAssignmentSafely(input);
}

const getJudgeRelativeRankingSafely = createSafeAction(getJudgeRelativeRanking);
export async function getJudgeRelativeRankingAction(
  input: Parameters<typeof getJudgeRelativeRanking>[1],
) {
  return getJudgeRelativeRankingSafely(input);
}

const declareJudgeConflictSafely = createSafeAction(declareJudgeConflict);
export async function declareJudgeConflictAction(
  input: Parameters<typeof declareJudgeConflict>[1],
) {
  return declareJudgeConflictSafely(input);
}

const setJudgeJudgingAvailabilitySafely = createSafeAction(
  setJudgeJudgingAvailability,
);
export async function setJudgeJudgingAvailabilityAction(
  input: Parameters<typeof setJudgeJudgingAvailability>[1],
) {
  return setJudgeJudgingAvailabilitySafely(input);
}

const controlJudgingTimerSafely = createSafeAction(controlJudgingTimer);
export async function controlJudgingTimerAction(
  input: Parameters<typeof controlJudgingTimer>[1],
) {
  return controlJudgingTimerSafely(input);
}
