import type { AppContext } from '../../context';
import { requireHackathonId } from '../../context';
import { forbidden, invalid } from './judging-operation';
export async function requireVisit(
  ctx: AppContext,
  visitId: string,
  allowCompleted = false,
) {
  const visit = await ctx.db.judgingVisit.findFirst({
    where: { id: visitId, hackathonId: requireHackathonId(ctx) },
    include: {
      assignments: {
        include: {
          evaluation: { include: { scores: true } },
          category: { include: { judges: { where: { isActive: true } } } },
        },
      },
      project: {
        include: {
          track: true,
          challenges: { include: { challenge: true } },
          conflicts: true,
          room: true,
          flags: {
            where: { status: 'OPEN', type: { in: ['ABSENT', 'UNAVAILABLE'] } },
          },
        },
      },
    },
  });
  if (!visit || ctx.actor.type !== 'user' || visit.judgeId !== ctx.actor.userId)
    forbidden();
  if (allowCompleted && visit.status === 'COMPLETED') return visit;
  if (
    !['ASSIGNED', 'IN_PROGRESS'].includes(visit.status) ||
    visit.expiresAt <= new Date()
  )
    invalid('This visit is no longer active. Request another assignment.');
  if (
    !visit.project.isActive ||
    visit.project.isDisqualified ||
    !visit.project.room?.isActive ||
    visit.project.roomId !== visit.roomId ||
    visit.project.flags.length ||
    visit.project.conflicts.some((c) => c.userId === visit.judgeId)
  )
    invalid('The project is unavailable or conflicted.');
  for (const a of visit.assignments)
    if (
      !a.category.isEnabled ||
      a.category.status !== 'ACTIVE' ||
      !a.category.judges.some((j) => j.userId === visit.judgeId) ||
      (visit.project.track.categoryId !== a.categoryId &&
        !visit.project.challenges.some(
          (e) => e.challenge.categoryId === a.categoryId,
        ))
    )
      forbidden();
  return visit;
}
