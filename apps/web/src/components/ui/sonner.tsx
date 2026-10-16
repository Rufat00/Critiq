'use client';

import {
  RiCheckboxCircleFill,
  RiCloseCircleFill,
  RiCloseLine,
} from '@remixicon/react';
import { cva } from 'class-variance-authority';
import {
  toast as sonnerToast,
  Toaster as Sonner,
  type ExternalToast,
  type ToasterProps,
} from 'sonner';
import { Button } from '@/components/ui/button';

// Success/error surfaces adapted from Appliance CRM, using Critiq's tokens.
const surfaceVariants = cva(
  'relative flex w-(--width) max-w-[calc(100vw-2rem)] items-start gap-3 overflow-hidden rounded-xl border px-4 py-2 text-foreground',
  {
    variants: {
      variant: {
        success: 'border-success/25 bg-success-subtle',
        error: 'border-destructive/25 bg-destructive-subtle',
      },
    },
  },
);
const iconVariants = cva(
  'flex size-9 shrink-0 items-center justify-center rounded-lg [&_svg]:size-6',
  {
    variants: {
      variant: { success: 'text-success', error: 'text-destructive' },
    },
  },
);
const titleVariants = cva('text-sm font-medium leading-5', {
  variants: {
    variant: { success: 'text-foreground', error: 'text-destructive' },
  },
});
type FeedbackOptions = Pick<
  ExternalToast,
  'id' | 'duration' | 'onDismiss' | 'onAutoClose'
> & { description?: string };

function showFeedback(
  variant: 'success' | 'error',
  message: string,
  options: FeedbackOptions = {},
) {
  const { description, duration = 5000, ...rest } = options;
  const Icon = variant === 'success' ? RiCheckboxCircleFill : RiCloseCircleFill;
  return sonnerToast.custom(
    (id) => (
      <div className={surfaceVariants({ variant })}>
        <span aria-hidden="true" className={iconVariants({ variant })}>
          <Icon />
        </span>
        <div className="my-auto min-w-0 flex-1">
          <div className={titleVariants({ variant })}>{message}</div>
          {description && (
            <p className="mt-0.5 text-sm leading-5 text-foreground/75">
              {description}
            </p>
          )}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="-mr-1 my-auto size-7 shrink-0"
          aria-label="Close notification"
          onClick={() => sonnerToast.dismiss(id)}
        >
          <RiCloseLine />
        </Button>
      </div>
    ),
    { ...rest, duration, position: 'top-center', unstyled: true },
  );
}

export const toast = {
  success: (message: string, options?: FeedbackOptions) =>
    showFeedback('success', message, options),
  error: (message: string, options?: FeedbackOptions) =>
    showFeedback('error', message, options),
  dismiss: sonnerToast.dismiss,
};

export function Toaster(props: ToasterProps) {
  return (
    <Sonner
      theme="system"
      position="top-center"
      expand={false}
      gap={8}
      visibleToasts={4}
      toastOptions={{ unstyled: true }}
      {...props}
    />
  );
}
