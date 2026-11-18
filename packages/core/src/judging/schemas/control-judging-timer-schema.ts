import { z } from 'zod';
export const controlJudgingTimerSchema = z.object({
  visitId: z.string().min(1),
  action: z.enum(['START', 'PAUSE', 'RESUME', 'FINISH']),
});
export type ControlJudgingTimerInput = z.input<
  typeof controlJudgingTimerSchema
>;
