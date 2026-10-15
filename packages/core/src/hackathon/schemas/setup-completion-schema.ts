import { z } from 'zod';

export const setupCompletionSchema = z.object({
  section: z.enum(['event', 'categories', 'projects', 'judges', 'rooms']),
  fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  completed: z.boolean(),
});
export type SetupCompletionInput = z.input<typeof setupCompletionSchema>;
export type SetupSection = SetupCompletionInput['section'];
