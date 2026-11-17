import { z } from 'zod';
export const moveJudgeSchema = z.object({
  judgeId: z.string().min(1).optional(),
  roomId: z.string().min(1),
  overrideReason: z
    .enum([
      'NO_FEASIBLE_LOCAL_PROJECT',
      'PROJECT_UNAVAILABLE',
      'URGENT_MINIMUM_COVERAGE',
      'ROOM_CLOSED',
      'JUDGE_BREAK',
      'ADMIN_OVERRIDE',
      'EVENT_ENDING',
    ])
    .optional(),
  reason: z.string().trim().min(3).max(1000).optional(),
});
export type MoveJudgingRoomInput = z.input<typeof moveJudgeSchema>;
