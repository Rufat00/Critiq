'use client';

import type { ComponentProps } from 'react';
import { DialogContent } from '@/components/ui/dialog';

// Dialog and Sheet share Radix Dialog primitives. Keep one mounted tree so
// changing viewport size preserves form state, focus, and dismissal guards.
function ResponsiveDialogContent({
  mobilePresentation = 'sheet',
  ...props
}: ComponentProps<typeof DialogContent> & {
  /** Keep compact, non-editing content centered when a sheet adds no benefit. */
  mobilePresentation?: 'sheet' | 'dialog';
}) {
  return (
    <DialogContent
      {...props}
      data-slot="responsive-dialog-content"
      data-mobile-presentation={mobilePresentation}
    />
  );
}

export { ResponsiveDialogContent };
export {
  Dialog as ResponsiveDialog,
  DialogTrigger as ResponsiveDialogTrigger,
  DialogClose as ResponsiveDialogClose,
  DialogHeader as ResponsiveDialogHeader,
  DialogBody as ResponsiveDialogBody,
  DialogFooter as ResponsiveDialogFooter,
  DialogTitle as ResponsiveDialogTitle,
  DialogDescription as ResponsiveDialogDescription,
} from '@/components/ui/dialog';
