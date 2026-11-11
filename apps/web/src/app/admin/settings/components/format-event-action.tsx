'use client';

import { useId, useRef, useState } from 'react';
import { useForm, useStore } from '@tanstack/react-form';
import { useRouter } from 'next/navigation';
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
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button, LoadingButton } from '@/components/ui/button';
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from '@/components/ui/sonner';
import { formatHackathonAction } from '../actions';
import { SettingItem } from './setting-item';

export function FormatEventAction({
  eventName,
  disabled,
}: {
  eventName: string;
  disabled: boolean;
}) {
  const id = useId();
  const router = useRouter();
  const submitting = useRef(false);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string>();
  const [nameError, setNameError] = useState<string>();
  const form = useForm({
    defaultValues: { eventName: '', acknowledged: false },
    onSubmit: async ({ value }) => {
      if (
        submitting.current ||
        disabled ||
        !value.acknowledged ||
        value.eventName !== eventName
      )
        return;
      submitting.current = true;
      setError(undefined);
      setNameError(undefined);
      try {
        const result = await formatHackathonAction({
          eventName: value.eventName,
          acknowledged: true,
        });
        if (!result.ok) {
          setError(result.error.message);
          setNameError(result.error.fieldErrors?.eventName?.[0]);
          toast.error(result.error.message);
          return;
        }
        setOpen(false);
        form.reset();
        toast.success('Event formatted. Start again with event setup.');
        router.replace('/setup');
        router.refresh();
      } catch {
        const message = 'Unable to format the event. Please try again.';
        setError(message);
        toast.error(message);
      } finally {
        submitting.current = false;
      }
    },
  });
  const values = useStore(form.store, (state) => state.values);
  const pending = useStore(form.store, (state) => state.isSubmitting);
  return (
    <SettingItem
      title="Format event"
      description="Permanently erase all event data and all accounts except the owner. Clear the event name, restore default settings, and start again from event setup. Your owner account stays signed in."
      variant="action"
    >
      <AlertDialog
        open={open}
        onOpenChange={(next) => {
          if (submitting.current) return;
          setOpen(next);
          form.reset();
          setError(undefined);
          setNameError(undefined);
        }}
      >
        <AlertDialogTrigger asChild>
          <Button
            type="button"
            variant="destructive"
            disabled={disabled || !eventName}
          >
            Format event
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent
          onEscapeKeyDown={(event) => {
            if (pending) event.preventDefault();
          }}
        >
          <form
            autoComplete="off"
            onSubmit={(event) => {
              event.preventDefault();
              void form.handleSubmit();
            }}
          >
            <AlertDialogHeader>
              <AlertDialogTitle>Format this event?</AlertDialogTitle>
              <AlertDialogDescription>
                This permanently deletes all projects, judging history, custom
                categories, rooms, invitations, and every admin and judge
                account. Only the owner account is kept. The event name and
                settings are reset so you can start setup again.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogBody>
              <FieldGroup>
                <form.Field name="eventName">
                  {(field) => (
                    <Field
                      data-invalid={Boolean(nameError)}
                      data-disabled={pending}
                    >
                      <FieldLabel htmlFor={`${id}-name`}>
                        Enter the event name to confirm
                      </FieldLabel>
                      <FieldDescription id={`${id}-description`}>
                        Type “{eventName}” exactly.
                      </FieldDescription>
                      <Input
                        id={`${id}-name`}
                        name={field.name}
                        value={field.state.value}
                        onChange={(event) => {
                          field.handleChange(event.target.value);
                          setNameError(undefined);
                          setError(undefined);
                        }}
                        onBlur={field.handleBlur}
                        required
                        maxLength={100}
                        disabled={pending}
                        aria-invalid={Boolean(nameError)}
                        aria-describedby={`${id}-description ${id}-error`}
                      />
                      <FieldError id={`${id}-error`}>{nameError}</FieldError>
                    </Field>
                  )}
                </form.Field>
                <form.Field name="acknowledged">
                  {(field) => (
                    <Field orientation="horizontal" data-disabled={pending}>
                      <Checkbox
                        id={`${id}-acknowledge`}
                        checked={field.state.value}
                        onCheckedChange={(checked) =>
                          field.handleChange(checked === true)
                        }
                        onBlur={field.handleBlur}
                        disabled={pending}
                      />
                      <FieldLabel
                        htmlFor={`${id}-acknowledge`}
                        className="leading-relaxed"
                      >
                        I understand that all event data and every account
                        except the owner will be permanently deleted and cannot
                        be restored.
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
                disabled={
                  disabled ||
                  !values.acknowledged ||
                  values.eventName !== eventName
                }
              >
                Format event
              </LoadingButton>
            </AlertDialogFooter>
          </form>
        </AlertDialogContent>
      </AlertDialog>
    </SettingItem>
  );
}
