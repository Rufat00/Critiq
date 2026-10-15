import { createHash } from 'node:crypto';
import type { AppContext } from '../../context';
import { requireHackathonId } from '../../context';
import { AppError, AppErrorCode } from '../../shared/errors';

export async function readSetupSnapshot(ctx: AppContext) {
  const id = requireHackathonId(ctx);
  const hackathon = await ctx.db.hackathon.findUnique({
    where: { id },
    include: {
      setupCompletions: true,
      categories: {
        orderBy: { id: 'asc' },
        include: {
          rubric: { include: { criteria: { orderBy: { id: 'asc' } } } },
          judges: { orderBy: { userId: 'asc' } },
          track: true,
          challenge: {
            include: { allowedTracks: { orderBy: { trackId: 'asc' } } },
          },
        },
      },
      projects: {
        orderBy: { id: 'asc' },
        include: { challenges: { orderBy: { challengeId: 'asc' } } },
      },
      rooms: {
        orderBy: { id: 'asc' },
        include: {
          trackRooms: {
            orderBy: { id: 'asc' },
            include: { tableRanges: { orderBy: { id: 'asc' } } },
          },
        },
      },
      invitations: {
        orderBy: { id: 'asc' },
        select: {
          id: true,
          status: true,
          expiresAt: true,
          maxUses: true,
          usedCount: true,
        },
      },
    },
  });
  if (!hackathon)
    throw new AppError(AppErrorCode.NOT_FOUND, 'Hackathon not found.');
  // Accounts are installation-wide; category memberships remain scoped above.
  const judges = await ctx.db.user.findMany({
    where: { role: 'JUDGE' },
    orderBy: { id: 'asc' },
    select: {
      id: true,
      name: true,
      isActive: true,
      updatedAt: true,
      conflicts: {
        where: { project: { hackathonId: id } },
        orderBy: { projectId: 'asc' },
      },
    },
  });
  return { hackathon, judges };
}
export type SetupSnapshot = Awaited<ReturnType<typeof readSetupSnapshot>>;

export function fingerprint(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}
