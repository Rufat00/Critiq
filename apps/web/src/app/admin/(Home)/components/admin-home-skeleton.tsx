import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardHeader, CardContent } from '@/components/ui/card';

export function AdminHomeSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true">
      <span className="sr-only" role="status">
        Loading your judging workspace…
      </span>
      <Skeleton className="h-10 w-4/5" />
      <div
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
        aria-hidden="true"
      >
        {[0, 1, 2, 3].map((item) => (
          <Card key={item}>
            <CardHeader>
              <Skeleton className="h-6 w-32" />
            </CardHeader>
            <CardContent className="flex items-center justify-between gap-3">
              <Skeleton className="h-10 w-16" />
              <Skeleton className="h-9 w-20 shrink-0 rounded-full" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div
        className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]"
        aria-hidden="true"
      >
        <Skeleton className="h-32 w-full" />
        <Skeleton className="aspect-video w-full" />
      </div>
    </div>
  );
}
