import { z } from 'zod';

export const removeJudgeSchema = z.object({
  userId: z.string().min(1).max(100),
  categoryId: z.string().min(1).max(100),
});
export type RemoveJudgeInput = z.input<typeof removeJudgeSchema>;
