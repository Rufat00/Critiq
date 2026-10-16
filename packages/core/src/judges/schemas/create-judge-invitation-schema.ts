import { z } from 'zod';

export const createJudgeInvitationSchema = z.object({
  categoryId: z.string().min(1).max(100),
  email: z
    .string()
    .trim()
    .pipe(z.email().max(254))
    .transform((email) => email.toLowerCase())
    .optional(),
});
export type CreateJudgeInvitationInput = z.input<
  typeof createJudgeInvitationSchema
>;
