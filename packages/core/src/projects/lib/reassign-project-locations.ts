import type { AppContext } from '../../context';
import { requireHackathonId } from '../../context';
import { AppError, AppErrorCode } from '../../shared/errors';
import { writeAuditLog } from '../../shared/operations/write-audit-log';
import { planProjectLocations } from './plan-project-locations';

// Call only inside the organizer mutation's transaction, after taking lockDraft.
export async function reassignProjectLocations(ctx: AppContext) {
  const hackathonId = requireHackathonId(ctx);
  const [projects, rooms] = await Promise.all([
    ctx.db.project.findMany({
      where: { hackathonId },
      orderBy: { registrationOrder: 'asc' },
      select: {
        id: true,
        trackId: true,
        roomId: true,
        tableNumber: true,
        _count: {
          select: { assignments: true, evaluations: true, rankings: true },
        },
      },
    }),
    ctx.db.trackRoom.findMany({
      where: {
        isActive: true,
        room: { hackathonId, isActive: true },
        track: {
          hackathonId,
          category: { hackathonId, kind: { in: ['OVERALL', 'TRACK'] } },
        },
      },
      orderBy: [
        { sortOrder: 'asc' },
        { room: { createdAt: 'asc' } },
        { roomId: 'asc' },
        { id: 'asc' },
      ],
      select: {
        roomId: true,
        trackId: true,
        capacity: true,
      },
    }),
  ]);
  const locations = planProjectLocations(projects, rooms);
  const previousById = new Map(
    projects.map((project) => [project.id, project]),
  );
  for (const location of locations) {
    const previous = previousById.get(location.id)!;
    if (
      previous.roomId === location.roomId &&
      previous.tableNumber === location.tableNumber
    )
      continue;
    if (
      previous._count.assignments ||
      previous._count.evaluations ||
      previous._count.rankings
    ) {
      throw new AppError(
        AppErrorCode.INVALID_STATE,
        'This change would move a project with judging activity. Its saved location must be kept.',
      );
    }
    const before = {
      roomId: previous.roomId,
      tableNumber: previous.tableNumber,
    };
    const after = {
      roomId: location.roomId,
      tableNumber: location.tableNumber,
    };
    await ctx.db.project.update({
      where: { id: location.id, hackathonId },
      data: after,
    });
    await writeAuditLog(
      'projects.place',
      {
        entityType: 'Project',
        getEntityId: ({ result }) => result.id,
        getBefore: ({ result }) => result.before,
        getAfter: ({ result }) => result.after,
      },
      { ctx, input: {}, result: { id: location.id, before, after } },
    );
  }
  return locations;
}
