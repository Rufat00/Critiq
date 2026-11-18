import { z } from 'zod';
export const skipJudgingVisitSchema = z.object({
  visitId: z.string().min(1),
  assignmentId: z.string().min(1).optional(),
  reason: z.string().trim().min(3).max(1000),
});
export type SkipJudgingVisitInput = z.input<typeof skipJudgingVisitSchema>;
