import { redirect } from 'next/navigation';
import { getAuthContext } from '@/lib/auth/auth-context';
import { getAuthEntryState } from '../(auth)/queries';
import { SignOutButton } from '@/components/auth/sign-out-button';
export default async function Page() {
  const session = await getAuthContext();
  if (!session) redirect('/');
  if (!session.isOwner()) redirect(session.isJudge() ? '/judging' : '/admin');
  const state = await getAuthEntryState();
  return (
    <main className="mx-auto max-w-5xl flex flex-col gap-12 px-5 py-8 sm:px-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <p className="text-lg font-medium">{state.hackathonName}</p>
          <h1 className="text-3xl font-semibold tracking-tight">
            Hackathon setup
          </h1>
        </div>
        <SignOutButton />
      </header>
      <section className="rounded-2xl bg-muted px-6 py-12 text-center">
        <h2 className="text-xl font-medium">Coming later</h2>
        <p className="mt-2 text-muted-foreground">
          Setup sections are coming later.
        </p>
      </section>
    </main>
  );
}
