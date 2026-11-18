import { z } from 'zod';
export const transitionJudgingSchema = z.object({
  status: z.enum(['PAUSED', 'JUDGING', 'DELIBERATION', 'COMPLETED']),
  eventName: z.string().optional(),
  reason: z.string().trim().min(3).max(2000),
});
export type TransitionJudgingInput = z.input<typeof transitionJudgingSchema>;
