import type { AppContext } from '../../context';
import { requireHackathonId } from '../../context';
import { AppError, AppErrorCode } from '../../shared/errors';

export async function requireProject(ctx: AppContext, projectId: string) {
  const project = await ctx.db.project.findFirst({
    where: { id: projectId, hackathonId: requireHackathonId(ctx) },
    include: {
      challenges: { select: { challengeId: true } },
      _count: {
        select: { assignments: true, evaluations: true, rankings: true },
      },
    },
  });
  if (!project)
    throw new AppError(
      AppErrorCode.NOT_FOUND,
      'Project not found. Refresh and try again.',
    );
  if (
    project._count.assignments ||
    project._count.evaluations ||
    project._count.rankings
  )
    throw new AppError(
      AppErrorCode.INVALID_STATE,
      'Projects with judging activity cannot be changed or deleted.',
    );
  return project;
}
