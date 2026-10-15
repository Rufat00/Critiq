'use client';

import type { CSSProperties, ReactNode } from 'react';
import {
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import { Skeleton } from '@/components/ui/skeleton';

export function AdminFrame({
  navigation,
  children,
  loading = false,
}: {
  navigation: ReactNode;
  children: ReactNode;
  loading?: boolean;
}) {
  return (
    <SidebarProvider style={{ '--sidebar-width': '13.2rem' } as CSSProperties}>
      {navigation}
      <SidebarInset className="min-w-0">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-9 px-5 py-8 md:px-10 md:py-12">
          {children}
        </div>
        {loading ? (
          <Skeleton className="fixed right-5 bottom-5 size-11 rounded-full md:hidden" />
        ) : (
          <SidebarTrigger
            variant="secondary"
            className="fixed right-5 bottom-5 shadow-sm"
          />
        )}
      </SidebarInset>
    </SidebarProvider>
  );
}
