import { z } from 'zod';

export const setChallengeTrackSchema = z.object({
  trackCategoryId: z.string().trim().min(1).max(128),
  challengeCategoryId: z.string().trim().min(1).max(128),
  included: z.boolean(),
});
export type SetChallengeTrackInput = z.infer<typeof setChallengeTrackSchema>;
