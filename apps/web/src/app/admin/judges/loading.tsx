import { AdminHeading } from '@/components/admin-heading';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from '@/components/ui/table';

export default function Loading() {
  return (
    <>
      <AdminHeading title="Judges" />
      <div role="status" aria-label="Loading judges" aria-busy="true">
        <span className="sr-only">Loading judges…</span>
        <div aria-hidden="true" className="flex min-w-0 flex-col gap-6">
          <div className="flex gap-6 overflow-hidden border-b border-border pt-2 pb-3">
            {[1, 2, 3].map((tab) => (
              <div key={tab} className="flex shrink-0 items-center gap-1.5">
                <Skeleton className="h-5 w-20" />
                <Skeleton className="h-5 w-6 rounded-full" />
              </div>
            ))}
          </div>
          <div className="grid w-full max-w-xl gap-3 sm:grid-cols-2">
            {[1, 2].map((tile) => (
              <div
                key={tile}
                className="flex min-h-20 flex-col items-start justify-center gap-2 rounded-2xl bg-soft px-5 py-4"
              >
                <Skeleton className="size-5" />
                <Skeleton className="h-5 w-28" />
              </div>
            ))}
          </div>
          <section className="flex min-w-0 flex-col gap-5">
            <div className="grid items-end gap-4 md:grid-cols-[auto_minmax(0,1fr)]">
              <div className="flex items-center gap-6 border-b border-border pt-2 pb-3">
                <Skeleton className="h-5 w-12" />
                <div className="flex items-center gap-1.5">
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-5 w-6 rounded-full" />
                </div>
              </div>
              <Skeleton className="h-11 w-full rounded-lg" />
            </div>
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>
                      <span className="sr-only">Actions</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[1, 2, 3, 4, 5].map((row) => (
                    <TableRow key={row}>
                      <TableCell>
                        <Skeleton className="h-5 w-32 max-w-full" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-5 w-52 max-w-full" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="ml-auto size-11 rounded-full" />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="flex flex-col gap-3 md:hidden">
              {[1, 2, 3].map((row) => (
                <div
                  key={row}
                  className="flex items-start justify-between gap-3 rounded-xl border border-border p-4"
                >
                  <div className="flex min-w-0 flex-col gap-1">
                    <Skeleton className="h-6 w-32 max-w-full" />
                    <Skeleton className="h-5 w-48 max-w-full" />
                  </div>
                  <Skeleton className="size-11 shrink-0 rounded-full" />
                </div>
              ))}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Skeleton className="h-5 w-36" />
              <div className="flex items-center gap-2">
                <Skeleton className="h-11 w-28 rounded-lg" />
                <Skeleton className="size-11 rounded-full" />
                <Skeleton className="size-11 rounded-full" />
              </div>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
