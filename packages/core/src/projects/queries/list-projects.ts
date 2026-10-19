import { Prisma } from '@critiq/db';
import { createQuery } from '../../shared/operations';
import { requireHackathonId } from '../../context';
import { AppError, AppErrorCode } from '../../shared/errors';
import { paginationMetadata } from '../../shared/pagination/pagination';
import { listProjectsSchema } from '../schemas/list-projects-schema';

export const listProjects = createQuery({
  name: 'projects.list',
  schema: listProjectsSchema,
  roles: ['OWNER', 'ADMIN'],
})(async ({ ctx, input }) => {
  const hackathonId = requireHackathonId(ctx);
  const read = async (db: typeof ctx.db) => {
    if (
      input.filters.trackId &&
      !(await db.track.findFirst({
        where: { id: input.filters.trackId, hackathonId },
        select: { id: true },
      }))
    )
      throw new AppError(AppErrorCode.NOT_FOUND, 'Track not found.');
    const where: Prisma.ProjectWhereInput = {
      hackathonId,
      trackId: input.filters.trackId,
      ...(input.search
        ? {
            OR: [
              { name: { contains: input.search, mode: 'insensitive' } },
              { description: { contains: input.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      db.project.findMany({
        where,
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
        skip: (input.pagination.page - 1) * input.pagination.pageSize,
        take: input.pagination.pageSize,
        select: {
          id: true,
          name: true,
          description: true,
          trackId: true,
          submissionUrl: true,
          repositoryUrl: true,
          demoUrl: true,
          roomId: true,
          tableNumber: true,
          challenges: {
            select: {
              challengeId: true,
              challenge: { select: { category: { select: { name: true } } } },
            },
          },
        },
      }),
      db.project.count({ where }),
    ]);
    return {
      items,
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
export type ProjectList = Awaited<ReturnType<typeof listProjects>>;
