import type { AppContext } from '../../context';
import { requireHackathonId } from '../../context';
import { AppError, AppErrorCode } from '../../shared/errors';

export async function lockJudgeSetup(ctx: AppContext) {
  // Same lock as registration: invitation rotation/revocation cannot race redemption.
  await ctx.db
    .$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(724181, 1)`;
  const id = requireHackathonId(ctx);
  const updated = await ctx.db.hackathon.updateMany({
    where: { id, status: { in: ['DRAFT', 'READY'] } },
    data: { updatedAt: new Date() },
  });
  if (updated.count !== 1)
    throw new AppError(
      AppErrorCode.INVALID_STATE,
      'Judges can only be changed before judging starts.',
    );
  return id;
}
