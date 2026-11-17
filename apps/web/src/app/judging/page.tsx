import { redirect } from 'next/navigation';
import { getAuthContext } from '@/lib/auth/auth-context';
import { getAuthEntryState } from '../(auth)/queries';
import { UserMenu } from '@/components/auth/user-menu';
import { VideoCard } from '@/components/video-card';
import { videos } from '@/lib/constants/videos';
import { RefreshJudgingButton } from './components/refresh-judging-button';
export default async function Page() {
  const session = await getAuthContext();
  if (!session) redirect('/');
  if (!session.isJudge()) redirect('/admin');
  const state = await getAuthEntryState();
  const waiting =
    state.hackathonStatus === 'DRAFT' ||
    state.hackathonStatus === 'READY' ||
    state.hackathonStatus === null;
  return (
    <div className="min-h-svh">
      <header className="mx-auto flex w-full max-w-[1440px] items-center justify-between gap-4 px-5 py-6 md:px-10">
        <p className="min-w-0 text-lg font-medium break-words">
          {state.hackathonName}
        </p>
        <div className="shrink-0">
          <UserMenu userName={session.user.name} />
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-5 pt-10 pb-12 sm:px-8 sm:pt-16">
        <div className="flex flex-col items-center gap-4 text-center">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Judging
          </h1>
          <p className="text-muted-foreground">
            {waiting
              ? 'Judging hasn’t started yet.'
              : 'Your judging workspace is coming soon.'}
          </p>
          <RefreshJudgingButton />
        </div>
        <VideoCard video={videos.judging} />
      </main>
    </div>
  );
}
