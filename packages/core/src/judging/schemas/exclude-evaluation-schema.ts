import { z } from 'zod';
export const excludeEvaluationSchema = z.object({
  evaluationId: z.string().min(1),
  reason: z.string().trim().min(10).max(2000),
});
export type ExcludeEvaluationInput = z.input<typeof excludeEvaluationSchema>;
