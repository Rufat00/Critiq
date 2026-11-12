import { z } from 'zod';
export const setRoomTrackAccessSchema = z.object({
  roomId: z.string().min(1),
  tracks: z
    .array(
      z.object({
        trackId: z.string().min(1),
        capacity: z.number().int().min(0).max(2147483647),
      }),
    )
    .refine(
      (tracks) => new Set(tracks.map((t) => t.trackId)).size === tracks.length,
      'Each track must appear once.',
    ),
});
export type SetRoomTrackAccessInput = z.input<typeof setRoomTrackAccessSchema>;
