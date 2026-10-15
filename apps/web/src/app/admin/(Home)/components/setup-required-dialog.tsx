'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { SignOutButton } from '@/components/auth/sign-out-button';

export function SetupRequiredDialog({ isOwner }: { isOwner: boolean }) {
  return (
    <Dialog open>
      <DialogContent
        showCloseButton={false}
        onEscapeKeyDown={(event) => event.preventDefault()}
        onInteractOutside={(event) => event.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Finish setup to start using the app</DialogTitle>
          <DialogDescription>
            {isOwner
              ? 'Give your hackathon a name and your workspace will be ready.'
              : 'Ask the installation owner to finish naming your hackathon.'}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <SignOutButton />
          {isOwner && (
            <Button asChild>
              <Link href="/setup">Finish setup</Link>
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
