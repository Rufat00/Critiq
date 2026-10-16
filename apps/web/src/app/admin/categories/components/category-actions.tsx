'use client';

import type { JudgingCategories } from '@critiq/core/categories';
import { CategoryFormDialog } from './category-form-dialog';
import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  RiMore2Line,
  RiPencilLine,
  RiDeleteBinLine,
  RiRouteLine,
  RiTrophyLine,
} from '@remixicon/react';
import { Button, LoadingButton } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuPortal,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@/components/ui/tooltip';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogBody,
  AlertDialogFooter,
} from '@/components/ui/alert-dialog';
import { toast } from '@/components/ui/sonner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { deleteCategoryAction, setChallengeTrackAction } from '../actions';

export function CategoryActions({
  id,
  categories,
  name,
  isOverall = false,
  locked,
  onDeleted,
  membershipKind,
  membershipOptions,
}: {
  id: string;
  categories: JudgingCategories;
  name: string;
  isOverall?: boolean;
  locked: boolean;
  onDeleted: (name: string) => void;
  membershipKind: 'tracks' | 'challenges';
  membershipOptions: { id: string; name: string; included: boolean }[];
}) {
  const [editOpen, setEditOpen] = useState(false);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const submitting = useRef(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const router = useRouter();
  const reason = isOverall
    ? 'Overall is required and cannot be deleted.'
    : 'Return the hackathon to draft to delete categories.';
  function remove() {
    if (submitting.current) return;
    submitting.current = true;
    setError(undefined);
    startTransition(async () => {
      try {
        const result = await deleteCategoryAction({ categoryId: id });
        if (!result.ok) {
          setError(result.error.message);
          toast.error(result.error.message);
          return;
        }
        setOpen(false);
        onDeleted(name);
        router.refresh();
      } catch {
        const message = 'Unable to delete this category. Please try again.';
        setError(message);
        toast.error(message);
      } finally {
        submitting.current = false;
      }
    });
  }
  function setMembership(optionId: string, included: boolean) {
    if (submitting.current || locked) return;
    submitting.current = true;
    startTransition(async () => {
      try {
        const result = await setChallengeTrackAction({
          trackCategoryId: membershipKind === 'challenges' ? id : optionId,
          challengeCategoryId: membershipKind === 'challenges' ? optionId : id,
          included,
        });
        if (!result.ok) {
          toast.error(result.error.message);
          return;
        }
        toast.success(
          `${result.data.challengeName} ${included ? 'added to' : 'removed from'} ${result.data.trackName}.`,
        );
        router.refresh();
      } catch {
        toast.error('Unable to save membership. Please try again.');
      } finally {
        submitting.current = false;
      }
    });
  }
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            ref={trigger}
            variant="ghost"
            size="icon"
            aria-label={`Actions for ${name}`}
          >
            <RiMore2Line />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuGroup>
            <DropdownMenuItem
              disabled={pending || locked}
              onSelect={() => setEditOpen(true)}
            >
              <RiPencilLine />
              Edit
            </DropdownMenuItem>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger disabled={locked || pending}>
                {membershipKind === 'challenges' ? (
                  <RiTrophyLine />
                ) : (
                  <RiRouteLine />
                )}
                {membershipKind === 'challenges' ? 'Challenges' : 'Tracks'}
              </DropdownMenuSubTrigger>
              <DropdownMenuPortal>
                <DropdownMenuSubContent className="max-h-80 max-w-[calc(100vw-2rem)] overflow-y-auto">
                  <DropdownMenuGroup>
                    {membershipOptions.map((option) => (
                      <DropdownMenuCheckboxItem
                        key={option.id}
                        checked={option.included}
                        disabled={pending || locked}
                        className="max-w-xs whitespace-normal break-words"
                        onSelect={(event) => event.preventDefault()}
                        onCheckedChange={(checked) =>
                          setMembership(option.id, checked === true)
                        }
                      >
                        {option.name}
                      </DropdownMenuCheckboxItem>
                    ))}
                    {!membershipOptions.length && (
                      <DropdownMenuItem disabled>
                        No {membershipKind} available
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuGroup>
                </DropdownMenuSubContent>
              </DropdownMenuPortal>
            </DropdownMenuSub>
            {isOverall || locked ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span tabIndex={0} aria-label={reason} className="block">
                    <DropdownMenuItem disabled>
                      <RiDeleteBinLine />
                      Delete
                    </DropdownMenuItem>
                  </span>
                </TooltipTrigger>
                <TooltipContent>{reason}</TooltipContent>
              </Tooltip>
            ) : (
              <DropdownMenuItem
                variant="destructive"
                disabled={pending}
                onSelect={() => {
                  setError(undefined);
                  setOpen(true);
                }}
              >
                <RiDeleteBinLine />
                Delete
              </DropdownMenuItem>
            )}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      {editOpen && (
        <CategoryFormDialog
          kind={membershipKind === 'challenges' ? 'track' : 'challenge'}
          categories={categories}
          locked={locked}
          editCategoryId={id}
          editOpen={editOpen}
          onEditOpenChange={setEditOpen}
          onEditClosed={() => trigger.current?.focus()}
          onSaved={toast.success}
        />
      )}
      <AlertDialog
        open={open}
        onOpenChange={(value) => {
          if (!submitting.current) setOpen(value);
        }}
      >
        <AlertDialogContent
          onEscapeKeyDown={(event) => {
            if (submitting.current) event.preventDefault();
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            trigger.current?.focus();
          }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the category, its rubric, and its
              category links. Projects are kept. This cannot be undone.
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
            <Button
              variant="secondary"
              disabled={pending}
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <LoadingButton
              variant="destructive"
              loading={pending}
              onClick={remove}
            >
              Delete category
            </LoadingButton>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
