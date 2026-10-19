'use client';
import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { RiDeleteBinLine } from '@remixicon/react';
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import { Button, LoadingButton } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from '@/components/ui/sonner';
import { deleteProjectAction } from '../actions';
export function ProjectDeleteDialog({
  projectId,
  name,
  locked,
}: {
  projectId: string;
  name: string;
  locked: boolean;
}) {
  const [open, setOpen] = useState(false),
    [error, setError] = useState(''),
    [pending, startTransition] = useTransition();
  const busy = useRef(false),
    router = useRouter();
  function remove() {
    if (busy.current || locked) return;
    busy.current = true;
    setError('');
    startTransition(async () => {
      try {
        const result = await deleteProjectAction({ projectId });
        if (!result.ok) {
          setError(result.error.message);
          return;
        }
        setOpen(false);
        toast.success(`${name} deleted.`);
        router.refresh();
      } catch {
        setError('Unable to delete. Please try again.');
      } finally {
        busy.current = false;
      }
    });
  }
  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!busy.current) {
          setOpen(next);
          setError('');
        }
      }}
    >
      <AlertDialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          disabled={locked}
          aria-label={`Delete ${name}`}
        >
          <RiDeleteBinLine />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {name}?</AlertDialogTitle>
          <AlertDialogDescription>
            This permanently removes the project and its challenge entries. You
            cannot undo this action.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <LoadingButton
            variant="destructive"
            loading={pending}
            onClick={remove}
          >
            Delete project
          </LoadingButton>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
