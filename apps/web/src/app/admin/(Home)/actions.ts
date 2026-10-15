'use server';

import { revalidatePath } from 'next/cache';
import {
  setSetupCompletion,
  markHackathonReady,
  returnHackathonToDraft,
  type SetupCompletionInput,
  type MarkReadyInput,
} from '@critiq/core/hackathon';
import { createSafeAction } from '@/lib/actions/create-safe-action';

const setCompletionSafely = createSafeAction(setSetupCompletion);
const markReadySafely = createSafeAction(markHackathonReady);
const returnToDraftSafely = createSafeAction(returnHackathonToDraft);

export async function setSetupCompletionAction(input: SetupCompletionInput) {
  const result = await setCompletionSafely(input);
  if (result.ok) revalidatePath('/', 'layout');
  return result;
}
export async function markHackathonReadyAction(input: MarkReadyInput) {
  const result = await markReadySafely(input);
  if (result.ok) revalidatePath('/', 'layout');
  return result;
}
export async function returnHackathonToDraftAction() {
  const result = await returnToDraftSafely({});
  if (result.ok) revalidatePath('/', 'layout');
  return result;
}
