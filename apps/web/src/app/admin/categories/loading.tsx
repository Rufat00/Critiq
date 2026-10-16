import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { CategoryPageLayout } from './components/category-page-layout';

export default function Loading() {
  return (
    <CategoryPageLayout>
      <div role="status" aria-label="Loading categories" aria-busy="true">
        <span className="sr-only">Loading categories…</span>
        <div aria-hidden="true" className="flex flex-col gap-6">
          <div className="flex gap-6 overflow-hidden border-b border-border pt-2 pb-3">
            {[1, 2, 3].map((tab) => (
              <div key={tab} className="flex shrink-0 items-center gap-1.5">
                <Skeleton className="size-4" />
                <Skeleton className={cn('h-5 w-12', tab === 2 && 'w-20')} />
                {tab !== 3 && <Skeleton className="h-5 w-6 rounded-full" />}
              </div>
            ))}
          </div>
          <section className="flex flex-col gap-5">
            <header className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-base font-semibold leading-snug tracking-tight">
                  Tracks
                </h2>
                <Skeleton className="h-8 w-28 rounded-lg" />
              </div>
            </header>
            <div className="flex flex-col gap-3">
              <div className="hidden grid-cols-[minmax(0,1fr)_100px_150px_70px_44px] items-center gap-4 px-4 pb-1 text-xs text-muted-foreground xl:grid">
                <span>Track</span>
                <span>Method</span>
                <span>Challenges</span>
                <span>Projects</span>
                <span />
              </div>
              {[1, 2, 3].map((row) => (
                <div
                  key={row}
                  className="grid min-w-0 grid-cols-[minmax(0,1fr)_44px] items-center gap-4 rounded-xl border border-border p-4 xl:grid-cols-[minmax(0,1fr)_100px_150px_70px_44px]"
                >
                  <div className="flex min-w-0 flex-col gap-2">
                    <Skeleton className="h-5 w-32 max-w-full" />
                    <Skeleton className="h-4 w-56 max-w-full" />
                  </div>
                  <div className="col-start-1 row-start-2 xl:col-auto xl:row-auto">
                    <Skeleton className="h-5 w-20 rounded-full" />
                  </div>
                  <div className="col-start-1 flex flex-wrap gap-1.5 xl:col-auto">
                    <Skeleton className="h-5 w-24 rounded-full" />
                    <Skeleton className="h-5 w-20 rounded-full" />
                  </div>
                  <div className="col-start-1 xl:col-auto">
                    <Skeleton className="h-5 w-16 xl:w-6" />
                  </div>
                  <div className="col-start-2 row-start-1 xl:col-auto xl:row-auto">
                    <Skeleton className="size-10 rounded-lg" />
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </CategoryPageLayout>
  );
}
