import { z } from 'zod';
export const updateRelativeRankingSchema = z
  .object({
    categoryId: z.string().min(1),
    expectedRevision: z.number().int().min(0),
    orderedProjectIds: z.array(z.string().min(1)).max(10000),
    visitId: z.string().min(1).optional(),
    assignmentId: z.string().min(1).optional(),
  })
  .refine(
    (v) => Boolean(v.visitId) === Boolean(v.assignmentId),
    'Provide both visit and assignment IDs when adding an observation.',
  )
  .refine(
    (v) => new Set(v.orderedProjectIds).size === v.orderedProjectIds.length,
    'Rank each project exactly once.',
  );
export type UpdateRelativeRankingInput = z.input<
  typeof updateRelativeRankingSchema
>;
