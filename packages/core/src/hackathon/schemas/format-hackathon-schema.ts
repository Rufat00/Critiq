import { z } from 'zod';

export const formatHackathonSchema = z.object({
  eventName: z.string().min(1, 'Enter the current event name.').max(100),
  acknowledged: z.literal(true, {
    error: 'Confirm that you understand formatting cannot be undone.',
  }),
});
export type FormatHackathonInput = z.input<typeof formatHackathonSchema>;
