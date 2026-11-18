import { redirect } from 'next/navigation';
import { getAuthContext } from '@/lib/auth/auth-context';
import { UserMenu } from '@/components/auth/user-menu';
import { getJudgeWorkspace } from './queries';
import { JudgeWorkspaceScreen } from './components/judge-workspace-screen';
export default async function Page() {
  const session = await getAuthContext();
  if (!session) redirect('/');
  if (!session.isJudge()) redirect('/admin');
  const initial = await getJudgeWorkspace();
  return (
    <div className="min-h-svh">
      <header className="mx-auto flex w-full max-w-2xl items-center justify-between gap-4 px-5 py-5">
        <p className="min-w-0 font-medium break-words">{initial.event.name}</p>
        <UserMenu userName={session.user.name} />
      </header>
      <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-5 pt-4 pb-[calc(2rem+env(safe-area-inset-bottom))]">
        <JudgeWorkspaceScreen initial={initial} />
      </main>
    </div>
  );
}
