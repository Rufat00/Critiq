import { z } from 'zod';
import { requireHackathonId } from '../../context';
import { judgingQuery, invalid } from '../shared/judging-operation';
export const getJudgingSetup = judgingQuery(
  'judging.setup',
  z.object({}),
  true,
)(async ({ ctx }) => {
  const event = await ctx.db.hackathon.findUnique({
    where: { id: requireHackathonId(ctx) },
    include: {
      judgingConfig: true,
      categories: {
        where: { isEnabled: true },
        orderBy: { sortOrder: 'asc' },
        include: {
          judges: {
            where: { isActive: true, user: { isActive: true, role: 'JUDGE' } },
            select: { userId: true },
          },
        },
      },
    },
  });
  if (!event) invalid('Hackathon is unavailable.');
  return {
    revision: event.judgingConfig?.revision ?? 0,
    roomSwitchPercent: event.roomSwitchPercent,
    judgingSeconds: event.judgingSeconds,
    categories: event.categories.map((c) => ({
      id: c.id,
      name: c.name,
      kind: c.kind,
      minimum: c.minEvaluations,
      maximum: c.maxEvaluations,
      target: c.targetEvaluations,
    })),
    judgeIds: [
      ...new Set(
        event.categories.flatMap((c) => c.judges.map((j) => j.userId)),
      ),
    ],
  };
});
export type JudgingSetup = Awaited<ReturnType<typeof getJudgingSetup>>;
