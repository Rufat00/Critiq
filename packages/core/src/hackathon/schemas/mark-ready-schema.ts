import { z } from 'zod';

export const markReadySchema = z.object({
  fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  acknowledgeWarnings: z.boolean(),
});
export type MarkReadyInput = z.input<typeof markReadySchema>;
