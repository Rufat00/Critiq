'use server';

import { revalidatePath } from 'next/cache';
import { completeSetup, type CompleteSetupInput } from '@critiq/core/setup';
import { createSafeAction } from '@/lib/actions/create-safe-action';

const completeSetupSafely = createSafeAction(completeSetup);

export async function completeSetupAction(input: CompleteSetupInput) {
  const result = await completeSetupSafely(input);
  if (result.ok) {
    revalidatePath('/setup');
    revalidatePath('/admin');
    revalidatePath('/');
  }
  return result;
}
