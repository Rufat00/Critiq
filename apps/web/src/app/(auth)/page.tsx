import { authMode } from '@critiq/auth';
import { AuthPageShell } from '@/components/auth/auth-page-shell';
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
  if (state.setupRequired) return <SetupWelcome />;
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
