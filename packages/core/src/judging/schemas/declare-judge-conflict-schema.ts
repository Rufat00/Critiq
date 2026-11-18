import { z } from 'zod';
export const declareJudgeConflictSchema = z.object({
  projectId: z.string().min(1),
  reason: z.string().trim().min(10).max(1000),
});
export type DeclareJudgeConflictInput = z.input<
  typeof declareJudgeConflictSchema
>;
