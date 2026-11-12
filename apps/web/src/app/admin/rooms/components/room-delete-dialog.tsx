'use client';
import { useRef, useState, useTransition } from 'react';
import { RiDeleteBinLine } from '@remixicon/react';
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogBody,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import { Button, LoadingButton } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from '@/components/ui/sonner';
import { deleteRoomAction } from '../actions';
export function RoomDeleteDialog({
  roomId,
  name,
  locked,
  onDeleted,
}: {
  roomId: string;
  name: string;
  locked: boolean;
  onDeleted: () => void;
}) {
  const [open, setOpen] = useState(false),
    [error, setError] = useState(''),
    [pending, startTransition] = useTransition();
  const busy = useRef(false);
  function remove() {
    if (busy.current || locked) return;
    busy.current = true;
    setError('');
    startTransition(async () => {
      try {
        const result = await deleteRoomAction({ roomId });
        if (!result.ok) {
          setError(result.error.message);
          return;
        }
        setOpen(false);
        toast.success(`${name} deleted.`);
        onDeleted();
      } catch {
        setError('Unable to delete the room. Please try again.');
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
          variant="secondary"
          size="sm"
          disabled={locked}
          aria-label={`Delete ${name}`}
        >
          <RiDeleteBinLine data-icon="inline-start" />
          Delete
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {name}?</AlertDialogTitle>
          <AlertDialogDescription>
            This permanently deletes the room. Projects are kept and reassigned
            to available spots; those without a spot become unassigned. Existing
            project numbers may change.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error && (
          <AlertDialogBody>
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          </AlertDialogBody>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <LoadingButton
            variant="destructive"
            loading={pending}
            onClick={remove}
          >
            Delete room
          </LoadingButton>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
