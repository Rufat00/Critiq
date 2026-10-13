import type { ButtonHTMLAttributes, ReactNode } from 'react';

import { cn } from '@/lib/utils';

export function ActionTile({
  icon,
  children,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { icon: ReactNode }) {
  return (
    <button
      type="button"
      className={cn(
        'flex min-h-20 w-full cursor-pointer flex-col items-start justify-center gap-2 rounded-2xl bg-soft px-5 py-4 text-left text-sm font-medium text-soft-foreground transition-colors duration-[var(--motion-fast)] ease-ui hover:bg-soft-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-45 [&_svg]:size-5',
        className,
      )}
      {...props}
    >
      <span aria-hidden="true">{icon}</span>
      <span>{children}</span>
    </button>
  );
}
