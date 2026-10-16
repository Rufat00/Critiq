import { createHash, randomBytes } from 'node:crypto';
import {
  judgeQrInvitationMinutes,
  judgeQrInvitationMaxUses,
} from '@critiq/constants';
import { createMutation } from '../../shared/operations';
import { AppError, AppErrorCode } from '../../shared/errors';
import { lockJudgeSetup } from '../lib/lock-judge-setup';
import { requireJudgeTrack } from '../lib/require-judge-track';
import { createJudgeInvitationSchema } from '../schemas/create-judge-invitation-schema';

export const createJudgeInvitation = createMutation({
  name: 'judges.invite',
  schema: createJudgeInvitationSchema,
  roles: ['OWNER', 'ADMIN'],
})(
  async ({ ctx, input }) => {
    const hackathonId = await lockJudgeSetup(ctx);
    if (input.email && process.env.NO_EMAIL_LOWER_SECURITY_MODE === 'true')
      throw new AppError(
        AppErrorCode.INVALID_STATE,
        'Email invitations are disabled in no-email mode. Use a QR invitation.',
      );
    const category = await requireJudgeTrack(ctx, input.categoryId);
    if (
      input.email &&
      (await ctx.db.user.findUnique({
        where: { email: input.email },
        select: { id: true },
      }))
    )
      throw new AppError(
        AppErrorCode.CONFLICT,
        'This email already has an account. Invite a new judge using a different email.',
        { email: ['This email is already registered.'] },
      );
    // Rotate only the same recipient, or the track’s previous unbound QR invite.
    await ctx.db.invitation.updateMany({
      where: {
        hackathonId,
        role: 'JUDGE',
        email: input.email ?? null,
        status: 'ACTIVE',
        categories: { some: { categoryId: category.id } },
      },
      data: { status: 'REVOKED' },
    });
    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(
      Date.now() + (input.email ? 24 * 60 : judgeQrInvitationMinutes) * 60_000,
    );
    const maxUses = input.email ? 1 : judgeQrInvitationMaxUses;
    const invitation = await ctx.db.invitation.create({
      data: {
        hackathonId,
        createdById: ctx.actor.type === 'user' ? ctx.actor.userId : '',
        tokenHash: createHash('sha256').update(token).digest('hex'),
        role: 'JUDGE',
        email: input.email ?? null,
        maxUses,
        expiresAt,
        categories: { create: { categoryId: category.id } },
      },
      select: { id: true },
    });
    const hackathon = await ctx.db.hackathon.findUniqueOrThrow({
      where: { id: hackathonId },
      select: { name: true },
    });
    const inviter = await ctx.db.user.findUniqueOrThrow({
      where: { id: ctx.actor.type === 'user' ? ctx.actor.userId : '' },
      select: { name: true },
    });
    return {
      id: invitation.id,
      token,
      expiresAt: expiresAt.toISOString(),
      maxUses,
      email: input.email ?? null,
      categoryId: category.id,
      hackathonName: hackathon.name || 'Critiq',
      inviterName: inviter.name,
    };
  },
  {
    audit: {
      entityType: 'Invitation',
      getEntityId: ({ result }) => result.id,
      getAfter: ({ result }) => ({
        categoryId: result.categoryId,
        email: result.email,
        expiresAt: result.expiresAt,
        maxUses: result.maxUses,
      }),
    },
  },
);
