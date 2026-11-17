import { z } from 'zod';
export const reopenCompetitionSchema = z.object({
  categoryId: z.string().min(1),
  reason: z.string().trim().min(10).max(2000),
});
export type ReopenCompetitionInput = z.input<typeof reopenCompetitionSchema>;
