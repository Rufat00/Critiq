import { z } from 'zod';

export const moveJudgeSchema = z
  .object({
    userId: z.string().min(1).max(100),
    categoryId: z.string().min(1).max(100),
    targetCategoryId: z.string().min(1).max(100),
  })
  .refine((input) => input.categoryId !== input.targetCategoryId, {
    message: 'Choose a different track.',
    path: ['targetCategoryId'],
  });
export type MoveJudgeInput = z.input<typeof moveJudgeSchema>;
