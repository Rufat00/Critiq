import type { ComponentProps } from 'react';

import { cn } from '@/lib/utils';

interface AppPageProps extends ComponentProps<'main'> {
  width?: 'default' | 'wide';
}

export function AppPage({
  className,
  width = 'default',
  children,
  ...props
}: AppPageProps) {
  return (
    <main
      className={cn(
        'min-h-svh bg-background px-5 py-6 md:px-8 md:py-10',
        className,
      )}
      {...props}
    >
      <div
        className={cn(
          'mx-auto flex w-full flex-col gap-8',
          width === 'wide' ? 'max-w-[1120px]' : 'max-w-[760px]',
        )}
      >
        {children}
      </div>
    </main>
  );
}
