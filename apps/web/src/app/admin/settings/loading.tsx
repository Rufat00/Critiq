import { AdminHeading } from '@/components/admin-heading';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
export default function Loading() {
  return (
    <>
      <AdminHeading title="Settings" />
      <div
        className="flex flex-col"
        role="status"
        aria-label="Loading settings"
        aria-busy="true"
      >
        {[1, 2, 3].map((row) => (
          <div key={row}>
            <div className="grid gap-4 py-6 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] md:gap-12">
              <div className="flex flex-col gap-3">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-4 w-full" />
              </div>
              <Skeleton className="h-12 w-full" />
            </div>
            <Separator />
          </div>
        ))}
        <Skeleton className="mt-6 h-10 w-36 self-end" />
      </div>
    </>
  );
}
