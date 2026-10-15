import { Skeleton } from '@/components/ui/skeleton';
import { Alert } from '@/components/ui/alert';

export function AdminHomeSkeleton() {
  return (
    <div className="flex flex-col gap-9" aria-busy="true">
      <span className="sr-only" role="status">
        Loading your judging workspace…
      </span>
      <div className="flex flex-col gap-9" aria-hidden="true">
        <div className="flex flex-col gap-3">
          <Skeleton className="h-20 w-4/5 sm:h-10" />
          <Skeleton className="h-5 w-2/3" />
        </div>
        <div className="grid items-start gap-8 xl:grid-cols-[minmax(0,1fr)_minmax(260px,320px)] xl:gap-10">
          <div className="flex min-w-0 flex-col gap-6">
            <div>
              <div className="mb-5 flex flex-col gap-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <Skeleton className="h-7 w-48" />
                  <Skeleton className="h-5 w-40" />
                </div>
                <Skeleton className="h-2 w-full rounded-full" />
              </div>
              <div className="flex flex-col">
                {[0, 1, 2, 3, 4].map((item) => (
                  <div
                    key={item}
                    className="flex flex-wrap items-center gap-4 border-b py-5 last:border-b-0"
                  >
                    <div className="flex min-w-0 flex-[1_1_15rem] items-start gap-4">
                      <Skeleton className="size-9 shrink-0 rounded-full" />
                      <div className="flex min-w-0 flex-1 flex-col gap-2">
                        <Skeleton className="h-5 w-36 max-w-full" />
                        <Skeleton className="h-4 w-full" />
                      </div>
                    </div>
                    <div className="ml-auto flex items-center justify-end gap-3 pl-13 sm:pl-0">
                      <Skeleton className="size-5" />
                      <Skeleton className="h-11 w-32 rounded-full md:h-9" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <Alert
              role="presentation"
              variant="soft"
              className="flex flex-col gap-5 rounded-2xl p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6"
            >
              <div className="flex min-w-0 flex-1 flex-col gap-3">
                <Skeleton className="h-5 w-4/5" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
              </div>
              <Skeleton className="h-11 w-32 shrink-0 self-end rounded-full sm:self-center md:h-9" />
            </Alert>
          </div>
          <div className="overflow-hidden rounded-2xl border">
            <Skeleton className="aspect-video w-full rounded-none" />
            <div className="flex flex-col gap-3 p-5 md:p-6">
              <Skeleton className="h-6 w-4/5" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="mt-2 h-5 w-40" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
