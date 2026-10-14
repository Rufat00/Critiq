import { createHash, randomUUID } from 'node:crypto';
import type { AppContext } from '../../context';
import { createMutation } from '../../shared/operations';
import { AppError, AppErrorCode } from '../../shared/errors';
import {
  registerAccountSchema,
  type RegisterAccountInput,
} from '../schemas/register-account-schema';

import { requireRegistrationAccess } from '../lib/require-registration-access';

// These values come from server auth infrastructure, never from form fields.
export type RegistrationCredentials = {
  mode: 'otp' | 'password';
  passwordHash?: string;
  emailProofToken?: string;
  setupToken?: string;
};
export async function registerAccount(
  ctx: AppContext,
  input: RegisterAccountInput,
  credentials: RegistrationCredentials,
) {
  return createMutation({
    name: 'registration.create',
    schema: registerAccountSchema,
    allowSystem: true,
  })(async ({ ctx, input }) => {
    if (
      ctx.actor.type !== 'system' ||
      ctx.actor.service !== 'registration' ||
      !('$transaction' in ctx.db)
    )
      throw new AppError(
        AppErrorCode.FORBIDDEN,
        'Registration is unavailable.',
      );
    return ctx.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(724181, 1)`;
      await tx.installation.upsert({
        where: { id: 1 },
        create: { id: 1 },
        update: {},
      });
      const access = await requireRegistrationAccess(
        { ...ctx, db: tx },
        {
          setupToken: credentials.setupToken,
          invitationToken: input.invitationToken,
          email: input.email,
        },
      );
      const owner = access.kind === 'owner';
      if (access.kind === 'owner')
        await tx.verification.delete({ where: { id: access.grant.id } });
      const hash = (token: string) =>
        createHash('sha256').update(token).digest('hex');
      if (credentials.mode === 'otp') {
        const proof =
          credentials.emailProofToken &&
          (await tx.verification.findFirst({
            where: {
              identifier: `registration-proof:${input.email}`,
              value: hash(credentials.emailProofToken),
              expiresAt: { gt: new Date() },
            },
          }));
        if (!proof)
          throw new AppError(
            AppErrorCode.FORBIDDEN,
            'Verify your email before creating your account.',
          );
        await tx.verification.delete({ where: { id: proof.id } });
      } else if (!credentials.passwordHash)
        throw new AppError(
          AppErrorCode.INVALID_STATE,
          'Password registration is unavailable.',
        );
      const hackathon =
        (await tx.hackathon.findFirst()) ??
        (await tx.hackathon.create({
          data: {
            categories: { create: { kind: 'OVERALL', name: 'Overall' } },
          },
        }));
      const invitation =
        access.kind === 'invitation' ? access.invitation : null;
      if (
        await tx.user.findUnique({
          where: { email: input.email },
          select: { id: true },
        })
      ) {
        throw new AppError(
          AppErrorCode.CONFLICT,
          'An account with this email already exists. Please sign in.',
          { email: ['This email is already registered.'] },
        );
      }
      const userId = randomUUID();
      const user = await tx.user.create({
        data: {
          id: userId,
          name: input.name.replace(/\s+/gu, ' '),
          email: input.email,
          emailVerified: credentials.mode === 'otp',
          role: access.kind === 'owner' ? 'OWNER' : access.invitation.role,
          ...(credentials.mode === 'password'
            ? {
                accounts: {
                  create: {
                    id: randomUUID(),
                    accountId: userId,
                    providerId: 'credential',
                    password: credentials.passwordHash,
                  },
                },
              }
            : {}),
        },
      });
      if (owner)
        await tx.installation.update({
          where: { id: 1 },
          data: { claimedAt: new Date() },
        });
      if (!owner && invitation) {
        const consumed = await tx.invitation.updateMany({
          where: {
            id: invitation.id,
            status: 'ACTIVE',
            expiresAt: { gt: new Date() },
            usedCount: invitation.usedCount,
          },
          data: { usedCount: { increment: 1 }, redeemedById: user.id },
        });
        if (consumed.count !== 1)
          throw new AppError(
            AppErrorCode.CONFLICT,
            'This invitation has already been used.',
          );
        await tx.invitationRedemption.create({
          data: { invitationId: invitation.id, userId: user.id },
        });
        if (user.role === 'JUDGE' && invitation.categories.length)
          await tx.judgeCategory.createMany({
            data: invitation.categories.map(({ categoryId }) => ({
              userId: user.id,
              categoryId,
            })),
          });
      }
      await tx.auditLog.create({
        data: {
          hackathonId: hackathon.id,
          actorId: user.id,
          action: owner ? 'installation.claim' : 'registration.create',
          entityType: 'User',
          entityId: user.id,
          metadata: {
            role: user.role,
            agreements: [
              'participation-placeholder-v1',
              'privacy-placeholder-v1',
            ],
            invitationId: invitation?.id ?? null,
          },
          ipAddress: ctx.request.ipAddress,
        },
      });
      return {
        email: user.email,
        destination: owner
          ? '/setup'
          : user.role === 'JUDGE'
            ? '/judging'
            : '/admin',
      };
    });
  })(ctx, input);
}
