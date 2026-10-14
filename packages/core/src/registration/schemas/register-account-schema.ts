import { z } from 'zod';

export const registerAccountSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Enter your full name.')
    .max(120)
    .refine(
      (name) => name.split(/\s+/u).filter(Boolean).length >= 2,
      'Enter at least two words for your full name.',
    ),
  email: z
    .email('Enter a valid email address.')
    .max(254)
    .transform((email) => email.toLowerCase()),
  password: z
    .string()
    .min(8, 'Use at least 8 characters.')
    .max(128, 'Use no more than 128 characters.')
    .refine(
      (password) => !/[\s\p{Cc}\p{Cf}]/u.test(password),
      'Password cannot contain spaces or invisible characters.',
    ),
  agreementRules: z.literal(true, {
    error: 'Please accept the participation agreement.',
  }),
  agreementPrivacy: z.literal(true, {
    error: 'Please accept the privacy agreement.',
  }),
  invitationToken: z.string().max(512).optional(),
});
export type RegisterAccountInput = z.input<typeof registerAccountSchema>;
