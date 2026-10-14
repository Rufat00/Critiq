import { authMode } from '@critiq/auth';
import { createSystemContext } from '@critiq/core/context';
import { getRegistrationAccess } from '@critiq/core/registration';
import { AppError } from '@critiq/core/errors';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { AuthPageShell } from '@/components/auth/auth-page-shell';
import { getAuthEntryState, redirectSignedInUser } from '../queries';
import { RegistrationForm } from './components/registration-form';

export default async function RegistrationPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  await redirectSignedInUser();
  const state = await getAuthEntryState();
  const { token } = await searchParams;
  let access;
  try {
    access = await getRegistrationAccess(
      createSystemContext({ service: 'registration', source: 'web-page' }),
      {
        setupToken: (await cookies()).get('critiq-setup')?.value,
        invitationToken: token,
      },
    );
  } catch (error) {
    if (!(error instanceof AppError)) throw error;
    if (state.setupRequired || !token) redirect('/');
    return (
      <AuthPageShell name={state.hackathonName}>
        <div className="flex flex-col gap-6 text-center">
          <h1 className="text-3xl font-semibold">Invitation unavailable</h1>
          <p className="text-muted-foreground">{error.message}</p>
          <Link className="text-primary underline" href="/">
            Back to sign in
          </Link>
        </div>
      </AuthPageShell>
    );
  }
  return (
    <AuthPageShell name={state.hackathonName} showLogo={access.setup}>
      <RegistrationForm
        mode={authMode}
        setup={access.setup}
        invitedEmail={access.email}
        invitationToken={token}
      />
    </AuthPageShell>
  );
}

export async function generateMetadata() {
  const state = await getAuthEntryState();
  return {
    title: state.setupRequired
      ? 'Create your owner account · Critiq'
      : `Create an account · ${state.hackathonName}`,
  };
}
