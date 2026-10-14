import { Skeleton } from '@/components/ui/skeleton';
export default function Loading() {
  return (
    <main
      className="mx-auto flex min-h-svh max-w-md flex-col gap-8 px-5 pt-[20svh]"
      aria-busy="true"
      aria-label="Loading sign-in"
    >
      <Skeleton className="mx-auto h-8 w-40" />
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-12 w-full rounded-full" />
    </main>
  );
}
