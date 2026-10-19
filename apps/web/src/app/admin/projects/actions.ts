'use server';
import { revalidatePath } from 'next/cache';
import {
  createProject,
  updateProject,
  deleteProject,
  previewProjectImport,
  importProjects,
  type CreateProjectInput,
  type UpdateProjectInput,
  type DeleteProjectInput,
  type ImportProjectsInput,
} from '@critiq/core/projects';
import { createSafeAction } from '@/lib/actions/create-safe-action';
const createSafely = createSafeAction(createProject);
const updateSafely = createSafeAction(updateProject);
const deleteSafely = createSafeAction(deleteProject);
const previewSafely = createSafeAction(previewProjectImport);
const importSafely = createSafeAction(importProjects);
export async function createProjectAction(input: CreateProjectInput) {
  const result = await createSafely(input);
  if (result.ok) revalidatePath('/admin', 'layout');
  return result;
}
export async function updateProjectAction(input: UpdateProjectInput) {
  const result = await updateSafely(input);
  if (result.ok) revalidatePath('/admin', 'layout');
  return result;
}
export async function deleteProjectAction(input: DeleteProjectInput) {
  const result = await deleteSafely(input);
  if (result.ok) revalidatePath('/admin', 'layout');
  return result;
}
export async function previewProjectImportAction(input: ImportProjectsInput) {
  return previewSafely(input);
}
export async function importProjectsAction(input: ImportProjectsInput) {
  const result = await importSafely(input);
  if (result.ok) revalidatePath('/admin', 'layout');
  return result;
}
