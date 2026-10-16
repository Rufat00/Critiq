import { z } from 'zod';
import { requireHackathonId } from '../../context';
import { createQuery } from '../../shared/operations';
import { AppError, AppErrorCode } from '../../shared/errors';

export const getJudgingCategories = createQuery({
  name: 'categories.get',
  schema: z.object({}),
  roles: ['OWNER', 'ADMIN'],
})(async ({ ctx }) => {
  const hackathonId = requireHackathonId(ctx);
  const read = async (db: typeof ctx.db) => {
    const hackathon = await db.hackathon.findUnique({
      where: { id: hackathonId },
      select: {
        status: true,
        categories: {
          orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }, { id: 'asc' }],
          select: {
            id: true,
            kind: true,
            name: true,
            description: true,
            method: true,
            rubric: {
              select: {
                criteria: {
                  orderBy: { position: 'asc' },
                  select: { id: true, name: true, weight: true },
                },
              },
            },
            track: {
              select: {
                id: true,
                _count: { select: { projects: { where: { hackathonId } } } },
              },
            },
            challenge: {
              select: {
                id: true,
                includesOverall: true,
                allowedTracks: {
                  where: { track: { hackathonId } },
                  select: { trackId: true },
                },
                _count: {
                  select: {
                    projectEntries: { where: { project: { hackathonId } } },
                  },
                },
              },
            },
          },
        },
      },
    });
    if (!hackathon)
      throw new AppError(AppErrorCode.NOT_FOUND, 'Hackathon not found.');
    const overallProjectCount = await db.project.count({
      where: { hackathonId, trackId: null },
    });
    const tracks = hackathon.categories
      .filter((c) => c.kind !== 'CHALLENGE')
      .map((c) => ({
        id: c.id,
        name: c.name,
        description: c.description,
        method: c.method,
        criteria:
          c.rubric?.criteria.map((item) => ({
            id: item.id,
            name: item.name,
            weight: item.weight.toNumber(),
          })) ?? [],
        isOverall: c.kind === 'OVERALL',
        trackId: c.track?.id ?? null,
        projectCount:
          c.kind === 'OVERALL'
            ? overallProjectCount
            : (c.track?._count.projects ?? 0),
      }))
      .sort((a, b) => Number(b.isOverall) - Number(a.isOverall));
    const challenges = hackathon.categories
      .filter((c) => c.kind === 'CHALLENGE')
      .map((c) => ({
        id: c.id,
        name: c.name,
        description: c.description,
        method: c.method,
        criteria:
          c.rubric?.criteria.map((item) => ({
            id: item.id,
            name: item.name,
            weight: item.weight.toNumber(),
          })) ?? [],
        challengeId: c.challenge?.id ?? null,
        includesOverall: c.challenge?.includesOverall ?? false,
        projectCount: c.challenge?._count.projectEntries ?? 0,
        trackIds: tracks
          .filter((t) =>
            t.isOverall
              ? c.challenge?.includesOverall === true
              : c.challenge?.allowedTracks.some(
                  (link) => link.trackId === t.trackId,
                ),
          )
          .map((t) => t.id),
      }));
    return { status: hackathon.status, tracks, challenges };
  };
  return '$transaction' in ctx.db
    ? ctx.db.$transaction(read, { isolationLevel: 'RepeatableRead' })
    : read(ctx.db);
});
export type JudgingCategories = Awaited<
  ReturnType<typeof getJudgingCategories>
>;
