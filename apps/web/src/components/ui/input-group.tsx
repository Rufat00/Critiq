'use client';

import type { ComponentProps } from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

// Shadcn input-group composition, using Critiq's existing controls and tokens.
export function InputGroup({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      role="group"
      data-slot="input-group"
      className={cn(
        'group/input-group flex min-h-11 w-full min-w-0 items-center rounded-lg border border-input bg-background transition-shadow focus-within:ring-2 focus-within:ring-ring has-[[aria-invalid=true]]:border-destructive',
        '[&_[data-slot=select-trigger]]:w-24 [&_[data-slot=select-trigger]]:rounded-none [&_[data-slot=select-trigger]]:border-0',
        className,
      )}
      {...props}
    />
  );
}

export function InputGroupInput({
  className,
  ...props
}: ComponentProps<typeof Input>) {
  return (
    <Input
      data-slot="input-group-control"
      className={cn(
        'min-w-0 flex-1 rounded-none border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0',
        className,
      )}
      {...props}
    />
  );
}

export function InputGroupAddon({
  className,
  ...props
}: ComponentProps<'div'>) {
  return (
    <div
      data-slot="input-group-addon"
      className={cn(
        'flex shrink-0 items-center gap-1 border-l border-border pr-1',
        className,
      )}
      {...props}
    />
  );
}
