import { AdminHeading } from '@/components/admin-heading';
import { Skeleton } from '@/components/ui/skeleton';
export default function Loading() {
  return (
    <>
      <AdminHeading title="Projects" />
      <div
        role="status"
        aria-label="Loading projects"
        aria-busy="true"
        className="flex flex-col gap-6"
      >
        <span className="sr-only">Loading projects…</span>
        <div aria-hidden="true" className="grid gap-3 sm:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-12 w-full" />
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24 w-full rounded-2xl" />
        ))}
      </div>
    </>
  );
}
