'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Progress as ProgressPrimitive } from 'radix-ui';

const progressVariants = {
  default: 'bg-primary',
  destructive: 'bg-destructive-fill',
  warning: 'bg-warning-fill',
  info: 'bg-info-fill',
  success: 'bg-success-fill',
};

function Progress({
  className,
  value,
  variant = 'default',
  ...props
}: React.ComponentProps<typeof ProgressPrimitive.Root> & {
  variant?: keyof typeof progressVariants;
}) {
  return (
    <ProgressPrimitive.Root
      data-slot="progress"
      value={value}
      className={cn(
        'relative h-2 w-full overflow-hidden rounded-full bg-muted',
        className,
      )}
      {...props}
    >
      <ProgressPrimitive.Indicator
        data-slot="progress-indicator"
        className={cn(
          'h-full w-full flex-1 transition-[transform] duration-200 motion-reduce:transition-none',
          progressVariants[variant],
        )}
        style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
      />
    </ProgressPrimitive.Root>
  );
}

export { Progress };
