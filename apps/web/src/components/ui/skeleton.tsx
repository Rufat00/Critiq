import { cn } from '@/lib/utils';

function Skeleton({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="skeleton"
      className={cn(
        'relative isolate overflow-hidden rounded-md bg-accent after:pointer-events-none after:absolute after:inset-0 after:animate-skeleton-wave after:bg-linear-to-r after:from-transparent after:via-foreground/3 after:to-transparent motion-reduce:after:hidden',
        className,
      )}
      {...props}
    />
  );
}

export { Skeleton };
