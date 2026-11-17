import { calculateRemainingJudgeMinutes } from '../shared/judge-time-math';
import { requestNextAssignmentSchema } from '../schemas/request-next-assignment-schema';
import { judgingMutation, invalid } from '../shared/judging-operation';
import { loadJudgingState } from '../shared/load-judging-state';
import { expireReservations } from '../shared/expire-reservations';
import { enterRoom } from '../shared/enter-room';
import { listFeasibleCandidates } from '../orchestration/list-feasible-candidates';
import { scoreAssignmentCandidates } from '../orchestration/score-assignment-candidates';
import { shouldSwitchRoom } from '../orchestration/should-switch-room';
import { calculateRoomProgress } from '../shared/room-stay-math';
export const requestNextAssignment = judgingMutation(
  'judging.assignments.request',
  requestNextAssignmentSchema,
)(async ({ ctx, input, event }) => {
  if (ctx.actor.type !== 'user' || ctx.actor.role !== 'JUDGE')
    invalid('A judge account is required.');
  const judgeId = ctx.actor.userId;
  if (event.status !== 'JUDGING')
    invalid('Assignments are available while judging is running.');
  await expireReservations(ctx, event.id);
  const existing = await ctx.db.judgingVisit.findFirst({
    where: {
      hackathonId: event.id,
      judgeId,
      OR: [
        { status: { in: ['ASSIGNED', 'IN_PROGRESS'] } },
        { requestKey: input.requestKey },
      ],
    },
    include: {
      assignments: { select: { id: true, categoryId: true, status: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
  if (existing)
    return {
      status: ['ASSIGNED', 'IN_PROGRESS'].includes(existing.status)
        ? ('RESERVED' as const)
        : ('TERMINAL' as const),
      visit: existing,
    };
  const state = await loadJudgingState(ctx);
  const budget = state.policy.judges.find((j) => j.judgeId === judgeId);
  if (!budget) invalid('The judge has no planned available time.');
  const history = await ctx.db.judgingVisit.findMany({
    where: { hackathonId: event.id, judgeId },
  });
  const stays = await ctx.db.roomStayEpoch.findMany({
    where: { hackathonId: event.id, judgeId },
    orderBy: { enteredAt: 'asc' },
  });
  const remainingMinutes = calculateRemainingJudgeMinutes(
    budget.availableMinutes,
    history,
    stays,
    state.now,
  );
  let epoch = stays.find((s) => s.exitedAt === null);
  const candidates = scoreAssignmentCandidates(
    listFeasibleCandidates(state, judgeId, epoch?.roomId, remainingMinutes),
    state.config.revision + history.length,
  );
  const completed = epoch
    ? history
        .filter((v) => v.epochId === epoch!.id && v.status === 'COMPLETED')
        .map((v) => v.projectId)
    : [];
  const progress = epoch
    ? calculateRoomProgress(
        epoch.reachableProjectIds,
        completed,
        epoch.thresholdPercent,
      )
    : null;
  const choice = epoch
    ? shouldSwitchRoom(
        candidates.find((c) => c.roomId === epoch!.roomId),
        candidates.find((c) => c.roomId !== epoch!.roomId),
        progress!.canMoveNormally,
        state.policy.travelMinutes,
      )
    : { kind: 'MOVE' as const, candidate: candidates[0] ?? null, reason: null };
  const chosen = choice.candidate;
  if (!chosen)
    return { status: 'NO_FEASIBLE_ASSIGNMENT' as const, visit: null };
  if (!epoch || epoch.roomId !== chosen.roomId)
    epoch = await enterRoom(ctx, state, judgeId, chosen.roomId, choice.reason);
  const reason = chosen.minimumDeficit
    ? 'Project needs additional independent judges to meet minimum coverage.'
    : 'Balancing coverage and comparison evidence.';
  const attempts = await ctx.db.judgingAssignment.groupBy({
    by: ['categoryId'],
    where: {
      judgeId,
      projectId: chosen.projectId,
      categoryId: { in: chosen.competitionIds },
    },
    _max: { attempt: true },
  });
  const visit = await ctx.db.judgingVisit.create({
    data: {
      hackathonId: event.id,
      judgeId,
      projectId: chosen.projectId,
      roomId: chosen.roomId,
      epochId: epoch.id,
      requestKey: input.requestKey,
      reason,
      estimatedMinutes: chosen.estimatedMinutes,
      expiresAt: new Date(
        Math.min(
          state.now.getTime() + state.policy.reservationMinutes * 60000,
          new Date(state.policy.endsAt).getTime(),
        ),
      ),
      assignments: {
        create: chosen.competitionIds.map((categoryId) => ({
          categoryId,
          attempt:
            (attempts.find((a) => a.categoryId === categoryId)?._max.attempt ??
              0) + 1,
          expiresAt: new Date(
            Math.min(
              state.now.getTime() + state.policy.reservationMinutes * 60000,
              new Date(state.policy.endsAt).getTime(),
            ),
          ),
          judgeId,
          projectId: chosen.projectId,
        })),
      },
    },
    include: {
      assignments: { select: { id: true, categoryId: true, status: true } },
    },
  });
  return { status: 'RESERVED' as const, visit };
});
