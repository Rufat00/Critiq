'use server';

import {
  authMode,
  hashPassword,
  requestRegistrationCode,
  verifyRegistrationCode,
  signInRegisteredAccount,
  RegistrationVerificationError,
} from '@critiq/auth';
import {
  beginSetup,
  registerAccount,
  getRegistrationAccess,
  validateRegistrationInput,
  type RegisterAccountInput,
} from '@critiq/core/registration';
import { createSystemContext } from '@critiq/core/context';
import {
  AppError,
  AppErrorCode,
  normalizePrismaError,
} from '@critiq/core/errors';
import { parseSetCookieHeader } from 'better-auth/cookies';
import { cookies, headers } from 'next/headers';
import { getAuthContext } from '@/lib/auth/auth-context';
import type { ActionResult } from '@/lib/actions/create-safe-action';

async function registrationContext() {
  const requestHeaders = await headers();
  return createSystemContext({
    service: 'registration',
    source: 'web-action',
    request: {
      requestId: requestHeaders.get('x-request-id') ?? undefined,
      ipAddress: null,
      userAgent: requestHeaders.get('user-agent'),
    },
  });
}
function failure(error: unknown): ActionResult<never> {
  const expected =
    error instanceof AppError ? error : normalizePrismaError(error);
  if (expected)
    return {
      ok: false,
      error: {
        code: expected.code,
        message: expected.message,
        fieldErrors: expected.fieldErrors,
      },
    };
  if (error instanceof RegistrationVerificationError)
    return {
      ok: false,
      error: { code: AppErrorCode.VALIDATION_ERROR, message: error.message },
    };
  console.error('Registration action failed.', {
    errorType: error instanceof Error ? error.name : typeof error,
  });
  return {
    ok: false,
    error: {
      code: AppErrorCode.INTERNAL_SERVER_ERROR,
      message: 'We could not complete this step. Please try again.',
    },
  };
}
const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 20 * 60,
};

export async function beginSetupAction(
  passcode: string,
): Promise<ActionResult<null>> {
  try {
    const result = await beginSetup(await registrationContext(), { passcode });
    (await cookies()).set('critiq-setup', result.token, cookieOptions);
    return { ok: true, data: null };
  } catch (error) {
    return failure(error);
  }
}

export async function requestRegistrationCodeAction(
  input: RegisterAccountInput,
): Promise<ActionResult<null>> {
  try {
    const ctx = await registrationContext();
    await validateRegistrationInput(ctx, input);
    await getRegistrationAccess(ctx, {
      setupToken: (await cookies()).get('critiq-setup')?.value,
      invitationToken: input.invitationToken,
      email: input.email.trim().toLowerCase(),
    });
    await requestRegistrationCode(input.email.trim().toLowerCase());
    return { ok: true, data: null };
  } catch (error) {
    return failure(error);
  }
}

export async function registerAccountAction(
  input: RegisterAccountInput,
  code?: string,
): Promise<ActionResult<{ destination: string }>> {
  try {
    const ctx = await registrationContext();
    await validateRegistrationInput(ctx, input);
    const jar = await cookies();
    const email = input.email.trim().toLowerCase();
    await getRegistrationAccess(ctx, {
      setupToken: jar.get('critiq-setup')?.value,
      invitationToken: input.invitationToken,
      email,
    });
    let emailProofToken: string | undefined;
    try {
      const proof = JSON.parse(
        jar.get('critiq-registration-proof')?.value || 'null',
      );
      if (proof?.email === email && typeof proof.token === 'string')
        emailProofToken = proof.token;
    } catch {
      /* An invalid cookie is treated as unverified. */
    }
    if (authMode === 'otp' && code && !emailProofToken) {
      emailProofToken = await verifyRegistrationCode(email, code);
      jar.set(
        'critiq-registration-proof',
        JSON.stringify({ email, token: emailProofToken }),
        {
          ...cookieOptions,
          maxAge: 10 * 60,
        },
      );
    }
    const result = await registerAccount(ctx, input, {
      mode: authMode,
      passwordHash:
        authMode === 'password'
          ? await hashPassword(input.password)
          : undefined,
      emailProofToken,
      setupToken: jar.get('critiq-setup')?.value,
    });
    jar.delete('critiq-setup');
    jar.delete('critiq-registration-proof');
    try {
      const signIn = await signInRegisteredAccount(
        result.email,
        input.password,
        await headers(),
      );
      const sessionCookies = signIn.headers.get('set-cookie');
      if (!sessionCookies) throw new Error('No session cookie was created.');
      for (const [name, attributes] of parseSetCookieHeader(sessionCookies)) {
        jar.set(name, attributes.value, {
          httpOnly: attributes.httponly,
          secure: attributes.secure,
          sameSite: attributes.samesite as
            | 'lax'
            | 'strict'
            | 'none'
            | undefined,
          path: attributes.path,
          maxAge: attributes['max-age'],
          expires: attributes.expires,
        });
      }
      return { ok: true, data: { destination: result.destination } };
    } catch (error) {
      console.error('Post-registration sign-in failed.', {
        errorType: error instanceof Error ? error.name : typeof error,
      });
      // Account creation committed; sign-in can be retried without registering twice.
      return { ok: true, data: { destination: '/?registered=1' } };
    }
  } catch (error) {
    return failure(error);
  }
}

export async function getSignInDestinationAction(): Promise<
  ActionResult<{ destination: string }>
> {
  try {
    const session = await getAuthContext();
    if (!session)
      throw new AppError(AppErrorCode.UNAUTHORIZED, 'Please sign in again.');
    return {
      ok: true,
      data: { destination: session.isJudge() ? '/judging' : '/admin' },
    };
  } catch (error) {
    return failure(error);
  }
}
