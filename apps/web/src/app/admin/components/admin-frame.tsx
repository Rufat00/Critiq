'use client';

import type { ReactNode } from 'react';
import { UnsavedGuardProvider } from '@/components/ui/unsaved-guard';

export function AdminFrame({
  navigation,
  children,
}: {
  navigation: ReactNode;
  children: ReactNode;
}) {
  return (
    <UnsavedGuardProvider>
      <div className="min-h-svh bg-background">
        <a
          href="#admin-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-4 focus:rounded-full focus:bg-background focus:px-4 focus:py-2 focus:text-primary"
        >
          Skip to content
        </a>
        {navigation}
        <main
          id="admin-content"
          tabIndex={-1}
          className="mx-auto flex w-full max-w-[1200px] min-w-0 flex-col gap-9 px-5 pt-4 pb-[calc(7rem+env(safe-area-inset-bottom))] outline-none md:px-10 md:pt-6 md:pb-20"
        >
          {children}
        </main>
      </div>
    </UnsavedGuardProvider>
  );
}
