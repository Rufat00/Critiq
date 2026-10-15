import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export function WorkspacePreview({ name }: { name: string }) {
  const workspaceName = name.trim() ? `${name.trim()} Judging` : 'Judging';

  return (
    <figure
      className="w-full min-w-0 max-w-lg justify-self-center overflow-hidden rounded-2xl border bg-muted p-3"
      aria-label="Live workspace preview"
    >
      <div className="grid min-h-80 grid-cols-[minmax(0,0.9fr)_minmax(0,1.4fr)] overflow-hidden rounded-xl border bg-background shadow-sm">
        <div className="flex min-w-0 flex-col gap-4 border-r bg-sidebar px-3 py-4 sm:px-4">
          <p
            className="truncate text-sm font-semibold leading-snug text-foreground"
            title={workspaceName}
          >
            {workspaceName}
          </p>
          <Separator />
          <div className="flex flex-col gap-4" aria-hidden="true">
            {[0, 1, 2, 3, 4].map((item) => (
              <div key={item} className="flex items-center gap-2">
                <Skeleton className="size-4 shrink-0" />
                <Skeleton
                  className={cn('h-2 w-3/4', item % 2 !== 0 && 'w-1/2')}
                />
              </div>
            ))}
          </div>
          <div
            className="mt-auto flex items-center gap-2 pt-4"
            aria-hidden="true"
          >
            <Skeleton className="size-6 shrink-0 rounded-full" />
            <div className="flex flex-1 flex-col gap-2">
              <Skeleton className="h-2 w-3/4" />
              <Skeleton className="h-1.5 w-1/2" />
            </div>
          </div>
        </div>
        <div
          className="flex min-w-0 flex-col gap-4 px-3 py-4 sm:px-4"
          aria-hidden="true"
        >
          <div className="flex items-center justify-between gap-3">
            <Skeleton className="h-3 w-1/2" />
            <Skeleton className="size-5 shrink-0 rounded-full" />
          </div>
          <Separator />
          <div className="flex flex-col gap-2">
            <Skeleton className="h-3 w-2/3" />
            <Skeleton className="h-2 w-5/6" />
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[0, 1, 2].map((item) => (
              <div
                key={item}
                className="flex min-w-0 flex-col gap-3 rounded-lg border p-2"
              >
                <Skeleton className="h-1.5 w-full" />
                <Skeleton className="h-4 w-2/3" />
              </div>
            ))}
          </div>
          <div className="flex flex-col gap-3 rounded-lg border p-3">
            <div className="flex items-center justify-between gap-2">
              <Skeleton className="h-2 w-1/2" />
              <Skeleton className="h-4 w-8 rounded-full" />
            </div>
            <Separator />
            {[0, 1, 2].map((item) => (
              <div key={item} className="flex items-center gap-2">
                <Skeleton className="size-5 shrink-0 rounded-full" />
                <div className="flex flex-1 flex-col gap-1.5">
                  <Skeleton className="h-1.5 w-3/4" />
                  <Skeleton className="h-1.5 w-1/2" />
                </div>
                <Skeleton className="h-2 w-5" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </figure>
  );
}
