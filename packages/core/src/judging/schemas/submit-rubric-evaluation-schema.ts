import { z } from 'zod';
export const submitRubricEvaluationSchema = z.object({
  visitId: z.string().min(1),
  assignmentId: z.string().min(1),
  marks: z
    .array(
      z.object({
        criterionId: z.string().min(1),
        value: z
          .number()
          .min(0)
          .max(10000)
          .refine(
            (n) => Math.round(n * 10000) / 10000 === n,
            'Use at most four decimal places.',
          ),
      }),
    )
    .min(1)
    .max(100),
  notes: z.string().trim().max(4000).optional(),
});
export type SubmitRubricEvaluationInput = z.input<
  typeof submitRubricEvaluationSchema
>;
