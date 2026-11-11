'use client';

import * as React from 'react';
import { ToggleGroup as ToggleGroupPrimitive } from 'radix-ui';
import { RiCheckLine } from '@remixicon/react';
import { cn } from '@/lib/utils';

function ToggleGroup({
  className,
  ...props
}: React.ComponentProps<typeof ToggleGroupPrimitive.Root>) {
  return (
    <ToggleGroupPrimitive.Root
      data-slot="toggle-group"
      className={cn('grid w-full gap-3 sm:grid-cols-2', className)}
      {...props}
    />
  );
}

function ToggleGroupItem({
  className,
  children,
  ...props
}: React.ComponentProps<typeof ToggleGroupPrimitive.Item>) {
  return (
    <ToggleGroupPrimitive.Item
      data-slot="toggle-group-item"
      className={cn(
        'group flex w-full cursor-pointer items-center justify-between gap-4 rounded-full border border-border px-4 py-3 text-sm font-medium text-foreground transition-colors outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-default disabled:opacity-50 aria-invalid:border-destructive data-[state=on]:border-primary data-[state=on]:bg-accent',
        className,
      )}
      {...props}
    >
      <span className="min-w-0 text-left">{children}</span>
      <span
        aria-hidden="true"
        className="flex size-4 shrink-0 items-center justify-center rounded-[4px] border border-input group-data-[state=on]:border-primary group-data-[state=on]:bg-primary group-data-[state=on]:text-primary-foreground"
      >
        <RiCheckLine className="size-3.5 opacity-0 group-data-[state=on]:opacity-100" />
      </span>
    </ToggleGroupPrimitive.Item>
  );
}

export { ToggleGroup, ToggleGroupItem };
