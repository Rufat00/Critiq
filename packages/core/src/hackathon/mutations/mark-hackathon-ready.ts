import { createMutation } from '../../shared/operations';
import { AppError, AppErrorCode } from '../../shared/errors';
import { markReadySchema } from '../schemas/mark-ready-schema';
import { readSetupSnapshot } from '../lib/read-setup-snapshot';
import { buildSetupSummary } from '../lib/build-setup-summary';
import { lockDraft } from '../lib/lock-draft';

export const markHackathonReady = createMutation({
  name: 'hackathon.mark-ready',
  schema: markReadySchema,
  roles: ['OWNER', 'ADMIN'],
})(
  async ({ ctx, input }) => {
    const id = await lockDraft(ctx);
    const summary = buildSetupSummary(await readSetupSnapshot(ctx));
    if (summary.fingerprint !== input.fingerprint)
      throw new AppError(
        AppErrorCode.CONFLICT,
        'Setup changed. Refresh and check the latest readiness issues.',
      );
    if (summary.completeCount !== summary.totalCount)
      throw new AppError(
        AppErrorCode.INVALID_STATE,
        'Complete your checklist before marking ready.',
      );
    if (summary.blockers.length)
      throw new AppError(
        AppErrorCode.INVALID_STATE,
        'Fix the blocking setup issues before marking ready.',
      );
    if (summary.warnings.length && !input.acknowledgeWarnings)
      throw new AppError(
        AppErrorCode.VALIDATION_ERROR,
        'Confirm the listed warnings and incomplete setup first.',
      );
    await ctx.db.hackathon.update({ where: { id }, data: { status: 'READY' } });
    return { id, warnings: summary.warnings };
  },
  {
    audit: {
      entityType: 'Hackathon',
      getEntityId: ({ result }) => result.id,
      getBefore: () => ({ status: 'DRAFT' }),
      getAfter: ({ result }) => ({
        status: 'READY',
        acknowledgedWarnings: result.warnings,
      }),
    },
  },
);
