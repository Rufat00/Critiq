import { authMode } from '@critiq/auth';
import { cookies } from 'next/headers';
import { createSystemContext } from '@critiq/core/context';
import { getRegistrationAccess } from '@critiq/core/registration';
import { AppError } from '@critiq/core/errors';
import { AuthPageShell } from '@/components/auth/auth-page-shell';
import { RegistrationForm } from '@/components/auth/registration-form';
import { getAuthEntryState, redirectSignedInUser } from './queries';
import { LoginForm } from './components/login-form';
import { SetupWelcome } from './components/setup-welcome';

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ registered?: string }>;
}) {
  await redirectSignedInUser();
  const state = await getAuthEntryState();
  if (state.setupRequired) {
    const setupToken = (await cookies()).get('critiq-setup')?.value;
    if (setupToken) {
      let access;
      try {
        access = await getRegistrationAccess(
          createSystemContext({ service: 'registration', source: 'web-page' }),
          { setupToken },
        );
      } catch (error) {
        if (!(error instanceof AppError)) throw error;
      }
      if (access?.setup)
        return (
          <AuthPageShell name={state.hackathonName} showLogo>
            <RegistrationForm mode={authMode} setup />
          </AuthPageShell>
        );
    }
    return <SetupWelcome />;
  }
  const params = await searchParams;
  return (
    <AuthPageShell name={state.hackathonName}>
      <LoginForm mode={authMode} registered={params.registered === '1'} />
    </AuthPageShell>
  );
}

export async function generateMetadata() {
  const state = await getAuthEntryState();
  return {
    title: state.setupRequired
      ? 'Welcome to Critiq'
      : `Sign in · ${state.hackathonName}`,
  };
}
