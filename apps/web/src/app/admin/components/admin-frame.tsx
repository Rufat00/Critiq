'use client';

import type { CSSProperties, ReactNode } from 'react';
import {
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import { UnsavedGuardProvider } from '@/components/ui/unsaved-guard';
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
    <UnsavedGuardProvider>
      <SidebarProvider
        style={{ '--sidebar-width': '14.5rem' } as CSSProperties}
      >
        {navigation}
        <SidebarInset className="min-w-0">
          <div className="mx-auto flex w-full max-w-7xl flex-col gap-9 px-4 py-6 md:px-8 md:py-10">
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
    </UnsavedGuardProvider>
  );
}
