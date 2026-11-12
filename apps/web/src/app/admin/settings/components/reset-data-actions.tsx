'use client';

import { useId, useRef, useState } from 'react';
import { useForm, useStore } from '@tanstack/react-form';
import { useRouter } from 'next/navigation';
import type { ResetHackathonDataInput } from '@critiq/core/hackathon';
import { Button, LoadingButton } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogBody,
  AlertDialogFooter,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from '@/components/ui/sonner';
import { resetHackathonDataAction } from '../actions';
import { SettingItem } from './setting-item';

const resetOptions = [
  {
    section: 'projects',
    label: 'Reset project data',
    description:
      'Permanently delete all projects, including their challenge entries and room assignments.',
    acknowledgment:
      'I understand that all project data will be permanently deleted and cannot be restored.',
  },
  {
    section: 'judges',
    label: 'Reset judge data',
    description:
      'Permanently delete all judge accounts, sign-in sessions, category access, conflicts, and judge invitations. Owner and admin accounts are kept.',
    acknowledgment:
      'I understand that all judge accounts and their related data will be permanently deleted and cannot be restored.',
  },
  {
    section: 'categories',
    label: 'Reset category data',
    description:
      'Permanently delete all custom tracks, challenges, rubrics, and category access. Overall is restored to its defaults. Projects are kept, moved to Overall, and their room assignments are recalculated.',
    acknowledgment:
      'I understand that category data will be permanently deleted and cannot be restored, and projects will be moved to Overall.',
  },
  {
    section: 'rooms',
    label: 'Reset room data',
    description:
      'Permanently delete all rooms, track capacities, and room access. Projects are kept with their room assignments and project numbers cleared.',
    acknowledgment:
      'I understand that all rooms and their related data will be permanently deleted and cannot be restored.',
  },
] satisfies {
  section: ResetHackathonDataInput['section'];
  label: string;
  description: string;
  acknowledgment: string;
}[];

export function ResetDataActions({
  locked,
  unsaved,
}: {
  locked: boolean;
  unsaved: boolean;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <div className="flex flex-col">
      {unsaved && (
        <p className="pb-3 text-sm text-muted-foreground">
          Save or discard your changes before resetting data.
        </p>
      )}
      {resetOptions.map((option) => (
        <div key={option.section}>
          <SettingItem
            title={option.label}
            description={option.description}
            variant="action"
          >
            <ResetDataDialog
              option={option}
              disabled={locked || unsaved || busy}
              onBusyChange={setBusy}
            />
          </SettingItem>
          <Separator />
        </div>
      ))}
    </div>
  );
}

function ResetDataDialog({
  option,
  disabled,
  onBusyChange,
}: {
  option: (typeof resetOptions)[number];
  disabled: boolean;
  onBusyChange: (busy: boolean) => void;
}) {
  const id = useId();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string>();
  const submitting = useRef(false);
  const form = useForm({
    defaultValues: { acknowledged: false },
    onSubmit: async ({ value }) => {
      if (!value.acknowledged || disabled || submitting.current) return;
      submitting.current = true;
      onBusyChange(true);
      setError(undefined);
      try {
        const result = await resetHackathonDataAction({
          section: option.section,
          acknowledged: true,
        });
        if (!result.ok) {
          setError(result.error.message);
          toast.error(result.error.message);
          return;
        }
        setOpen(false);
        form.reset();
        toast.success(
          `${option.section[0]!.toUpperCase()}${option.section.slice(1)} data reset.`,
        );
        router.refresh();
      } catch {
        const message = 'Unable to reset data. Please try again.';
        setError(message);
        toast.error(message);
      } finally {
        submitting.current = false;
        onBusyChange(false);
      }
    },
  });
  const acknowledged = useStore(
    form.store,
    (state) => state.values.acknowledged,
  );
  const pending = useStore(form.store, (state) => state.isSubmitting);
  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (submitting.current) return;
        setOpen(next);
        form.reset();
        setError(undefined);
      }}
    >
      <AlertDialogTrigger asChild>
        <Button type="button" variant="destructive" disabled={disabled}>
          {option.label}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent
        onEscapeKeyDown={(event) => {
          if (pending) event.preventDefault();
        }}
      >
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void form.handleSubmit();
          }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle>{option.label}?</AlertDialogTitle>
            <AlertDialogDescription>
              {option.description} This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogBody>
            <FieldGroup>
              <form.Field name="acknowledged">
                {(field) => (
                  <Field orientation="horizontal" data-disabled={pending}>
                    <Checkbox
                      id={id}
                      checked={field.state.value}
                      onCheckedChange={(checked) =>
                        field.handleChange(checked === true)
                      }
                      onBlur={field.handleBlur}
                      disabled={pending}
                    />
                    <FieldLabel htmlFor={id} className="leading-relaxed">
                      {option.acknowledgment}
                    </FieldLabel>
                  </Field>
                )}
              </form.Field>
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
            </FieldGroup>
          </AlertDialogBody>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            <LoadingButton
              type="submit"
              variant="destructive"
              loading={pending}
              disabled={!acknowledged || disabled}
            >
              {option.label}
            </LoadingButton>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}
