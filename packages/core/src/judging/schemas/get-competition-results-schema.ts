import { z } from 'zod';
export const getCompetitionResultsSchema = z.object({
  categoryId: z.string().min(1),
  includeUncertainty: z.boolean().default(false),
});
export type GetCompetitionResultsInput = z.input<
  typeof getCompetitionResultsSchema
>;
