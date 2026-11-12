import { Skeleton } from '@/components/ui/skeleton';
import { AdminFrame } from './admin-frame';
import { AdminHomeSkeleton } from '../(Home)/components/admin-home-skeleton';

export function AdminShellSkeleton() {
  return (
    <AdminFrame
      navigation={
        <header
          aria-label="Loading navigation"
          aria-busy="true"
          className="mx-auto grid w-full max-w-[1440px] grid-cols-[1fr_auto] items-center gap-x-6 gap-y-5 px-5 pt-6 pb-2 md:px-10 xl:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] xl:py-6"
        >
          <div className="flex min-w-0 flex-col items-start gap-1.5">
            <Skeleton className="h-7 w-24 md:h-8" />
            <Skeleton className="hidden h-5 w-32 md:block" />
          </div>
          <div
            aria-hidden="true"
            className="col-span-2 row-start-2 hidden min-w-0 overflow-hidden py-1 md:block xl:col-span-1 xl:col-start-2 xl:row-start-1"
          >
            <div className="mx-auto flex w-max gap-1 rounded-full bg-muted p-1">
              {[0, 1, 2, 3, 4, 5].map((item) => (
                <Skeleton key={item} className="h-10 w-24 rounded-full" />
              ))}
            </div>
          </div>
          <Skeleton className="col-start-2 row-start-1 h-12 w-20 rounded-full justify-self-end sm:w-44 xl:col-start-3" />
          <div
            aria-hidden="true"
            className="fixed inset-x-0 bottom-0 z-30 flex border-t bg-background px-2 pb-[env(safe-area-inset-bottom)] md:hidden"
          >
            {[0, 1, 2, 3, 4, 5].map((item) => (
              <div
                key={item}
                className="flex min-h-16 flex-1 flex-col items-center justify-center gap-1"
              >
                <Skeleton className="size-6" />
                <Skeleton className="h-3 w-10" />
              </div>
            ))}
          </div>
        </header>
      }
    >
      <AdminHomeSkeleton />
    </AdminFrame>
  );
}
