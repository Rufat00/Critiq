import { z } from 'zod';
export const importProjectsSchema = z.object({
  format: z.enum(['devpost', 'csv']),
  csv: z
    .string()
    .min(1, 'Choose a CSV file.')
    .max(1_000_000, 'Choose a CSV file smaller than 1 MB.')
    .refine(
      (value) => !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\ufffd]/u.test(value),
      'Choose a UTF-8 CSV text file.',
    )
    .refine(
      (value) => Buffer.byteLength(value, 'utf8') <= 1_000_000,
      'Choose a CSV file smaller than 1 MB.',
    ),
});
export type ImportProjectsInput = z.input<typeof importProjectsSchema>;
