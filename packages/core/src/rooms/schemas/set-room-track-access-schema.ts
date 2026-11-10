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
    )
    .superRefine((tracks, ctx) => {
      const ranges = tracks
        .flatMap((track, trackIndex) =>
          track.ranges.map((range, rangeIndex) => ({
            ...range,
            trackIndex,
            rangeIndex,
          })),
        )
        .sort((a, b) => a.fromNumber - b.fromNumber);
      let end = 0;
      for (const range of ranges) {
        if (range.fromNumber <= end)
          ctx.addIssue({
            code: 'custom',
            message:
              'Table ranges in a room must not overlap. Each table belongs to one track.',
            path: [range.trackIndex, 'ranges', range.rangeIndex, 'fromNumber'],
          });
        end = Math.max(end, range.toNumber);
      }
    }),
});
export type SetRoomTrackAccessInput = z.input<typeof setRoomTrackAccessSchema>;
