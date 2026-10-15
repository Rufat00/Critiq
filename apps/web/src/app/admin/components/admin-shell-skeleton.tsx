import { Skeleton } from '@/components/ui/skeleton';
import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
} from '@/components/ui/sidebar';
import { AdminFrame } from './admin-frame';
import { AdminHomeSkeleton } from '../(Home)/components/admin-home-skeleton';

export function AdminShellSkeleton() {
  return (
    <AdminFrame
      loading
      navigation={
        <Sidebar>
          <div aria-hidden="true" className="flex min-h-0 flex-1 flex-col">
            <SidebarHeader className="px-6 pt-7 pb-6">
              <Skeleton className="h-8 w-28" />
              <Skeleton className="mt-3 h-6 w-full" />
              <Skeleton className="h-6 w-2/3" />
            </SidebarHeader>
            <SidebarContent className="gap-0">
              <SidebarGroup className="gap-1">
                {[0, 1, 2, 3, 4, 5].map((item) => (
                  <div key={item} className="flex h-12 items-center gap-3 px-3">
                    <Skeleton className="size-5 shrink-0" />
                    <Skeleton className="h-5 w-24" />
                  </div>
                ))}
              </SidebarGroup>
            </SidebarContent>
            <SidebarFooter className="gap-4 px-3 pb-6">
              <div className="flex flex-col gap-3 rounded-2xl border p-3">
                <Skeleton className="h-5 w-full" />
                <div className="flex justify-between gap-3">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-8" />
                </div>
                <Skeleton className="h-2 w-full rounded-full" />
                <Skeleton className="h-11 w-full rounded-full md:h-9" />
              </div>
              <div className="flex flex-col gap-3 rounded-2xl border p-3">
                <div className="flex items-center gap-3">
                  <Skeleton className="size-8 shrink-0 rounded-full" />
                  <Skeleton className="h-4 w-20" />
                </div>
                <Skeleton className="h-11 w-full rounded-full md:h-9" />
              </div>
            </SidebarFooter>
          </div>
        </Sidebar>
      }
    >
      <AdminHomeSkeleton />
    </AdminFrame>
  );
}
