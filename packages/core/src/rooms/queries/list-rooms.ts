import { requireHackathonId } from '../../context';
import { createQuery } from '../../shared/operations';
import { AppError, AppErrorCode } from '../../shared/errors';
import { paginationMetadata } from '../../shared/pagination/pagination';
import { listRoomsSchema } from '../schemas/list-rooms-schema';
import { roomSearchWhere } from '../lib/room-search-where';
export const listRooms = createQuery({
  name: 'rooms.list',
  schema: listRoomsSchema,
  roles: ['OWNER', 'ADMIN'],
})(async ({ ctx, input }) => {
  const hackathonId = requireHackathonId(ctx);
  const read = async (db: typeof ctx.db) => {
    const where = roomSearchWhere(hackathonId, input.search);
    const [hackathon, items, total, rooms, placed, unassigned, tracks] =
      await Promise.all([
        db.hackathon.findUnique({
          where: { id: hackathonId },
          select: { status: true },
        }),
        db.room.findMany({
          where,
          orderBy: [{ name: 'asc' }, { id: 'asc' }],
          skip: (input.pagination.page - 1) * input.pagination.pageSize,
          take: input.pagination.pageSize,
          select: {
            id: true,
            name: true,
            description: true,
            isActive: true,
            _count: { select: { projects: { where: { hackathonId } } } },
            trackRooms: {
              where: { track: { hackathonId } },
              orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
              select: {
                trackId: true,
                isActive: true,
                capacity: true,
                track: { select: { category: { select: { name: true } } } },
              },
            },
          },
        }),
        db.room.count({ where }),
        db.room.count({ where: { hackathonId } }),
        db.project.count({ where: { hackathonId, roomId: { not: null } } }),
        db.project.count({ where: { hackathonId, roomId: null } }),
        db.track.findMany({
          where: {
            hackathonId,
            category: { hackathonId, kind: { in: ['OVERALL', 'TRACK'] } },
          },
          orderBy: [{ category: { name: 'asc' } }, { id: 'asc' }],
          select: { id: true, category: { select: { name: true } } },
        }),
      ]);
    if (!hackathon)
      throw new AppError(AppErrorCode.NOT_FOUND, 'Hackathon not found.');
    return {
      items,
      tracks,
      locked: hackathon.status !== 'DRAFT',
      summary: { rooms, placed, unassigned },
      pagination: paginationMetadata(
        input.pagination.page,
        input.pagination.pageSize,
        total,
      ),
    };
  };
  return '$transaction' in ctx.db
    ? ctx.db.$transaction(read, { isolationLevel: 'RepeatableRead' })
    : read(ctx.db);
});
export type RoomsOverview = Awaited<ReturnType<typeof listRooms>>;
