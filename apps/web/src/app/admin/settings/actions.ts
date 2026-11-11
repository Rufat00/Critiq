'use server';
import { revalidatePath } from 'next/cache';
import {
  updateHackathonSettings,
  formatHackathon,
  type FormatHackathonInput,
  resetHackathonData,
  type ResetHackathonDataInput,
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

const resetSafely = createSafeAction(resetHackathonData);
export async function resetHackathonDataAction(input: ResetHackathonDataInput) {
  const result = await resetSafely(input);
  if (result.ok) revalidatePath('/admin', 'layout');
  return result;
}

const formatSafely = createSafeAction(formatHackathon);
export async function formatHackathonAction(input: FormatHackathonInput) {
  const result = await formatSafely(input);
  if (result.ok) revalidatePath('/', 'layout');
  return result;
}
