import { z } from 'zod';
export const requestNextAssignmentSchema = z.object({
  requestKey: z.string().trim().min(1).max(100),
});
export type RequestNextAssignmentInput = z.input<
  typeof requestNextAssignmentSchema
>;
