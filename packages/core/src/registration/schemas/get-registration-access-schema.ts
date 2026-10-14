import { z } from 'zod';

export const getRegistrationAccessSchema = z.object({
  setupToken: z.string().min(1).max(512).optional(),
  invitationToken: z.string().min(1).max(512).optional(),
  email: z.email().max(254).optional(),
});
