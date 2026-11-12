'use server';
import { revalidatePath } from 'next/cache';
import {
  createRoom,
  updateRoom,
  deleteRoom,
  getRoom,
  getRoomEditor,
  type CreateRoomInput,
  type UpdateRoomInput,
  type DeleteRoomInput,
} from '@critiq/core/rooms';
import { createSafeAction } from '@/lib/actions/create-safe-action';
const createSafely = createSafeAction(createRoom);
const updateSafely = createSafeAction(updateRoom);
const deleteSafely = createSafeAction(deleteRoom);
const editorSafely = createSafeAction(getRoomEditor);
const getSafely = createSafeAction(getRoom);
export async function getRoomAction(input: { roomId: string }) {
  return getSafely(input);
}
export async function createRoomAction(input: CreateRoomInput) {
  const result = await createSafely(input);
  if (result.ok) revalidatePath('/admin', 'layout');
  return result;
}
export async function updateRoomAction(input: UpdateRoomInput) {
  const result = await updateSafely(input);
  if (result.ok) revalidatePath('/admin', 'layout');
  return result;
}

export async function deleteRoomAction(input: DeleteRoomInput) {
  const result = await deleteSafely(input);
  if (result.ok) revalidatePath('/admin', 'layout');
  return result;
}

export async function getRoomEditorAction(input: { roomId?: string }) {
  return editorSafely(input);
}
