import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { createMutation } from '../../shared/operations';
import { AppError, AppErrorCode } from '../../shared/errors';

export const beginSetup = createMutation({
  name: 'installation.begin-setup',
  schema: z.object({
    passcode: z.string().min(1, 'Enter the setup passcode.').max(256),
  }),
  allowSystem: true,
})(async ({ ctx, input }) => {
  if (!('$transaction' in ctx.db))
    throw new AppError(AppErrorCode.INVALID_STATE, 'Setup is unavailable.');
  const result = await ctx.db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(724181, 1)`;
    const installation = await tx.installation.findUnique({ where: { id: 1 } });
    if (installation?.claimedAt)
      throw new AppError(
        AppErrorCode.INVALID_STATE,
        'Setup has already been started. Please sign in.',
      );
    const configured = process.env.SETUP_PASSCODE?.trim();
    if (!configured || configured.length < 12)
      throw new AppError(
        AppErrorCode.INVALID_STATE,
        'Ask the installation administrator to configure a setup passcode of at least 12 characters.',
      );
    const now = new Date();
    const attempts = await tx.verification.findFirst({
      where: { identifier: 'setup-attempts', expiresAt: { gt: now } },
    });
    if (attempts && Number(attempts.value) >= 5)
      return { error: 'Too many attempts. Try again in a minute.' };
    if (attempts)
      await tx.verification.update({
        where: { id: attempts.id },
        data: { value: String(Number(attempts.value) + 1) },
      });
    else
      await tx.verification.create({
        data: {
          id: randomBytes(16).toString('hex'),
          identifier: 'setup-attempts',
          value: '1',
          expiresAt: new Date(Date.now() + 60_000),
        },
      });
    const digest = (value: string) =>
      createHash('sha256').update(value).digest();
    if (!timingSafeEqual(digest(input.passcode), digest(configured)))
      return { error: 'The setup passcode is incorrect.' };
    const token = randomBytes(32).toString('hex');
    await tx.verification.create({
      data: {
        id: randomBytes(16).toString('hex'),
        identifier: 'setup-grant',
        value: digest(token).toString('hex'),
        expiresAt: new Date(Date.now() + 20 * 60_000),
      },
    });
    return { token };
  });
  if ('error' in result)
    throw new AppError(AppErrorCode.FORBIDDEN, result.error!);
  return { token: result.token! };
});
