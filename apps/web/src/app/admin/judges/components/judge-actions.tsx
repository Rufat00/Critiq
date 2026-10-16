'use client';
import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { RiMore2Line, RiRouteLine, RiDeleteBinLine } from '@remixicon/react';
import type { JudgeTracks, JudgeList } from '@critiq/core/judges';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuPortal,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
} from '@/components/ui/alert-dialog';
import { Button, LoadingButton } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from '@/components/ui/sonner';
import { moveJudgeAction, removeJudgeAction } from '../actions';

export function JudgeActions({
  judge,
  tracks,
  categoryId,
  disabled,
}: {
  judge: JudgeList['items'][number];
  tracks: JudgeTracks;
  categoryId: string;
  disabled: boolean;
}) {
  const router = useRouter();
  const [choice, setChoice] = useState<{ target?: string } | null>(null);
  const [error, setError] = useState('');
  const [pending, startTransition] = useTransition();
  const busy = useRef(false);
  function confirm() {
    if (busy.current) return;
    busy.current = true;
    setError('');
    startTransition(async () => {
      try {
        const input = { userId: judge.id, categoryId };
        const result = choice?.target
          ? await moveJudgeAction({ ...input, targetCategoryId: choice.target })
          : await removeJudgeAction(input);
        if (!result.ok) {
          setError(result.error.message);
          return;
        }
        toast.success(
          choice?.target
            ? 'Judge moved to the selected track.'
            : 'Judge removed from this track.',
        );
        setChoice(null);
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
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            disabled={disabled || pending}
            aria-label={`Actions for ${judge.name}`}
          >
            <RiMore2Line />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuGroup>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger disabled={tracks.length < 2}>
                <RiRouteLine />
                Move to track
              </DropdownMenuSubTrigger>
              <DropdownMenuPortal>
                <DropdownMenuSubContent>
                  <DropdownMenuGroup>
                    {tracks
                      .filter((track) => track.id !== categoryId)
                      .map((track) => (
                        <DropdownMenuItem
                          key={track.id}
                          onSelect={() => {
                            setError('');
                            setChoice({ target: track.id });
                          }}
                        >
                          {track.name}
                        </DropdownMenuItem>
                      ))}
                  </DropdownMenuGroup>
                </DropdownMenuSubContent>
              </DropdownMenuPortal>
            </DropdownMenuSub>
            <DropdownMenuItem
              variant="destructive"
              onSelect={() => {
                setError('');
                setChoice({});
              }}
            >
              <RiDeleteBinLine />
              Remove from track
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      <AlertDialog
        open={choice !== null}
        onOpenChange={(open) => {
          if (!open && !pending) setChoice(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {choice?.target ? 'Move judge?' : 'Remove judge from track?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {choice?.target
                ? `${judge.name} will lose access to this track and join ${tracks.find((track) => track.id === choice.target)?.name}.`
                : `${judge.name} will lose access to this track. Their account and judging history will be preserved.`}
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
              onClick={() => setChoice(null)}
            >
              Cancel
            </Button>
            <LoadingButton
              loading={pending}
              variant={choice?.target ? 'default' : 'destructive'}
              onClick={confirm}
            >
              {choice?.target ? 'Move judge' : 'Remove judge'}
            </LoadingButton>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
