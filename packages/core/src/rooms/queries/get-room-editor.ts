import { z } from 'zod';
import { requireHackathonId } from '../../context';
import { createQuery } from '../../shared/operations';
import { AppError, AppErrorCode } from '../../shared/errors';
import { getRoom } from './get-room';

export const getRoomEditor = createQuery({
  name: 'rooms.editor',
  schema: z.object({ roomId: z.string().min(1).optional() }),
  roles: ['OWNER', 'ADMIN'],
})(async ({ ctx, input }) => {
  const hackathonId = requireHackathonId(ctx);
  const read = async (db: typeof ctx.db) => {
    const hackathon = await db.hackathon.findUnique({
      where: { id: hackathonId },
      select: { status: true },
    });
    if (!hackathon)
      throw new AppError(AppErrorCode.NOT_FOUND, 'Hackathon not found.');
    const room = input.roomId
      ? await getRoom({ ...ctx, db }, { roomId: input.roomId })
      : null;
    const tracks = await db.track.findMany({
      where: {
        hackathonId,
        category: { hackathonId, kind: { in: ['OVERALL', 'TRACK'] } },
      },
      orderBy: [
        { category: { sortOrder: 'asc' } },
        { category: { name: 'asc' } },
        { id: 'asc' },
      ],
      select: {
        id: true,
        category: { select: { name: true } },
        _count: { select: { projects: { where: { hackathonId } } } },
        rooms: {
          where: { room: { hackathonId } },
          select: {
            tableRanges: {
              orderBy: { toNumber: 'desc' },
              take: 1,
              select: { toNumber: true },
            },
          },
        },
      },
    });
    const options = await Promise.all(
      tracks.map(async (track) => ({
        id: track.id,
        name: track.category.name,
        projectCount: track._count.projects,
        remainingProjects: await db.project.count({
          where: {
            hackathonId,
            trackId: track.id,
            OR: [
              { roomId: null },
              ...(input.roomId ? [{ roomId: input.roomId }] : []),
            ],
          },
        }),
        highestTableNumber: Math.max(
          0,
          ...track.rooms.flatMap((link) =>
            link.tableRanges.map((range) => range.toNumber),
          ),
        ),
      })),
    );
    return { room, tracks: options, locked: hackathon.status !== 'DRAFT' };
  };
  return '$transaction' in ctx.db
    ? ctx.db.$transaction(read, { isolationLevel: 'RepeatableRead' })
    : read(ctx.db);
});
export type RoomEditorData = Awaited<ReturnType<typeof getRoomEditor>>;
