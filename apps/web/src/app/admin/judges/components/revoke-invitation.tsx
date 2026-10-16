'use client';
import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button, LoadingButton } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
} from '@/components/ui/alert-dialog';
import { toast } from '@/components/ui/sonner';
import { revokeJudgeInvitationAction } from '../actions';

export function RevokeInvitation({ id }: { id: string }) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState('');
  const [pending, startTransition] = useTransition();
  const busy = useRef(false);
  const router = useRouter();
  function revoke() {
    if (busy.current) return;
    busy.current = true;
    setError('');
    startTransition(async () => {
      try {
        const result = await revokeJudgeInvitationAction({ invitationId: id });
        if (!result.ok) {
          setError(result.error.message);
          return;
        }
        setConfirming(false);
        toast.success('Invitation revoked.');
        router.refresh();
      } catch {
        setError('Unable to connect. Please try again.');
      } finally {
        busy.current = false;
      }
    });
  }
  return (
    <>
      <Button
        variant="secondary"
        onClick={() => {
          setError('');
          setConfirming(true);
        }}
      >
        Revoke
      </Button>
      <AlertDialog
        open={confirming}
        onOpenChange={(open) => {
          if (!pending) setConfirming(open);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke invitation?</AlertDialogTitle>
            <AlertDialogDescription>
              This invitation will stop working immediately. You can send a new
              invitation if needed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {error && (
            <div className="px-6 py-4">
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            </div>
          )}
          <AlertDialogFooter>
            <Button
              variant="secondary"
              disabled={pending}
              onClick={() => setConfirming(false)}
            >
              Keep invitation
            </Button>
            <LoadingButton
              variant="destructive"
              loading={pending}
              onClick={revoke}
            >
              Revoke invitation
            </LoadingButton>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
