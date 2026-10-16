import { z } from 'zod';
import { requireHackathonId } from '../../context';
import { createQuery } from '../../shared/operations';

export const listJudgeTracks = createQuery({
  name: 'judges.tracks.list',
  schema: z.object({}),
  roles: ['OWNER', 'ADMIN'],
})(async ({ ctx }) => {
  const hackathonId = requireHackathonId(ctx);
  const tracks = await ctx.db.judgingCategory.findMany({
    where: { hackathonId, kind: { in: ['OVERALL', 'TRACK'] } },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }, { id: 'asc' }],
    select: {
      id: true,
      name: true,
      kind: true,
      _count: {
        select: {
          judges: {
            where: { isActive: true, user: { role: 'JUDGE', isActive: true } },
          },
        },
      },
    },
  });
  return tracks
    .sort((a, b) => Number(b.kind === 'OVERALL') - Number(a.kind === 'OVERALL'))
    .map(({ _count, ...track }) => ({ ...track, judgeCount: _count.judges }));
});
export type JudgeTracks = Awaited<ReturnType<typeof listJudgeTracks>>;
