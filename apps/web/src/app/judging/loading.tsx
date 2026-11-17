import { Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <div className="min-h-svh" aria-busy="true" aria-label="Loading judging">
      <div className="mx-auto flex w-full max-w-[1440px] items-center justify-between gap-4 px-5 py-6 md:px-10">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-12 w-24 rounded-full" />
      </div>
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-5 pt-10 pb-12 sm:px-8 sm:pt-16">
        <div className="flex flex-col items-center gap-4">
          <Skeleton className="h-10 w-36" />
          <Skeleton className="h-6 w-60 max-w-full" />
          <Skeleton className="h-10 w-28 rounded-full" />
        </div>
        <Skeleton className="aspect-video w-full rounded-2xl" />
      </div>
    </div>
  );
}
