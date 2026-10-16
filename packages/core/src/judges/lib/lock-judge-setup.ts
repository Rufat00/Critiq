import type { AppContext } from '../../context';
import { lockDraft } from '../../hackathon/lib/lock-draft';

export async function lockJudgeSetup(ctx: AppContext) {
  // Same lock as registration: invitation rotation/revocation cannot race redemption.
  await ctx.db
    .$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(724181, 1)`;
  return lockDraft(ctx);
}
