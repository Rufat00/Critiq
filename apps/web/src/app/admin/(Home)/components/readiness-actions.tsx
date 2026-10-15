'use client';

import { useState, useTransition } from 'react';
import { useForm, useStore } from '@tanstack/react-form';
import { useRouter } from 'next/navigation';
import type { HackathonSetupSummary } from '@critiq/core/hackathon';
import { Button, LoadingButton } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogFooter,
} from '@/components/ui/dialog';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Checkbox } from '@/components/ui/checkbox';
import { SetupReadinessAlert } from './setup-readiness-alert';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  markHackathonReadyAction,
  returnHackathonToDraftAction,
} from '../actions';

export function ReadinessActions({
  summary,
}: {
  summary: HackathonSetupSummary;
}) {
  const [open, setOpen] = useState(false);
  const checklistComplete = summary.completeCount === summary.totalCount;
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const form = useForm({
    defaultValues: { acknowledgeWarnings: false },
    onSubmit: async ({ value }) => {
      setError(undefined);
      try {
        const result = await markHackathonReadyAction({
          fingerprint: summary.fingerprint,
          ...value,
        });
        if (!result.ok) {
          setError(result.error.message);
          return;
        }
        setOpen(false);
        router.refresh();
      } catch {
        setError('Unable to save the stage change. Please try again.');
      }
    },
  });
  const saving = useStore(form.store, (state) => state.isSubmitting);
  const acknowledged = useStore(
    form.store,
    (state) => state.values.acknowledgeWarnings,
  );
  if (summary.status === 'READY')
    return (
      <div className="flex flex-col items-start gap-3">
        <LoadingButton
          variant="secondary"
          loading={pending}
          onClick={() => {
            setError(undefined);
            startTransition(async () => {
              try {
                const result = await returnHackathonToDraftAction();
                if (!result.ok) setError(result.error.message);
                else router.refresh();
              } catch {
                setError('Unable to return to draft. Please try again.');
              }
            });
          }}
        >
          Return to draft
        </LoadingButton>
        <p className="text-sm text-muted-foreground">
          Return to draft to make changes. Starting judging will be available
          with the judging workflow.
        </p>
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </div>
    );
  return (
    <>
      <SetupReadinessAlert
        checklistComplete={checklistComplete}
        onFinish={() => {
          form.reset();
          setError(undefined);
          setOpen(true);
        }}
      />
      <Dialog
        open={open}
        onOpenChange={(value) => {
          if (!saving) setOpen(value);
        }}
      >
        <DialogContent
          onEscapeKeyDown={(event) => {
            if (saving) event.preventDefault();
          }}
          onInteractOutside={(event) => {
            if (saving) event.preventDefault();
          }}
        >
          <DialogHeader>
            <DialogTitle>Ready for the final checkpoint?</DialogTitle>
            <DialogDescription>
              Marking ready locks configuration. You can return to draft before
              judging starts.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void form.handleSubmit();
            }}
          >
            <DialogBody className="flex flex-col gap-5">
              {summary.blockers.length > 0 ? (
                <Alert variant="destructive">
                  <AlertDescription>
                    <p className="font-medium">Fix these issues first</p>
                    <ul className="mt-2 flex list-disc flex-col gap-2 pl-5">
                      {summary.blockers.map((issue) => (
                        <li key={issue}>{issue}</li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              ) : (
                <p className="text-sm">
                  Automatic validation found no blocking issues.
                </p>
              )}
              {summary.warnings.length > 0 && (
                <>
                  <Alert>
                    <AlertDescription>
                      <p className="font-medium">Items to acknowledge</p>
                      <ul className="mt-2 flex list-disc flex-col gap-2 pl-5">
                        {summary.warnings.map((issue) => (
                          <li key={issue}>{issue}</li>
                        ))}
                      </ul>
                    </AlertDescription>
                  </Alert>
                  <FieldGroup>
                    <form.Field name="acknowledgeWarnings">
                      {(field) => (
                        <Field orientation="horizontal" data-disabled={saving}>
                          <Checkbox
                            id="acknowledge-warnings"
                            checked={field.state.value}
                            onCheckedChange={(checked) =>
                              field.handleChange(checked === true)
                            }
                            disabled={saving}
                          />
                          <FieldLabel htmlFor="acknowledge-warnings">
                            I understand these warnings and incomplete setup.
                          </FieldLabel>
                        </Field>
                      )}
                    </form.Field>
                  </FieldGroup>
                </>
              )}
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
            </DialogBody>
            <DialogFooter>
              <Button
                type="button"
                variant="secondary"
                disabled={saving}
                onClick={() => setOpen(false)}
              >
                Keep preparing
              </Button>
              <LoadingButton
                type="submit"
                loading={saving}
                disabled={
                  Boolean(summary.blockers.length) ||
                  (summary.warnings.length > 0 && !acknowledged)
                }
              >
                Mark ready
              </LoadingButton>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
