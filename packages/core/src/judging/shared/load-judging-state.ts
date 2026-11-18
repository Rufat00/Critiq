import type { AppContext } from '../../context';
import { requireHackathonId } from '../../context';
import {
  configureJudgingSchema,
  type JudgingPolicy,
} from '../schemas/configure-judging-schema';
import { invalid } from './judging-operation';
export async function loadJudgingState(ctx: AppContext) {
  const hackathonId = requireHackathonId(ctx);
  const config = await ctx.db.judgingConfiguration.findUnique({
    where: { hackathonId },
  });
  if (!config) invalid('Configure judging before requesting assignments.');
  const policy = config.policy as unknown as JudgingPolicy;
  if (
    !configureJudgingSchema.safeParse(policy).success ||
    policy.version !== 'CRITIQ_V1'
  )
    invalid('Judging configuration is invalid.');
  const projects = await ctx.db.project.findMany({
    where: {
      hackathonId,
      isActive: true,
      isDisqualified: false,
      room: { isActive: true },
    },
    include: {
      track: true,
      challenges: { include: { challenge: true } },
      conflicts: true,
      flags: {
        where: { status: 'OPEN', type: { in: ['ABSENT', 'UNAVAILABLE'] } },
      },
    },
  });
  const categories = await ctx.db.judgingCategory.findMany({
    where: { hackathonId, isEnabled: true },
    include: {
      judges: {
        where: {
          isActive: true,
          user: { isActive: true, isJudgingAvailable: true, role: 'JUDGE' },
        },
      },
      evaluations: { where: { isExcluded: false } },
      rankings: true,
      rubric: { include: { criteria: { orderBy: { position: 'asc' } } } },
    },
  });
  const now = new Date();
  const visits = await ctx.db.judgingVisit.findMany({
    where: {
      hackathonId,
      status: { in: ['ASSIGNED', 'IN_PROGRESS'] },
      expiresAt: { gt: now },
    },
    include: { assignments: true },
  });
  const excluded = await ctx.db.evaluation.findMany({
    where: { category: { hackathonId }, isExcluded: true },
    select: { judgeId: true, projectId: true, categoryId: true },
  });
  return {
    hackathonId,
    config,
    policy,
    projects,
    categories,
    visits,
    now,
    excluded,
  };
}
export type JudgingState = Awaited<ReturnType<typeof loadJudgingState>>;
