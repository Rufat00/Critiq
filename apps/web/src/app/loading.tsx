import { AppPage } from '@/components/app-page';
import { Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <AppPage>
      <div
        role="status"
        aria-label="Opening your workspace"
        className="flex flex-col gap-6"
      >
        <span className="sr-only">Opening your workspace…</span>
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-80 w-full" />
      </div>
    </AppPage>
  );
}
