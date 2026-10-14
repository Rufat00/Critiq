'use client';

import * as React from 'react';
import { Slot as SlotPrimitive } from 'radix-ui';
import { cva, type VariantProps } from 'class-variance-authority';
import { RiLoader4Line } from '@remixicon/react';

import { cn } from '@/lib/utils';
import { Ripple } from '@/components/ui/ripple';

const buttonVariants = cva(
  'relative inline-flex cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-medium shadow-none transition-colors duration-[var(--motion-fast)] ease-ui focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-45 aria-invalid:border-destructive aria-invalid:ring-destructive/20 [&_svg]:pointer-events-none [&_svg]:size-[18px] [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default:
          'bg-primary text-primary-foreground [--ripple-color:var(--primary-foreground)] hover:bg-primary-hover',
        secondary:
          'bg-secondary text-secondary-foreground hover:bg-surface-hover',
        soft: 'bg-soft text-soft-foreground hover:bg-soft-hover',
        ghost: 'bg-transparent text-foreground hover:bg-accent',
        destructive:
          'bg-destructive text-destructive-foreground hover:bg-destructive/90',
      },
      size: {
        default: 'h-10 px-5',
        sm: 'h-11 px-4 md:h-9',
        lg: 'h-12 px-6',
        icon: 'size-11',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

export interface ButtonProps
  extends
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  ripple?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      asChild = false,
      ripple = true,
      children,
      ...props
    },
    ref,
  ) => {
    const Comp = asChild ? SlotPrimitive.Slot : 'button';
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      >
        <SlotPrimitive.Slottable>{children}</SlotPrimitive.Slottable>
        {ripple && <Ripple disabled={props.disabled} />}
      </Comp>
    );
  },
);
Button.displayName = 'Button';

export interface LoadingButtonProps extends Omit<ButtonProps, 'asChild'> {
  loading?: boolean;
}

const LoadingButton = React.forwardRef<HTMLButtonElement, LoadingButtonProps>(
  ({ loading = false, disabled, className, children, ...props }, ref) => (
    <Button
      ref={ref}
      disabled={disabled || loading}
      aria-busy={loading}
      className={cn('relative', className)}
      {...props}
    >
      <span className={cn(loading && 'invisible')}>{children}</span>
      {loading && (
        <RiLoader4Line className="absolute animate-spin" aria-hidden="true" />
      )}
    </Button>
  ),
);
LoadingButton.displayName = 'LoadingButton';

export { Button, LoadingButton, buttonVariants };
