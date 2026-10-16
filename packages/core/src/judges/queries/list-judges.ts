import type { Prisma } from '@critiq/db';
import { requireHackathonId } from '../../context';
import { createQuery } from '../../shared/operations';
import { paginationMetadata } from '../../shared/pagination/pagination';
import { requireJudgeTrack } from '../lib/require-judge-track';
import { listJudgesSchema } from '../schemas/list-judges-schema';

export const listJudges = createQuery({
  name: 'judges.list',
  schema: listJudgesSchema,
  roles: ['OWNER', 'ADMIN'],
})(async ({ ctx, input }) => {
  await requireJudgeTrack(ctx, input.filters.categoryId);
  const { page, pageSize } = input.pagination;
  const where: Prisma.JudgeCategoryWhereInput = {
    categoryId: input.filters.categoryId,
    category: { hackathonId: requireHackathonId(ctx) },
    isActive: true,
    user: {
      role: 'JUDGE',
      isActive: true,
      ...(input.search
        ? {
            OR: [
              { name: { contains: input.search, mode: 'insensitive' } },
              { email: { contains: input.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    },
  };
  const read = async (db: typeof ctx.db) => {
    const [rows, total] = await Promise.all([
      db.judgeCategory.findMany({
        where,
        orderBy: [{ user: { name: 'asc' } }, { userId: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          assignedAt: true,
          user: { select: { id: true, name: true, email: true } },
        },
      }),
      db.judgeCategory.count({ where }),
    ]);
    return {
      items: rows.map((row) => ({
        ...row.user,
        assignedAt: row.assignedAt.toISOString(),
      })),
      pagination: paginationMetadata(page, pageSize, total),
    };
  };
  return '$transaction' in ctx.db
    ? ctx.db.$transaction(read, { isolationLevel: 'RepeatableRead' })
    : read(ctx.db);
});
export type JudgeList = Awaited<ReturnType<typeof listJudges>>;
