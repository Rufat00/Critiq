'use client';
import { useState } from 'react';
import { useForm, useStore } from '@tanstack/react-form';
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogDescription,
  ResponsiveDialogBody,
  ResponsiveDialogFooter,
} from '@/components/ui/responsive-dialog';
import {
  FieldGroup,
  Field,
  FieldLabel,
  FieldSet,
  FieldLegend,
  FieldError,
} from '@/components/ui/field';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { Button, LoadingButton } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from '@/components/ui/sonner';
import { skipJudgingVisitAction, declareJudgeConflictAction } from '../actions';
const reasons = [
  'Absent',
  'Being judged',
  'Technical issue',
  'Conflict of interest',
  'Other',
] as const;
export function SkipVisitDialog({
  open,
  onOpenChange,
  visitId,
  projectId,
  onSkipped,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  visitId: string;
  projectId: string;
  onSkipped: () => Promise<void>;
}) {
  const [error, setError] = useState<string>();
  const [fieldError, setFieldError] = useState<string>();
  const form = useForm({
    defaultValues: { reason: '', note: '' },
    onSubmit: async ({ value }) => {
      setError(undefined);
      setFieldError(undefined);
      if (
        !value.reason ||
        (value.reason === 'Other' && value.note.trim().length < 3)
      ) {
        setFieldError('Choose a reason and add details if you select Other.');
        return;
      }
      try {
        const reason = `${value.reason}${value.note.trim() ? `: ${value.note.trim()}` : ''}`;
        const result =
          value.reason === 'Conflict of interest'
            ? await declareJudgeConflictAction({ projectId, reason })
            : await skipJudgingVisitAction({ visitId, reason });
        if (!result.ok) {
          setError(result.error.message);
          return;
        }
        toast.success('Project skipped.');
        onOpenChange(false);
        form.reset();
        await onSkipped();
      } catch {
        setError('Unable to skip this project. Please retry.');
      }
    },
  });
  const pending = useStore(form.store, (s) => s.isSubmitting);
  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={(value) => {
        if (!pending) onOpenChange(value);
      }}
    >
      <ResponsiveDialogContent>
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>Skip this project?</ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            Choose why you can’t judge it now.
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void form.handleSubmit();
          }}
        >
          <ResponsiveDialogBody>
            <FieldGroup>
              <form.Field name="reason">
                {(field) => (
                  <FieldSet>
                    <FieldLegend>Reason</FieldLegend>
                    <RadioGroup
                      value={field.state.value}
                      onValueChange={field.handleChange}
                      disabled={pending}
                      aria-invalid={Boolean(fieldError)}
                      aria-describedby="skip-error"
                    >
                      {reasons.map((reason) => (
                        <Field key={reason} orientation="horizontal">
                          <RadioGroupItem
                            id={`skip-${reason}`}
                            value={reason}
                          />
                          <FieldLabel
                            htmlFor={`skip-${reason}`}
                            className="min-h-11 flex-1"
                          >
                            {reason}
                          </FieldLabel>
                        </Field>
                      ))}
                    </RadioGroup>
                    <FieldError id="skip-error">{fieldError}</FieldError>
                  </FieldSet>
                )}
              </form.Field>
              <form.Field name="note">
                {(field) => (
                  <Field>
                    <FieldLabel htmlFor="skip-note">
                      Details (required for Other)
                    </FieldLabel>
                    <Textarea
                      id="skip-note"
                      maxLength={900}
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      disabled={pending}
                    />
                  </Field>
                )}
              </form.Field>
            </FieldGroup>
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </ResponsiveDialogBody>
          <ResponsiveDialogFooter>
            <Button
              type="button"
              variant="secondary"
              disabled={pending}
              onClick={() => onOpenChange(false)}
            >
              Keep project
            </Button>
            <LoadingButton type="submit" loading={pending}>
              Skip project
            </LoadingButton>
          </ResponsiveDialogFooter>
        </form>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
