import { redirect } from 'next/navigation';
import { getAuthContext } from '@/lib/auth/auth-context';
import { getAuthEntryState } from '../(auth)/queries';
import { SignOutButton } from '@/components/auth/sign-out-button';
import { SetupRequiredDialog } from './components/setup-required-dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ setup?: string }>;
}) {
  const session = await getAuthContext();
  if (!session) redirect('/');
  if (!session.isAdmin()) redirect('/judging');
  const state = await getAuthEntryState();
  const params = await searchParams;
  return (
    <main className="mx-auto max-w-5xl flex flex-col gap-12 px-5 py-8 sm:px-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <p className="text-lg font-medium">{state.hackathonName} Judging</p>
          <h1 className="text-3xl font-semibold tracking-tight">Admin</h1>
        </div>
        <SignOutButton />
      </header>
      {!state.configurationRequired && params.setup === 'complete' && (
        <Alert role="status">
          <AlertDescription>
            Setup complete. Your hackathon name is saved.
          </AlertDescription>
        </Alert>
      )}
      <section className="rounded-2xl bg-muted px-6 py-12 text-center">
        <h2 className="text-xl font-medium">Coming later</h2>
        <p className="mt-2 text-muted-foreground">
          Your hackathon administration workspace is coming later.
        </p>
      </section>
      {state.configurationRequired && (
        <SetupRequiredDialog isOwner={session.isOwner()} />
      )}
    </main>
  );
}
