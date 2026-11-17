import type { AppContext } from '../../context';
export async function expireReservations(
  ctx: AppContext,
  hackathonId: string,
  now = new Date(),
) {
  const where = {
    hackathonId,
    status: {
      in: ['ASSIGNED', 'IN_PROGRESS'] as ('ASSIGNED' | 'IN_PROGRESS')[],
    },
    expiresAt: { lte: now },
  };
  const visits = await ctx.db.judgingVisit.findMany({
    where,
    select: { id: true },
  });
  if (!visits.length) return;
  await ctx.db.judgingAssignment.updateMany({
    where: {
      visitId: { in: visits.map((v) => v.id) },
      status: { in: ['ASSIGNED', 'IN_PROGRESS'] },
    },
    data: { status: 'EXPIRED', finishedAt: now },
  });
  await ctx.db.judgingVisit.updateMany({
    where,
    data: { status: 'EXPIRED', finishedAt: now },
  });
  await ctx.db.auditLog.create({
    data: {
      hackathonId,
      actorId: ctx.actor.type === 'user' ? ctx.actor.userId : null,
      action: 'judging.reservations.expire',
      entityType: 'JudgingVisit',
      metadata: { visitIds: visits.map((v) => v.id), source: ctx.source },
    },
  });
}
