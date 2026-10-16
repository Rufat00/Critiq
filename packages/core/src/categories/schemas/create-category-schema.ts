import { z } from 'zod';

export const createCategorySchema = z
  .object({
    kind: z.enum(['TRACK', 'CHALLENGE']),
    name: z
      .string()
      .trim()
      .min(1, 'Enter a title.')
      .max(100, 'Use 100 characters or fewer.'),
    description: z
      .string()
      .trim()
      .max(2000, 'Use 2,000 characters or fewer.')
      .default(''),
    method: z.enum(['RELATIVE', 'RATING_SCALE', 'RUBRIC']),
    includesOverall: z.boolean().default(true),
    trackIds: z.array(z.string().trim().min(1).max(128)).max(500).default([]),
    challengeIds: z
      .array(z.string().trim().min(1).max(128))
      .max(500)
      .default([]),
    criteria: z
      .array(
        z.object({
          name: z
            .string()
            .trim()
            .min(1, 'Name this rubric item.')
            .max(100, 'Use 100 characters or fewer.'),
          weight: z
            .number()
            .multipleOf(10, 'Choose a weight in 10% increments.')
            .min(10, 'Use at least 10%.')
            .max(100, 'Use 100% or less.'),
        }),
      )
      .max(10, 'Use at most 10 rubric items.')
      .default([]),
  })
  .superRefine((input, ctx) => {
    if (
      (input.kind === 'TRACK' && input.method === 'RATING_SCALE') ||
      (input.kind === 'CHALLENGE' && input.method === 'RELATIVE')
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['method'],
        message: 'Choose a judging method supported by this category.',
      });
    }
    for (const field of ['trackIds', 'challengeIds'] as const) {
      if (new Set(input[field]).size !== input[field].length)
        ctx.addIssue({
          code: 'custom',
          path: [field],
          message: 'Choose each entry only once.',
        });
    }
    if (
      input.kind === 'TRACK' &&
      (input.trackIds.length || !input.includesOverall)
    )
      ctx.addIssue({
        code: 'custom',
        path: ['trackIds'],
        message: 'Tracks can only select challenges.',
      });
    if (input.kind === 'CHALLENGE') {
      if (input.challengeIds.length)
        ctx.addIssue({
          code: 'custom',
          path: ['challengeIds'],
          message: 'Challenges can only select tracks.',
        });
      if (!input.includesOverall && !input.trackIds.length)
        ctx.addIssue({
          code: 'custom',
          path: ['trackIds'],
          message:
            'Choose at least one track, including Overall if appropriate.',
        });
    }
    if (input.method !== 'RUBRIC') {
      if (input.criteria.length)
        ctx.addIssue({
          code: 'custom',
          path: ['criteria'],
          message: 'Rubric items require Rubric judging.',
        });
      return;
    }
    if (!input.criteria.length)
      ctx.addIssue({
        code: 'custom',
        path: ['criteria'],
        message: 'Add at least one rubric item.',
      });
    if (input.criteria.reduce((sum, item) => sum + item.weight, 0) !== 100)
      ctx.addIssue({
        code: 'custom',
        path: ['criteria'],
        message: 'Rubric weights must total exactly 100%.',
      });
    const names = new Set<string>();
    input.criteria.forEach((item, index) => {
      const name = item.name.replace(/\s+/g, ' ').toLowerCase();
      if (names.has(name))
        ctx.addIssue({
          code: 'custom',
          path: ['criteria', index, 'name'],
          message: 'Use a distinct name for each rubric item.',
        });
      names.add(name);
    });
  });
export type CreateCategoryInput = z.input<typeof createCategorySchema>;
