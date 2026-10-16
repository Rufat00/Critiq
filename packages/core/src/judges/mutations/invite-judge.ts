import { createMailProvider } from '@critiq/mail';
import { createMutation } from '../../shared/operations';
import { AppError, AppErrorCode } from '../../shared/errors';
import { createJudgeInvitationSchema } from '../schemas/create-judge-invitation-schema';
import { createJudgeInvitation } from './create-judge-invitation';
import { revokeJudgeInvitation } from './revoke-judge-invitation';

export const inviteJudge = createMutation({
  name: 'judges.invitation.send',
  schema: createJudgeInvitationSchema,
  roles: ['OWNER', 'ADMIN'],
})(async ({ ctx, input }) => {
  if (!('$transaction' in ctx.db))
    throw new AppError(
      AppErrorCode.INVALID_STATE,
      'Invitations must be sent outside a database transaction.',
    );
  const base = new URL(process.env.APP_URL?.trim() || 'http://localhost:3000');
  if (
    base.username ||
    base.password ||
    (process.env.NODE_ENV === 'production'
      ? base.protocol !== 'https:'
      : !['http:', 'https:'].includes(base.protocol))
  )
    throw new AppError(
      AppErrorCode.INVALID_STATE,
      'Configure a secure APP_URL before inviting judges.',
    );
  const mail = input.email ? createMailProvider(process.env) : null;
  const invitation = await createJudgeInvitation(ctx, input);
  const url = new URL('/invite', base);
  // Fragments are not sent in HTTP requests, access logs, or referrer headers.
  url.hash = new URLSearchParams({ token: invitation.token }).toString();
  if (input.email && mail) {
    try {
      const delivery = await mail.sendInvite({
        to: input.email,
        inviterName: invitation.inviterName,
        hackathonName: invitation.hackathonName,
        inviteUrl: url.href,
        expiresAt: new Date(invitation.expiresAt),
      });
      if (delivery.status !== 'accepted') throw new Error('Email disabled');
    } catch {
      await revokeJudgeInvitation(ctx, { invitationId: invitation.id });
      throw new AppError(
        AppErrorCode.INVALID_STATE,
        'The email could not be sent. This invitation was revoked. Check email settings and try again.',
      );
    }
  }
  return {
    id: invitation.id,
    expiresAt: invitation.expiresAt,
    url: input.email ? null : url.href,
    email: input.email ?? null,
  };
});
