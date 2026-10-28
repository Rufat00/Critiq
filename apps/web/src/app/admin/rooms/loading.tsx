import { AdminHeading } from '@/components/admin-heading';
import { Skeleton } from '@/components/ui/skeleton';
export default function Loading() {
  return (
    <>
      <AdminHeading
        title="Rooms"
        description="Manage judging locations and table assignments."
      />
      <div
        className="flex flex-col gap-6"
        role="status"
        aria-label="Loading rooms"
        aria-busy="true"
      >
        <div className="grid gap-3 sm:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-10 w-full sm:w-80" />
        <Skeleton className="h-72 w-full rounded-xl" />
      </div>
    </>
  );
}
