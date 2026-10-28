import { z } from 'zod';
import { setRoomTrackAccessSchema } from './set-room-track-access-schema';
export const createRoomSchema = z.object({
  tracks: setRoomTrackAccessSchema.shape.tracks.default([]),
  name: z.string().trim().min(1, 'Enter a room name.').max(100),
  description: z.string().trim().max(2000).default(''),
});
export type CreateRoomInput = z.input<typeof createRoomSchema>;
