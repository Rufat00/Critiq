import { z } from 'zod';

export const deleteRoomSchema = z.object({ roomId: z.string().min(1) });
export type DeleteRoomInput = z.input<typeof deleteRoomSchema>;
