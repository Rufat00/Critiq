import { z } from 'zod';

export const updateHackathonSettingsSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Enter a hackathon name.')
    .max(100, 'Use 100 characters or fewer.'),
  scoreScale: z.union([z.literal(5), z.literal(10)], {
    error: 'Choose a 5-point or 10-point scale.',
  }),
  roomSwitchPercent: z
    .number()
    .int()
    .min(0)
    .max(100)
    .multipleOf(5, 'Choose a percentage in steps of 5.'),
});
export type UpdateHackathonSettingsInput = z.input<
  typeof updateHackathonSettingsSchema
>;
