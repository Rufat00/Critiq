import { z } from 'zod';

const optionalUrl = z
  .string()
  .trim()
  .max(2000)
  .refine((value) => {
    if (!value) return true;
    try {
      return ['https:', 'http:'].includes(new URL(value).protocol);
    } catch {
      return false;
    }
  }, 'Enter an http or https URL.')
  .default('');

export const createProjectSchema = z.object({
  name: z.string().trim().min(1, 'Enter a project title.').max(200),
  description: z.string().trim().max(20000).default(''),
  submissionUrl: optionalUrl,
  repositoryUrl: optionalUrl,
  demoUrl: optionalUrl,
  trackId: z.string().trim().min(1, 'Choose a track.').max(100),
  challengeIds: z.array(z.string().trim().min(1).max(100)).max(100).default([]),
});
export type CreateProjectInput = z.input<typeof createProjectSchema>;
