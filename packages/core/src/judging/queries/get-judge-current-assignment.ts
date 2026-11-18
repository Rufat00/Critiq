import type { JudgingPolicy } from '../schemas/configure-judging-schema';
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
  const event = await ctx.db.hackathon.findUniqueOrThrow({
    where: { id: hackathonId },
  });
  const tracks = await ctx.db.judgeCategory.findMany({
    where: {
      userId: judgeId,
      isActive: true,
      category: {
        hackathonId,
        isEnabled: true,
        kind: { in: ['TRACK', 'OVERALL'] },
      },
    },
    select: { category: { select: { id: true, name: true } } },
  });
  const judged = await ctx.db.evaluation.findMany({
    where: {
      judgeId,
      isExcluded: false,
      category: { hackathonId, kind: { in: ['TRACK', 'OVERALL'] } },
    },
    select: { projectId: true },
  });
  const visit = await ctx.db.judgingVisit.findFirst({
    where: {
      hackathonId,
      judgeId,
      status: { in: ['ASSIGNED', 'IN_PROGRESS'] },
      expiresAt: { gt: event.judgingPausedAt ?? new Date() },
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
          challenges: {
            where: { challenge: { category: { isEnabled: true } } },
            select: {
              challenge: {
                select: {
                  category: { select: { id: true, name: true, method: true } },
                },
              },
            },
          },
        },
      },
      room: { select: { id: true, name: true, description: true } },
      assignments: {
        select: {
          id: true,
          categoryId: true,
          status: true,
          category: { select: { name: true, method: true, kind: true } },
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
  const policy = config?.policy as unknown as JudgingPolicy | undefined;
  return {
    event: {
      name: event.name,
      status: event.status,
      judgingSeconds: event.judgingSeconds,
    },
    tracks: tracks.map((t) => t.category),
    judgedCount: new Set(judged.map((e) => e.projectId)).size,
    visit: visit
      ? {
          ...visit,
          project: {
            ...visit.project,
            challenges: visit.project.challenges.map(
              (entry) => entry.challenge.category,
            ),
          },
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
export type JudgeWorkspace = Awaited<
  ReturnType<typeof getJudgeCurrentAssignment>
>;
