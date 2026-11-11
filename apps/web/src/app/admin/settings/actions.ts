'use server';
import { revalidatePath } from 'next/cache';
import {
  updateHackathonSettings,
  type UpdateHackathonSettingsInput,
} from '@critiq/core/hackathon';
import { createSafeAction } from '@/lib/actions/create-safe-action';

const updateSafely = createSafeAction(updateHackathonSettings);
export async function updateHackathonSettingsAction(
  input: UpdateHackathonSettingsInput,
) {
  const result = await updateSafely(input);
  if (result.ok) revalidatePath('/admin', 'layout');
  return result;
}
