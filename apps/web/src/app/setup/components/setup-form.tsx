'use client';

import { useEffect, useState } from 'react';
import { useForm, useStore } from '@tanstack/react-form';
import { useRouter } from 'next/navigation';
import { RiArrowRightLine } from '@remixicon/react';
import { LoadingButton } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldError,
  FieldDescription,
} from '@/components/ui/field';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { WorkspacePreview } from './workspace-preview';
import { completeSetupAction } from '../actions';

export function SetupForm() {
  const router = useRouter();
  const [fieldError, setFieldError] = useState<string>();
  const [error, setError] = useState<string>();
  const [saved, setSaved] = useState(false);
  const form = useForm({
    defaultValues: { name: '' },
    onSubmit: async ({ value }) => {
      setError(undefined);
      setFieldError(undefined);
      try {
        const result = await completeSetupAction(value);
        if (!result.ok) {
          if (result.error.fieldErrors?.name)
            setFieldError(result.error.fieldErrors.name[0]);
          else setError(result.error.message);
          return;
        }
        setSaved(true);
        router.replace('/admin?setup=complete');
        router.refresh();
      } catch {
        setError(
          'Unable to connect. Your name has not been saved. Please try again.',
        );
      }
    },
  });
  const name = useStore(form.store, (state) => state.values.name);
  const pending = useStore(form.store, (state) => state.isSubmitting);
  const dirty = useStore(form.store, (state) => state.isDirty);

  useEffect(() => {
    if (!dirty || saved) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty, saved]);

  return (
    <div className="grid items-center gap-10 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.3fr)] md:gap-12">
      <div className="flex flex-col gap-8">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Name your hackathon
        </h1>
        <form
          autoComplete="off"
          onSubmit={(event) => {
            event.preventDefault();
            void form.handleSubmit();
          }}
        >
          <FieldGroup>
            <form.Field name="name">
              {(field) => (
                <Field
                  data-invalid={Boolean(fieldError)}
                  data-disabled={pending || saved}
                >
                  <FieldLabel htmlFor="hackathon-name">
                    Hackathon name
                  </FieldLabel>
                  <Input
                    id="hackathon-name"
                    name={field.name}
                    placeholder="RowdyHacks"
                    required
                    maxLength={100}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(event) => {
                      field.handleChange(event.target.value);
                      setFieldError(undefined);
                      setError(undefined);
                    }}
                    disabled={pending || saved}
                    aria-invalid={Boolean(fieldError)}
                    aria-describedby="hackathon-name-help hackathon-name-error"
                  />
                  <FieldDescription id="hackathon-name-help">
                    We’ll add “Judging” to your workspace name.
                  </FieldDescription>
                  <FieldError id="hackathon-name-error">
                    {fieldError}
                  </FieldError>
                </Field>
              )}
            </form.Field>
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <LoadingButton
              type="submit"
              size="lg"
              loading={pending || saved}
              disabled={!name.trim() || saved}
            >
              {saved ? 'Opening your workspace…' : 'Create Hackathon'}
              <RiArrowRightLine data-icon="inline-end" />
            </LoadingButton>
          </FieldGroup>
        </form>
      </div>
      <WorkspacePreview name={name} />
    </div>
  );
}
