import { z } from 'zod';
export const completeJudgingVisitSchema = z.object({
  visitId: z.string().min(1),
});
export type CompleteJudgingVisitInput = z.input<
  typeof completeJudgingVisitSchema
>;
