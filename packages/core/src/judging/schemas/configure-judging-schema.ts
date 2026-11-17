import type { ordinalRatingOptions } from '@critiq/constants';
import { z } from 'zod';
const categoryPolicy = z
  .object({
    categoryId: z.string().min(1),
    minimumEvaluations: z.number().int().min(1).max(100),
    maximumEvaluations: z.number().int().min(1).max(100),
    desiredEvaluations: z.number().int().min(1).max(100),
    relativeEstimator: z
      .enum(['COPELAND_V1', 'BRADLEY_TERRY_V1'])
      .default('COPELAND_V1'),
    lambda: z.number().positive().max(1000).default(1),
    formMinutes: z.number().min(0).max(60).default(1),
    criteria: z
      .array(
        z.object({
          id: z.string().min(1),
          lower: z.number().min(0).max(10000),
          upper: z.number().positive().max(10000),
        }),
      )
      .max(100)
      .default([]),
  })
  .refine(
    (c) =>
      c.minimumEvaluations <= c.desiredEvaluations &&
      c.desiredEvaluations <= c.maximumEvaluations,
    'Require minimum <= desired <= maximum.',
  )
  .refine(
    (c) => c.criteria.every((v) => v.upper > v.lower),
    'Criterion upper bound must exceed lower bound.',
  );
export const configureJudgingSchema = z
  .object({
    expectedRevision: z.number().int().min(0),
    categories: z.array(categoryPolicy).min(1).max(200),
    judges: z
      .array(
        z.object({
          judgeId: z.string().min(1),
          availableMinutes: z.number().positive().max(1440),
        }),
      )
      .min(1)
      .max(1000),
    presentationMinutes: z.number().positive().max(120).default(4),
    questionsMinutes: z.number().min(0).max(60).default(1),
    travelMinutes: z.number().min(0).max(60).default(2),
    reservePercent: z.number().min(0).max(50).default(15),
    reservationMinutes: z.number().positive().max(120).default(20),
    minRoomCompletionPercent: z.number().int().min(0).max(100).default(25),
    endsAt: z.iso.datetime(),
    amendmentReason: z.string().trim().min(10).max(2000).optional(),
  })
  .superRefine((v, ctx) => {
    for (const [key, ids] of [
      ['categories', v.categories.map((c) => c.categoryId)],
      ['judges', v.judges.map((j) => j.judgeId)],
    ] as const)
      if (new Set(ids).size !== ids.length)
        ctx.addIssue({
          code: 'custom',
          path: [key],
          message: 'Duplicate identifiers.',
        });
  });
export type ConfigureJudgingInput = z.input<typeof configureJudgingSchema>;
export type JudgingPolicy = Omit<
  z.output<typeof configureJudgingSchema>,
  'categories'
> & {
  version: 'CRITIQ_V1';
  setupFingerprint: string;
  ratingLabels: typeof ordinalRatingOptions;
  categories: (z.output<typeof categoryPolicy> & {
    method: 'RELATIVE' | 'RUBRIC' | 'RATING_SCALE';
    projectIds: string[];
    targetEvaluations?: number;
    rubric: {
      id: string;
      weight: number;
      lower: number;
      upper: number;
      name?: string;
      description?: string | null;
    }[];
  })[];
};
