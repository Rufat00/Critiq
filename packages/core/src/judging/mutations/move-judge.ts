import { moveJudgeSchema } from '../schemas/move-judge-schema';
import { judgingMutation, invalid } from '../shared/judging-operation';
import { loadJudgingState } from '../shared/load-judging-state';
import { enterRoom } from '../shared/enter-room';
import { expireReservations } from '../shared/expire-reservations';
import { calculateRoomProgress } from '../shared/room-stay-math';
import { listFeasibleCandidates } from '../orchestration/list-feasible-candidates';
export const moveJudge = judgingMutation(
  'judging.rooms.move',
  moveJudgeSchema,
)(async ({ ctx, input, event }) => {
  if (event.status !== 'JUDGING' || ctx.actor.type !== 'user')
    invalid('Judging must be running.');
  if (
    input.judgeId &&
    ctx.actor.role === 'JUDGE' &&
    input.judgeId !== ctx.actor.userId
  )
    invalid('Judges can only move themselves.');
  const judgeId = input.judgeId ?? ctx.actor.userId;
  await expireReservations(ctx, event.id);
  const state = await loadJudgingState(ctx);
  if (state.visits.some((v) => v.judgeId === judgeId))
    invalid('Complete or skip your current visit before moving.');
  const epoch = await ctx.db.roomStayEpoch.findFirst({
    where: { hackathonId: event.id, judgeId, exitedAt: null },
  });
  if (epoch?.roomId === input.roomId) return epoch;
  if (epoch) {
    const visits = await ctx.db.judgingVisit.findMany({
      where: { epochId: epoch.id, status: 'COMPLETED' },
    });
    const progress = calculateRoomProgress(
      epoch.reachableProjectIds,
      visits.map((v) => v.projectId),
      epoch.thresholdPercent,
    );
    if (!progress.canMoveNormally) {
      const local = listFeasibleCandidates(
        state,
        judgeId,
        epoch.roomId,
        Math.max(
          0,
          (new Date(state.policy.endsAt).getTime() - Date.now()) / 60000,
        ),
      ).filter((c) => c.roomId === epoch.roomId);
      if (
        ctx.actor.role === 'JUDGE' &&
        (local.length ||
          ![
            'NO_FEASIBLE_LOCAL_PROJECT',
            'PROJECT_UNAVAILABLE',
            'ROOM_CLOSED',
          ].includes(input.overrideReason ?? ''))
      )
        invalid(
          'Complete the room stay requirement, or use a valid no-local-project override.',
        );
      if (!input.overrideReason || !input.reason)
        invalid(
          'A named override and explanation are required before leaving this room.',
        );
    }
  }
  return enterRoom(
    ctx,
    state,
    judgeId,
    input.roomId,
    input.overrideReason
      ? `${input.overrideReason}: ${input.reason ?? ''}`
      : null,
  );
});
