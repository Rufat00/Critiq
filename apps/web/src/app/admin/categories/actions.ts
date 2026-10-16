'use server';

import { revalidatePath } from 'next/cache';
import {
  updateCategory,
  type UpdateCategoryInput,
  deleteCategory,
  createCategory,
  setChallengeTrack,
  type SetChallengeTrackInput,
  type CreateCategoryInput,
  type DeleteCategoryInput,
} from '@critiq/core/categories';
import { createSafeAction } from '@/lib/actions/create-safe-action';

const deleteSafely = createSafeAction(deleteCategory);
export async function deleteCategoryAction(input: DeleteCategoryInput) {
  const result = await deleteSafely(input);
  if (result.ok) revalidatePath('/admin', 'layout');
  return result;
}

const createSafely = createSafeAction(createCategory);
export async function createCategoryAction(input: CreateCategoryInput) {
  const result = await createSafely(input);
  if (result.ok) revalidatePath('/admin', 'layout');
  return result;
}

const setChallengeTrackSafely = createSafeAction(setChallengeTrack);
export async function setChallengeTrackAction(input: SetChallengeTrackInput) {
  const result = await setChallengeTrackSafely(input);
  if (result.ok) revalidatePath('/admin', 'layout');
  return result;
}

const updateSafely = createSafeAction(updateCategory);
export async function updateCategoryAction(input: UpdateCategoryInput) {
  const result = await updateSafely(input);
  if (result.ok) revalidatePath('/admin', 'layout');
  return result;
}
