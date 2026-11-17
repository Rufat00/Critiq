import { z } from 'zod';
export const submitRatingVoteSchema = z.object({
  visitId: z.string().min(1),
  assignmentId: z.string().min(1),
  rating: z.number().int().min(1).max(5),
  notes: z.string().trim().max(4000).optional(),
});
export type SubmitRatingVoteInput = z.input<typeof submitRatingVoteSchema>;
