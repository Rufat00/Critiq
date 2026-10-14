import { createSystemContext } from '@critiq/core/context';
import { getEntryState } from '@critiq/core/registration';
import { createMailProvider } from '@critiq/mail';
import { db } from '@critiq/db';
import { prismaAdapter } from '@better-auth/prisma-adapter';
import { betterAuth } from 'better-auth/minimal';
import { APIError, createAuthMiddleware } from 'better-auth/api';
import { emailOTP, username } from 'better-auth/plugins';

if (
  process.env.NO_EMAIL_LOWER_SECURITY_MODE &&
  !['true', 'false'].includes(process.env.NO_EMAIL_LOWER_SECURITY_MODE)
) {
  throw new Error('NO_EMAIL_LOWER_SECURITY_MODE must be true or false.');
}

const authSecret = process.env.AUTH_SECRET?.trim();
if (!authSecret || authSecret.length < 32) {
  throw new Error(
    'AUTH_SECRET must be set to a random secret of at least 32 characters.',
  );
}

// Select from deployment configuration, never from delivery success or failure.
export const authMode =
  process.env.NO_EMAIL_LOWER_SECURITY_MODE === 'true' ? 'password' : 'otp';

export const auth = betterAuth({
  baseURL: process.env.APP_URL?.trim() || 'http://localhost:3000',
  secret: authSecret,
  database: prismaAdapter(db, { provider: 'postgresql', transaction: true }),
  emailAndPassword: {
    enabled: authMode === 'password',
    disableSignUp: true,
    minPasswordLength: 8,
    revokeSessionsOnPasswordReset: true,
  },
  user: {
    additionalFields: {
      role: {
        type: ['OWNER', 'ADMIN', 'JUDGE'],
        required: false,
        defaultValue: 'JUDGE',
        input: false,
      },
      isActive: {
        type: 'boolean',
        required: false,
        defaultValue: true,
        input: false,
      },
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30,
    updateAge: 60 * 60 * 24,
  },
  disabledPaths: ['/is-username-available'],
  hooks: {
    before: createAuthMiddleware(async (context) => {
      if (
        (authMode === 'password' &&
          (context.path.startsWith('/email-otp/') ||
            context.path === '/sign-in/email-otp')) ||
        (authMode === 'otp' &&
          (context.path === '/sign-in/username' ||
            context.path === '/sign-in/email'))
      ) {
        throw new APIError('FORBIDDEN', {
          message: 'This sign-in method is not enabled.',
        });
      }
    }),
  },
  databaseHooks: {
    session: {
      create: {
        before: async (session) => {
          const user = await db.user.findUnique({
            where: { id: session.userId },
            select: { isActive: true },
          });
          if (!user?.isActive) {
            throw new APIError('FORBIDDEN', {
              message: 'This account is unavailable.',
            });
          }
        },
      },
    },
  },
  plugins: [
    username({ displayUsername: false }),
    emailOTP({
      disableSignUp: true,
      otpLength: 6,
      expiresIn: 10 * 60,
      allowedAttempts: 5,
      storeOTP: 'hashed',
      resendStrategy: 'rotate',
      rateLimit: { window: 60, max: 3 },
      async sendVerificationOTP({ email, otp }) {
        const { hackathonName } = await getEntryState(
          createSystemContext({ service: 'auth-email', source: 'worker' }),
          {},
        );
        await createMailProvider(process.env, { hackathonName }).sendOTP({
          to: email,
          code: otp,
          expiresInMinutes: 10,
        });
      },
    }),
  ],
});

export type AuthSession = typeof auth.$Infer.Session;
export type AuthUser = AuthSession['user'];

export async function getAuthSession(
  headers: Headers,
): Promise<AuthSession | null> {
  const session = await auth.api.getSession({ headers });
  if (!session) return null;

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { isActive: true, role: true },
  });
  if (!user?.isActive) return null;

  return {
    ...session,
    user: { ...session.user, role: user.role },
  };
}
