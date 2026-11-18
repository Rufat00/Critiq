import { z } from 'zod';
export const finalizeCompetitionResultsSchema = z.object({
  categoryId: z.string().min(1),
  expectedEvidenceFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  expectedScoringRevision: z.number().int().min(1),
  exceptionReason: z.string().trim().min(10).max(2000).optional(),
  acknowledgeTies: z.boolean().default(false),
});
export type FinalizeCompetitionResultsInput = z.input<
  typeof finalizeCompetitionResultsSchema
>;
