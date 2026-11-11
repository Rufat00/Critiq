import { z } from 'zod';

export const resetHackathonDataSchema = z.object({
  section: z.enum(['projects', 'judges', 'categories', 'rooms']),
  acknowledged: z.literal(true, {
    error: 'Confirm that you understand this deletion cannot be undone.',
  }),
});
export type ResetHackathonDataInput = z.input<typeof resetHackathonDataSchema>;
