import type { AppContext } from '../../context';
import { requireHackathonId } from '../../context';
import { AppError, AppErrorCode } from '../../shared/errors';

export async function lockDraft(ctx: AppContext) {
  const id = requireHackathonId(ctx);
  // Serialize checklist completion and stage changes before reading configuration.
  const updated = await ctx.db.hackathon.updateMany({
    where: { id, status: 'DRAFT' },
    data: { status: 'DRAFT' },
  });
  if (updated.count !== 1)
    throw new AppError(
      AppErrorCode.INVALID_STATE,
      'Setup can only be changed in draft. Refresh to see the current stage.',
    );
  return id;
}
