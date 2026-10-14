import type { ReactNode } from 'react';
import { Logo } from '@/components/logo';
export function AuthPageShell({
  name,
  showLogo = false,
  children,
}: {
  name: string;
  showLogo?: boolean;
  children: ReactNode;
}) {
  return (
    <main className="min-h-svh bg-background px-5 pb-[max(5rem,env(safe-area-inset-bottom))] pt-[max(2rem,env(safe-area-inset-top))] sm:px-8 sm:py-10">
      <div className="mx-auto flex w-full max-w-md flex-col items-center sm:min-h-[calc(100svh-5rem)]">
        {showLogo ? (
          <Logo className="h-10" />
        ) : (
          <div className="text-center text-xl font-semibold tracking-tight break-words">
            {name}
          </div>
        )}
        <div className="flex w-full flex-1 items-center py-12 sm:py-16">
          <div className="w-full">{children}</div>
        </div>
      </div>
    </main>
  );
}
