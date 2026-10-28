import { z } from 'zod';
import { createRoomSchema } from './create-room-schema';
export const updateRoomSchema = createRoomSchema.extend({
  tracks: createRoomSchema.shape.tracks.unwrap().optional(),
  roomId: z.string().min(1),
  isActive: z.boolean(),
});
export type UpdateRoomInput = z.input<typeof updateRoomSchema>;
