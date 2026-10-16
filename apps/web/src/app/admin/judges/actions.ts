'use server';

import { revalidatePath } from 'next/cache';
import {
  inviteJudge,
  moveJudge,
  removeJudge,
  revokeJudgeInvitation,
  type CreateJudgeInvitationInput,
  type MoveJudgeInput,
  type RemoveJudgeInput,
  type RevokeJudgeInvitationInput,
} from '@critiq/core/judges';
import { createSafeAction } from '@/lib/actions/create-safe-action';

const inviteSafely = createSafeAction(inviteJudge);
export async function inviteJudgeAction(input: CreateJudgeInvitationInput) {
  const result = await inviteSafely(input);
  revalidatePath('/admin', 'layout');
  return result;
}
const moveSafely = createSafeAction(moveJudge);
export async function moveJudgeAction(input: MoveJudgeInput) {
  const result = await moveSafely(input);
  if (result.ok) revalidatePath('/admin', 'layout');
  return result;
}
const removeSafely = createSafeAction(removeJudge);
export async function removeJudgeAction(input: RemoveJudgeInput) {
  const result = await removeSafely(input);
  if (result.ok) revalidatePath('/admin', 'layout');
  return result;
}
const revokeSafely = createSafeAction(revokeJudgeInvitation);
export async function revokeJudgeInvitationAction(
  input: RevokeJudgeInvitationInput,
) {
  const result = await revokeSafely(input);
  if (result.ok) revalidatePath('/admin', 'layout');
  return result;
}
