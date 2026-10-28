import { z } from 'zod';
export const setRoomTrackAccessSchema = z.object({
  roomId: z.string().min(1),
  tracks: z
    .array(
      z.object({
        trackId: z.string().min(1),
        ranges: z
          .array(
            z
              .object({
                fromNumber: z.number().int().min(1).max(2147483647),
                toNumber: z.number().int().min(1).max(2147483647),
              })
              .refine((r) => r.fromNumber <= r.toNumber, {
                message: 'The starting table must not exceed the ending table.',
                path: ['toNumber'],
              }),
          )
          .refine(
            (ranges) =>
              new Set(ranges.map((r) => `${r.fromNumber}:${r.toNumber}`))
                .size === ranges.length,
            'Remove duplicate ranges for this track.',
          ),
      }),
    )
    .refine(
      (tracks) => new Set(tracks.map((t) => t.trackId)).size === tracks.length,
      'Each track must appear once.',
    ),
});
export type SetRoomTrackAccessInput = z.input<typeof setRoomTrackAccessSchema>;
