'use client';

import * as React from 'react';
import { OTPInput, OTPInputContext } from 'input-otp';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';
import { RiSubtractLine } from '@remixicon/react';

function InputOTP({
  className,
  containerClassName,
  autoComplete = 'off',
  ...props
}: React.ComponentProps<typeof OTPInput> & {
  containerClassName?: string;
}) {
  return (
    <OTPInput
      data-slot="input-otp"
      containerClassName={cn(
        'cn-input-otp flex items-center has-disabled:opacity-50',
        containerClassName,
      )}
      autoComplete={autoComplete}
      className={cn('disabled:cursor-not-allowed', className)}
      {...props}
    />
  );
}

function InputOTPGroup({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="input-otp-group"
      className={cn('flex min-w-0 items-center', className)}
      {...props}
    />
  );
}

const inputOtpSlotVariants = cva(
  'border-input bg-card shadow-control aria-invalid:border-destructive data-[active=true]:border-ring data-[active=true]:ring-3 data-[active=true]:ring-ring/50 data-[active=true]:aria-invalid:border-destructive data-[active=true]:aria-invalid:ring-destructive/20 relative flex items-center justify-center border text-sm outline-none transition-all duration-[var(--motion-normal)] ease-ui data-[active=true]:z-10',
  {
    variants: {
      slotSize: {
        default: 'size-9 rounded-md',
        lg: 'size-12 rounded-xl text-lg sm:size-14',
      },
    },
    defaultVariants: { slotSize: 'default' },
  },
);

function InputOTPSlot({
  index,
  className,
  slotSize,
  ...props
}: React.ComponentProps<'div'> & {
  index: number;
} & VariantProps<typeof inputOtpSlotVariants>) {
  const inputOTPContext = React.useContext(OTPInputContext);
  const { char, hasFakeCaret, isActive } = inputOTPContext?.slots[index] ?? {};

  return (
    <div
      data-slot="input-otp-slot"
      data-active={isActive}
      className={cn(inputOtpSlotVariants({ slotSize, className }))}
      {...props}
    >
      {char}
      {hasFakeCaret && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="animate-caret-blink bg-foreground h-4 w-px duration-1000" />
        </div>
      )}
    </div>
  );
}

function InputOTPSeparator({ ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="input-otp-separator"
      className="mx-1 flex items-center [&_svg:not([class*='size-'])]:size-4"
      role="separator"
      {...props}
    >
      <RiSubtractLine />
    </div>
  );
}

export { InputOTP, InputOTPGroup, InputOTPSlot, InputOTPSeparator };
