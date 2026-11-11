'use server';

import { revalidatePath } from 'next/cache';
import {
  markHackathonReady,
  returnHackathonToDraft,
  type MarkReadyInput,
} from '@critiq/core/hackathon';
import { createSafeAction } from '@/lib/actions/create-safe-action';

const markReadySafely = createSafeAction(markHackathonReady);
const returnToDraftSafely = createSafeAction(returnHackathonToDraft);

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
