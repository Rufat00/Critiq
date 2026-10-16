import { z } from 'zod';

export const revokeJudgeInvitationSchema = z.object({
  invitationId: z.string().min(1).max(100),
});
export type RevokeJudgeInvitationInput = z.input<
  typeof revokeJudgeInvitationSchema
>;
