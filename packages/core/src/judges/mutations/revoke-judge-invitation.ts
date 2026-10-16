import { createMutation } from '../../shared/operations';
import { requireHackathonId } from '../../context';
import { AppError, AppErrorCode } from '../../shared/errors';
import { revokeJudgeInvitationSchema } from '../schemas/revoke-judge-invitation-schema';

export const revokeJudgeInvitation = createMutation({
  name: 'judges.invitation.revoke',
  schema: revokeJudgeInvitationSchema,
  roles: ['OWNER', 'ADMIN'],
})(
  async ({ ctx, input }) => {
    await ctx.db
      .$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(724181, 1)`;
    const updated = await ctx.db.invitation.updateMany({
      where: {
        id: input.invitationId,
        hackathonId: requireHackathonId(ctx),
        role: 'JUDGE',
        status: 'ACTIVE',
      },
      data: { status: 'REVOKED' },
    });
    if (!updated.count)
      throw new AppError(
        AppErrorCode.NOT_FOUND,
        'Invitation is no longer active. Refresh and try again.',
      );
    return { id: input.invitationId };
  },
  {
    audit: {
      entityType: 'Invitation',
      getEntityId: ({ result }) => result.id,
      getAfter: () => ({ status: 'REVOKED' }),
    },
  },
);
