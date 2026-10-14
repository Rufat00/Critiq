import { db } from '@critiq/db';
import { prismaAdapter } from '@better-auth/prisma-adapter';
import { betterAuth } from 'better-auth/minimal';
import { APIError, createAuthMiddleware } from 'better-auth/api';
import { emailOTP, username } from 'better-auth/plugins';

// Select from deployment configuration, never from delivery success or failure.
export const authMode = process.env.SMTP_HOST?.trim() ? 'otp' : 'password';

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL ?? 'http://localhost:3000',
  database: prismaAdapter(db, { provider: 'postgresql', transaction: true }),
  emailAndPassword: {
    enabled: authMode === 'password',
    disableSignUp: true,
    minPasswordLength: 12,
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
        (authMode === 'otp' && context.path === '/sign-in/username')
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
      async sendVerificationOTP({ email, otp, type }) {
        // Temporary delivery stub. No SMTP connection or mailing service.
        console.log('[Critiq auth OTP]', { email, otp, type });
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
