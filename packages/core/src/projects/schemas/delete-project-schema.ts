import { z } from 'zod';
export const deleteProjectSchema = z.object({
  projectId: z.string().trim().min(1).max(100),
});
export type DeleteProjectInput = z.input<typeof deleteProjectSchema>;
