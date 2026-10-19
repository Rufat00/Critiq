import { z } from 'zod';
import { createProjectSchema } from './create-project-schema';
export const updateProjectSchema = createProjectSchema.extend({
  projectId: z.string().trim().min(1).max(100),
});
export type UpdateProjectInput = z.input<typeof updateProjectSchema>;
