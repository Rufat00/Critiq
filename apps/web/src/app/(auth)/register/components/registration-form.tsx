'use client';
import { useEffect, useRef, useState } from 'react';
import { useForm, useStore } from '@tanstack/react-form';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { LoadingButton } from '@/components/ui/button';
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldDescription,
  FieldError,
  FieldSet,
  FieldLegend,
  FieldContent,
} from '@/components/ui/field';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { VerificationCodeForm } from '@/components/auth/verification-code-form';
import type { RegisterAccountInput } from '@critiq/core/registration';
import type { AppFieldErrors } from '@critiq/core/errors';
import {
  registerAccountAction,
  requestRegistrationCodeAction,
} from '../../actions';

import {
  withRegistrationCodeTimeout,
  RegistrationCodeTimeoutError,
} from '../lib/with-registration-code-timeout';

const validateFullName = ({ value }: { value: string }) =>
  value.trim().split(/\s+/u).filter(Boolean).length >= 2
    ? undefined
    : { message: 'Enter at least two words for your full name.' };
const validatePassword = ({ value }: { value: string }) => {
  if (/[\s\p{Cc}\p{Cf}]/u.test(value))
    return {
      message: 'Password cannot contain spaces or invisible characters.',
    };
  if (value.length < 8) return { message: 'Use at least 8 characters.' };
  if (value.length > 128)
    return { message: 'Use no more than 128 characters.' };
  return undefined;
};
const registrationFields = [
  'name',
  'email',
  'password',
  'agreementRules',
  'agreementPrivacy',
] as const;

export function RegistrationForm({
  mode,
  setup,
  invitedEmail,
  invitationToken,
}: {
  mode: 'otp' | 'password';
  setup: boolean;
  invitedEmail?: string | null;
  invitationToken?: string;
}) {
  const router = useRouter();
  const [step, setStep] = useState<'details' | 'code'>('details');
  const [error, setError] = useState<string>();
  const completed = useRef(false);
  const showCodeAfterSubmit = useRef(false);
  const form = useForm({
    defaultValues: {
      name: '',
      email: invitedEmail || '',
      password: '',
      agreementRules: false,
      agreementPrivacy: false,
    },
    onSubmit: async () => {
      setError(undefined);
      try {
        const result = mode === 'otp' ? await requestCode() : await register();
        if (!result.ok) setError(result.error);
        else if (mode === 'otp') showCodeAfterSubmit.current = true;
      } catch (error) {
        setError(
          error instanceof RegistrationCodeTimeoutError
            ? error.message
            : 'Unable to connect. Please try again.',
        );
      }
    },
  });
  const pending = useStore(form.store, (state) => state.isSubmitting);
  const dirty = useStore(form.store, (state) => state.isDirty);
  const agreementsAccepted = useStore(
    form.store,
    (state) => state.values.agreementRules && state.values.agreementPrivacy,
  );
  useEffect(() => {
    const guard = (event: BeforeUnloadEvent) => {
      if (dirty && !completed.current) event.preventDefault();
    };
    window.addEventListener('beforeunload', guard);
    return () => window.removeEventListener('beforeunload', guard);
  }, [dirty]);
  function input(): RegisterAccountInput {
    const value = form.state.values;
    return {
      ...value,
      name: value.name.trim(),
      email: value.email.trim().toLowerCase(),
      agreementRules: value.agreementRules as true,
      agreementPrivacy: value.agreementPrivacy as true,
      invitationToken,
    };
  }
  function showFieldErrors(errors?: AppFieldErrors) {
    for (const name of registrationFields) {
      const message = errors?.[name]?.[0];
      form.setFieldMeta(name, (meta) => ({
        ...meta,
        isTouched: message ? true : meta.isTouched,
        errorMap: {
          ...meta.errorMap,
          onServer: message ? { message } : undefined,
        },
      }));
    }
  }
  function clearServerError(name: (typeof registrationFields)[number]) {
    form.setFieldMeta(name, (meta) => ({
      ...meta,
      errorMap: { ...meta.errorMap, onServer: undefined },
    }));
    setError(undefined);
  }
  async function register(code?: string) {
    const result = await registerAccountAction(input(), code);
    if (!result.ok) {
      showFieldErrors(result.error.fieldErrors);
      return { ok: false, error: result.error.message };
    }
    completed.current = true;
    form.setFieldValue('password', '');
    router.replace(result.data.destination);
    router.refresh();
    return { ok: true };
  }
  async function requestCode() {
    const result = await withRegistrationCodeTimeout(
      requestRegistrationCodeAction(input()),
    );
    if (!result.ok) {
      showFieldErrors(result.error.fieldErrors);
      return { ok: false, error: result.error.message };
    }
    return { ok: true };
  }
  async function submitRegistration() {
    if (form.state.isSubmitting) return;
    showCodeAfterSubmit.current = false;
    try {
      await form.handleSubmit();
      // Finish TanStack's submit lifecycle before removing its mounted fields.
      if (showCodeAfterSubmit.current) setStep('code');
    } catch (error) {
      console.error('Registration form submission failed.', {
        errorType: error instanceof Error ? error.name : typeof error,
      });
      // Validation can reject before TanStack reaches its onSubmit finally block.
      // Reset the lifecycle while retaining every input and its original defaults.
      form.reset(form.state.values, { keepDefaultValues: true });
      setError('We could not complete this step. Please try again.');
    }
  }
  if (step === 'code')
    return (
      <VerificationCodeForm
        email={form.state.values.email.trim().toLowerCase()}
        onVerify={register}
        onResend={requestCode}
        onBack={() => {
          setStep('details');
          setError(undefined);
        }}
      />
    );
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-3 text-center">
        <h1 className="text-4xl font-semibold tracking-tight">
          {setup ? 'Create your owner account' : 'Create an account'}
        </h1>
      </header>
      <form
        autoComplete="off"
        onSubmit={(event) => {
          event.preventDefault();
          void submitRegistration();
        }}
      >
        <FieldGroup>
          <form.Field
            name="name"
            validators={{
              onBlur: validateFullName,
              onSubmit: validateFullName,
            }}
          >
            {(field) => {
              const invalid =
                field.state.meta.isTouched && !field.state.meta.isValid;
              return (
                <Field data-invalid={invalid} data-disabled={pending}>
                  <FieldLabel htmlFor="full-name">Full name</FieldLabel>
                  <Input
                    id="full-name"
                    name={field.name}
                    required
                    maxLength={120}
                    value={field.state.value}
                    onChange={(event) => {
                      field.handleChange(event.target.value);
                      clearServerError(field.name);
                    }}
                    onBlur={field.handleBlur}
                    disabled={pending}
                    aria-invalid={invalid}
                    aria-describedby="name-error"
                    className="h-12"
                  />
                  {invalid && (
                    <FieldError
                      id="name-error"
                      errors={field.state.meta.errors}
                    />
                  )}
                </Field>
              );
            }}
          </form.Field>
          <form.Field name="email">
            {(field) => {
              const invalid =
                field.state.meta.isTouched && !field.state.meta.isValid;
              const disabled = pending || Boolean(invitedEmail);
              return (
                <Field data-invalid={invalid} data-disabled={disabled}>
                  <FieldLabel htmlFor="registration-email">Email</FieldLabel>
                  <Input
                    id="registration-email"
                    name={field.name}
                    type="email"
                    required
                    maxLength={254}
                    value={field.state.value}
                    onChange={(event) => {
                      field.handleChange(event.target.value);
                      clearServerError(field.name);
                    }}
                    onBlur={field.handleBlur}
                    disabled={disabled}
                    aria-invalid={invalid}
                    aria-describedby="email-help email-error"
                    className="h-12"
                  />
                  {invitedEmail && (
                    <FieldDescription id="email-help">
                      This email is linked to your invitation.
                    </FieldDescription>
                  )}
                  {invalid && (
                    <FieldError
                      id="email-error"
                      errors={field.state.meta.errors}
                    />
                  )}
                </Field>
              );
            }}
          </form.Field>
          <form.Field
            name="password"
            validators={{
              onBlur: validatePassword,
              onSubmit: validatePassword,
            }}
          >
            {(field) => {
              const invalid =
                field.state.meta.isTouched && !field.state.meta.isValid;
              return (
                <Field data-invalid={invalid} data-disabled={pending}>
                  <FieldLabel htmlFor="registration-password">
                    Password
                  </FieldLabel>
                  <Input
                    id="registration-password"
                    name={field.name}
                    type="password"
                    maxLength={128}
                    value={field.state.value}
                    onChange={(event) => {
                      field.handleChange(event.target.value);
                      clearServerError(field.name);
                    }}
                    onBlur={field.handleBlur}
                    disabled={pending}
                    aria-invalid={invalid}
                    aria-describedby={invalid ? 'password-error' : undefined}
                    className="h-12"
                  />
                  {invalid && (
                    <FieldError
                      id="password-error"
                      errors={field.state.meta.errors}
                    />
                  )}
                </Field>
              );
            }}
          </form.Field>
          <FieldSet disabled={pending}>
            <FieldLegend className="sr-only">Agreements</FieldLegend>
            <FieldGroup>
              <form.Field
                name="agreementRules"
                validators={{
                  onSubmit: ({ value }) =>
                    value
                      ? undefined
                      : {
                          message: 'Please accept the participation agreement.',
                        },
                }}
              >
                {(field) => {
                  const invalid =
                    field.state.meta.isTouched && !field.state.meta.isValid;
                  return (
                    <Field
                      orientation="horizontal"
                      data-invalid={invalid}
                      data-disabled={pending}
                      className="items-start"
                    >
                      <Checkbox
                        id="agreement-rules"
                        name={field.name}
                        checked={field.state.value}
                        onCheckedChange={(checked) => {
                          field.handleChange(checked === true);
                          clearServerError(field.name);
                        }}
                        onBlur={field.handleBlur}
                        disabled={pending}
                        required
                        aria-invalid={invalid}
                        aria-describedby="rules-error"
                        className="mt-0.5"
                      />
                      <FieldContent>
                        <FieldLabel htmlFor="agreement-rules">
                          I agree to participate fairly and follow the hackathon
                          rules.
                        </FieldLabel>
                        {invalid && (
                          <FieldError
                            id="rules-error"
                            errors={field.state.meta.errors}
                          />
                        )}
                      </FieldContent>
                    </Field>
                  );
                }}
              </form.Field>
              <form.Field
                name="agreementPrivacy"
                validators={{
                  onSubmit: ({ value }) =>
                    value
                      ? undefined
                      : { message: 'Please accept the privacy agreement.' },
                }}
              >
                {(field) => {
                  const invalid =
                    field.state.meta.isTouched && !field.state.meta.isValid;
                  return (
                    <Field
                      orientation="horizontal"
                      data-invalid={invalid}
                      data-disabled={pending}
                      className="items-start"
                    >
                      <Checkbox
                        id="agreement-privacy"
                        name={field.name}
                        checked={field.state.value}
                        onCheckedChange={(checked) => {
                          field.handleChange(checked === true);
                          clearServerError(field.name);
                        }}
                        onBlur={field.handleBlur}
                        disabled={pending}
                        required
                        aria-invalid={invalid}
                        aria-describedby="privacy-error"
                        className="mt-0.5"
                      />
                      <FieldContent>
                        <FieldLabel htmlFor="agreement-privacy">
                          I agree to the use of my registration details for this
                          hackathon.
                        </FieldLabel>
                        {invalid && (
                          <FieldError
                            id="privacy-error"
                            errors={field.state.meta.errors}
                          />
                        )}
                      </FieldContent>
                    </Field>
                  );
                }}
              </form.Field>
            </FieldGroup>
          </FieldSet>
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <LoadingButton
            type="submit"
            size="lg"
            className="w-full"
            loading={pending}
            disabled={!agreementsAccepted}
          >
            {mode === 'otp' ? 'Verify email' : 'Create account'}
          </LoadingButton>
        </FieldGroup>
      </form>
      <p className="text-center text-sm text-muted-foreground">
        {setup ? 'Return to' : 'Already registered?'}{' '}
        <Link
          href="/"
          className="font-medium text-primary underline-offset-4 hover:underline"
          onClick={(event) => {
            if (
              pending ||
              (dirty &&
                !window.confirm(
                  'Leave registration? Your unsaved details will be lost.',
                ))
            )
              event.preventDefault();
          }}
        >
          {setup ? 'setup welcome' : 'Sign in'}
        </Link>
      </p>
    </div>
  );
}
