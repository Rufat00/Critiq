import type { AppContext } from '../../context';
import type { JudgingState } from './load-judging-state';
import { eligibleCategories } from './assignment-eligibility';
import { invalid } from './judging-operation';
export async function enterRoom(
  ctx: AppContext,
  state: JudgingState,
  judgeId: string,
  roomId: string,
  reason: string | null,
) {
  const reachable = state.projects.filter(
    (p) =>
      p.roomId === roomId &&
      eligibleCategories(state, judgeId, p).some(
        (c) =>
          !state.excluded.some(
            (e) =>
              e.projectId === p.id &&
              e.judgeId === judgeId &&
              e.categoryId === c.id,
          ) &&
          c.evaluations.filter((e) => e.projectId === p.id).length <
            state.policy.categories.find(
              (policy) => policy.categoryId === c.id,
            )!.maximumEvaluations &&
          !c.evaluations.some(
            (e) => e.projectId === p.id && e.judgeId === judgeId,
          ),
      ),
  );
  if (!reachable.length) invalid('No reachable projects remain in that room.');
  const now = new Date();
  await ctx.db.roomStayEpoch.updateMany({
    where: { hackathonId: state.hackathonId, judgeId, exitedAt: null },
    data: { exitedAt: now, moveReason: reason },
  });
  const epoch = await ctx.db.roomStayEpoch.create({
    data: {
      hackathonId: state.hackathonId,
      judgeId,
      roomId,
      reachableProjectIds: reachable.map((p) => p.id),
      physicalRoomSize: state.projects.filter((p) => p.roomId === roomId)
        .length,
      thresholdPercent: state.policy.minRoomCompletionPercent,
      moveReason: reason,
      travelMinutes: state.policy.travelMinutes,
    },
  });
  await ctx.db.judgeCategory.updateMany({
    where: {
      userId: judgeId,
      isActive: true,
      category: { hackathonId: state.hackathonId },
    },
    data: { currentRoomId: roomId },
  });
  await ctx.db.auditLog.create({
    data: {
      hackathonId: state.hackathonId,
      actorId: ctx.actor.type === 'user' ? ctx.actor.userId : null,
      action: 'judging.room.enter',
      entityType: 'RoomStayEpoch',
      entityId: epoch.id,
      metadata: {
        roomId,
        judgeId,
        reason,
        reachableProjectIds: epoch.reachableProjectIds,
        thresholdPercent: epoch.thresholdPercent,
      },
    },
  });
  return epoch;
}
