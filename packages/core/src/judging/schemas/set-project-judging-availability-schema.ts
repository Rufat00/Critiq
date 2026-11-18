import { z } from 'zod';
export const setProjectJudgingAvailabilitySchema = z.object({
  projectId: z.string().min(1),
  available: z.boolean(),
  reason: z.string().trim().min(3).max(1000),
});
export type SetProjectJudgingAvailabilityInput = z.input<
  typeof setProjectJudgingAvailabilitySchema
>;
