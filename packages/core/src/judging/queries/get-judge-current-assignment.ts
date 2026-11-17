import { z } from 'zod';
import { ordinalRatingOptions } from '@critiq/constants';
import { requireHackathonId } from '../../context';
import { judgingQuery, forbidden } from '../shared/judging-operation';
import { calculateRoomProgress } from '../shared/room-stay-math';
export const getJudgeCurrentAssignment = judgingQuery(
  'judging.assignments.current',
  z.object({}),
)(async ({ ctx }) => {
  if (ctx.actor.type !== 'user') forbidden();
  const judgeId = ctx.actor.userId,
    hackathonId = requireHackathonId(ctx);
  const visit = await ctx.db.judgingVisit.findFirst({
    where: {
      hackathonId,
      judgeId,
      status: { in: ['ASSIGNED', 'IN_PROGRESS'] },
      expiresAt: { gt: new Date() },
    },
    include: {
      project: {
        select: {
          id: true,
          name: true,
          description: true,
          tableNumber: true,
          submissionUrl: true,
          demoUrl: true,
          repositoryUrl: true,
        },
      },
      room: { select: { id: true, name: true } },
      assignments: {
        select: {
          id: true,
          categoryId: true,
          status: true,
          category: { select: { name: true, method: true } },
          evaluation: {
            select: { id: true, ordinalRating: true, scores: true },
          },
        },
      },
    },
  });
  const epoch = await ctx.db.roomStayEpoch.findFirst({
    where: { hackathonId, judgeId, exitedAt: null },
  });
  const completed = epoch
    ? await ctx.db.judgingVisit.findMany({
        where: { epochId: epoch.id, status: 'COMPLETED' },
        select: { projectId: true },
      })
    : [];
  const config = await ctx.db.judgingConfiguration.findUnique({
    where: { hackathonId },
  });
  const policy = config?.policy as
    | { categories?: { categoryId: string; rubric: unknown }[] }
    | undefined;
  return {
    visit: visit
      ? {
          ...visit,
          assignments: visit.assignments.map((a) => ({
            ...a,
            evaluation: a.evaluation
              ? {
                  ...a.evaluation,
                  scores: a.evaluation.scores.map((s) => ({
                    ...s,
                    score: Number(s.score),
                  })),
                }
              : null,
          })),
        }
      : null,
    epoch: epoch
      ? {
          ...epoch,
          progress: calculateRoomProgress(
            epoch.reachableProjectIds,
            completed.map((v) => v.projectId),
            epoch.thresholdPercent,
          ),
        }
      : null,
    ratingLabels: ordinalRatingOptions,
    rubrics:
      policy?.categories
        ?.filter((c) =>
          visit?.assignments.some((a) => a.categoryId === c.categoryId),
        )
        .map((c) => ({ categoryId: c.categoryId, rubric: c.rubric })) ?? [],
  };
});
