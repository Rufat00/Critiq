import { createHash } from 'node:crypto';
import type { AppContext } from '../../context';
import { AppError, AppErrorCode } from '../../shared/errors';

export type RegistrationAccessInput = {
  setupToken?: string;
  invitationToken?: string;
  email?: string;
};

export async function requireRegistrationAccess(
  ctx: AppContext,
  input: RegistrationAccessInput,
) {
  if (ctx.actor.type !== 'system' || ctx.actor.service !== 'registration') {
    throw new AppError(AppErrorCode.FORBIDDEN, 'Registration is unavailable.');
  }
  const hash = (value: string) =>
    createHash('sha256').update(value).digest('hex');
  const installation = await ctx.db.installation.findUnique({
    where: { id: 1 },
  });
  if (!installation?.claimedAt) {
    const grant =
      input.setupToken &&
      (await ctx.db.verification.findFirst({
        where: {
          identifier: 'setup-grant',
          value: hash(input.setupToken),
          expiresAt: { gt: new Date() },
        },
      }));
    if (!grant)
      throw new AppError(
        AppErrorCode.FORBIDDEN,
        'Enter the setup passcode before creating the owner account.',
      );
    return { kind: 'owner' as const, grant };
  }
  if (input.setupToken)
    throw new AppError(
      AppErrorCode.CONFLICT,
      'An owner has already registered. Please sign in.',
    );
  if (!input.invitationToken)
    throw new AppError(
      AppErrorCode.FORBIDDEN,
      'Registration is invitation only. Ask the organizer for an invitation.',
    );
  const [hackathon, invitation] = await Promise.all([
    ctx.db.hackathon.findFirst({ select: { id: true } }),
    ctx.db.invitation.findUnique({
      where: { tokenHash: hash(input.invitationToken) },
      include: {
        categories: {
          include: { category: { select: { hackathonId: true } } },
        },
      },
    }),
  ]);
  if (
    !hackathon ||
    !invitation ||
    invitation.role === 'OWNER' ||
    invitation.hackathonId !== hackathon.id ||
    invitation.status !== 'ACTIVE' ||
    invitation.expiresAt <= new Date() ||
    invitation.usedCount >= invitation.maxUses ||
    (input.email &&
      invitation.email &&
      invitation.email.toLowerCase() !== input.email.toLowerCase()) ||
    invitation.categories.some(
      (item) => item.category.hackathonId !== hackathon.id,
    )
  ) {
    throw new AppError(
      AppErrorCode.INVALID_STATE,
      'This invitation is unavailable, expired, or does not match your email. Ask the organizer for a new invitation.',
    );
  }
  return { kind: 'invitation' as const, invitation };
}
