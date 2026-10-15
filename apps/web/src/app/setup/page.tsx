import { redirect } from 'next/navigation';
import { getAuthContext } from '@/lib/auth/auth-context';
import { getAuthEntryState } from '../(auth)/queries';
import { SignOutButton } from '@/components/auth/sign-out-button';
import { SetupForm } from './components/setup-form';
import { Logo } from '@/components/logo';
export default async function Page() {
  const session = await getAuthContext();
  if (!session) redirect('/');
  if (!session.isOwner()) redirect(session.isJudge() ? '/judging' : '/admin');
  const state = await getAuthEntryState();
  if (!state.configurationRequired) redirect('/admin');
  return (
    <main className="mx-auto max-w-6xl flex flex-col gap-12 px-5 py-8 sm:px-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <Logo variant="wordmark" />
        <SignOutButton />
      </header>
      <section className="py-6 sm:py-16">
        <SetupForm />
      </section>
    </main>
  );
}
