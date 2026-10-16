'use server';
import { cookies } from 'next/headers';
import { createSystemContext } from '@critiq/core/context';
import { getRegistrationAccess } from '@critiq/core/registration';
import { AppError } from '@critiq/core/errors';

export async function acceptInvitationAction(fragmentToken?: string) {
  const jar = await cookies();
  const token = fragmentToken ?? jar.get('critiq-invitation')?.value;
  if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{43}$/u.test(token))
    return {
      ok: false as const,
      message:
        'This invitation is unavailable. Ask the organizer for a new invitation.',
    };
  try {
    const access = await getRegistrationAccess(
      createSystemContext({ service: 'registration', source: 'web-action' }),
      { invitationToken: token },
    );
    jar.set('critiq-invitation', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 24 * 60 * 60,
    });
    jar.delete('critiq-setup');
    return { ok: true as const, email: access.email };
  } catch (error) {
    if (!(error instanceof AppError))
      console.error('Invitation validation failed.', {
        errorType: error instanceof Error ? error.name : typeof error,
      });
    return {
      ok: false as const,
      message:
        error instanceof AppError
          ? error.message
          : 'We could not check this invitation. Please try again.',
    };
  }
}
