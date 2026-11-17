import { z } from 'zod';
export const setJudgeJudgingAvailabilitySchema = z.object({
  judgeId: z.string().min(1).optional(),
  available: z.boolean(),
  reason: z.string().trim().min(3).max(1000),
});
export type SetJudgeJudgingAvailabilityInput = z.input<
  typeof setJudgeJudgingAvailabilitySchema
>;
