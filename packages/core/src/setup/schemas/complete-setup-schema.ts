import { z } from 'zod';

export const completeSetupSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Enter your hackathon name.')
    .max(100, 'Use 100 characters or fewer.'),
});

export type CompleteSetupInput = z.input<typeof completeSetupSchema>;
