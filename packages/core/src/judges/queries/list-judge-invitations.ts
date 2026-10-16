import { createQuery } from '../../shared/operations';
import { requireHackathonId } from '../../context';
import { paginationMetadata } from '../../shared/pagination/pagination';
import { requireJudgeTrack } from '../lib/require-judge-track';
import { listJudgesSchema } from '../schemas/list-judges-schema';

export const listJudgeInvitations = createQuery({
  name: 'judges.invitations.list',
  schema: listJudgesSchema,
  roles: ['OWNER', 'ADMIN'],
})(async ({ ctx, input }) => {
  await requireJudgeTrack(ctx, input.filters.categoryId);
  const { page, pageSize } = input.pagination;
  const read = async (db: typeof ctx.db) => {
    const where = {
      hackathonId: requireHackathonId(ctx),
      role: 'JUDGE' as const,
      status: 'ACTIVE' as const,
      usedCount: { lt: db.invitation.fields.maxUses },
      expiresAt: { gt: new Date() },
      categories: { some: { categoryId: input.filters.categoryId } },
      ...(input.search
        ? { email: { contains: input.search, mode: 'insensitive' as const } }
        : {}),
    };
    const [items, total] = await Promise.all([
      db.invitation.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: { id: true, email: true, expiresAt: true },
      }),
      db.invitation.count({ where }),
    ]);
    return {
      items: items.map((item) => ({
        ...item,
        expiresAt: item.expiresAt.toISOString(),
      })),
      pagination: paginationMetadata(page, pageSize, total),
    };
  };
  return '$transaction' in ctx.db
    ? ctx.db.$transaction(read, { isolationLevel: 'RepeatableRead' })
    : read(ctx.db);
});
export type JudgeInvitations = Awaited<ReturnType<typeof listJudgeInvitations>>;
