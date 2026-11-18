'use server';

import { revalidatePath } from 'next/cache';
import {
  markHackathonReady,
  returnHackathonToDraft,
  startHackathonJudging,
  type MarkReadyInput,
} from '@critiq/core/hackathon';
import { createSafeAction } from '@/lib/actions/create-safe-action';

const markReadySafely = createSafeAction(markHackathonReady);
const returnToDraftSafely = createSafeAction(returnHackathonToDraft);
const startJudgingSafely = createSafeAction(startHackathonJudging);

export async function startHackathonJudgingAction(
  input: Parameters<typeof startHackathonJudging>[1] = {},
) {
  const result = await startJudgingSafely(input);
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
