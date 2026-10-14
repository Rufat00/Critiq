'use client';
import { useState } from 'react';
import { useForm, useStore } from '@tanstack/react-form';
import { useRouter } from 'next/navigation';
import { Logo } from '@/components/logo';
import { Input } from '@/components/ui/input';
import { LoadingButton } from '@/components/ui/button';
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldError,
} from '@/components/ui/field';
import { beginSetupAction } from '../actions';

export function SetupWelcome() {
  const router = useRouter();
  const [error, setError] = useState<string>();
  const form = useForm({
    defaultValues: { passcode: '' },
    onSubmit: async ({ value }) => {
      setError(undefined);
      try {
        const result = await beginSetupAction(value.passcode);
        if (!result.ok) setError(result.error.message);
        else {
          router.push('/register');
          router.refresh();
        }
      } catch {
        setError('Unable to connect. Please try again.');
      }
    },
  });
  const pending = useStore(form.store, (state) => state.isSubmitting);
  return (
    <main className="flex min-h-svh justify-center px-5 pb-24 pt-[20svh] sm:items-center sm:py-12">
      <div className="flex w-full max-w-md flex-col gap-10">
        <h1 className="flex flex-col items-center gap-5">
          <span className="text-4xl font-semibold tracking-tight sm:text-5xl">
            Welcome to
          </span>
          <Logo className="h-14" />
        </h1>
        <form
          autoComplete="off"
          onSubmit={(event) => {
            event.preventDefault();
            void form.handleSubmit();
          }}
        >
          <FieldGroup>
            <form.Field name="passcode">
              {(field) => (
                <Field data-invalid={Boolean(error)} data-disabled={pending}>
                  <FieldLabel htmlFor="setup-passcode">
                    Setup passcode
                  </FieldLabel>
                  <Input
                    id="setup-passcode"
                    name={field.name}
                    type="password"
                    required
                    maxLength={256}
                    value={field.state.value}
                    onChange={(event) => {
                      field.handleChange(event.target.value);
                      setError(undefined);
                    }}
                    onBlur={field.handleBlur}
                    disabled={pending}
                    aria-invalid={Boolean(error)}
                    aria-describedby="setup-error"
                    className="h-12"
                  />
                  <FieldError id="setup-error">{error}</FieldError>
                </Field>
              )}
            </form.Field>
            <LoadingButton
              type="submit"
              size="lg"
              className="w-full"
              loading={pending}
            >
              Begin setup
            </LoadingButton>
          </FieldGroup>
        </form>
      </div>
    </main>
  );
}
