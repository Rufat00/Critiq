'use client';
import { useState } from 'react';
import { useForm, useStore } from '@tanstack/react-form';
import { useRouter } from 'next/navigation';
import { authClient } from '@/lib/auth/auth-client';
import { Input } from '@/components/ui/input';
import { Button, LoadingButton } from '@/components/ui/button';
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldError,
} from '@/components/ui/field';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { VerificationCodeForm } from '@/components/auth/verification-code-form';
import { getSignInDestinationAction } from '../actions';

export function LoginForm({
  mode,
  registered,
}: {
  mode: 'otp' | 'password';
  registered: boolean;
}) {
  const router = useRouter();
  const [step, setStep] = useState<'email' | 'password' | 'code'>('email');
  const [error, setError] = useState<string>();
  async function finish() {
    const result = await getSignInDestinationAction();
    if (!result.ok) return { ok: false, error: result.error.message };
    router.replace(result.data.destination);
    router.refresh();
    return { ok: true };
  }
  async function requestCode(email: string) {
    const result = await authClient.emailOtp.sendVerificationOtp({
      email,
      type: 'sign-in',
    });
    return result.error
      ? { ok: false, error: 'We could not send a code. Please try again.' }
      : { ok: true };
  }
  const form = useForm({
    defaultValues: { email: '', password: '' },
    onSubmit: async ({ value }) => {
      setError(undefined);
      try {
        const email = value.email.trim().toLowerCase();
        if (step === 'email') {
          form.setFieldValue('email', email);
          if (mode === 'password') setStep('password');
          else {
            const result = await requestCode(email);
            if (result.ok) setStep('code');
            else setError(result.error);
          }
        } else {
          const result = await authClient.signIn.email({
            email,
            password: value.password,
          });
          if (result.error)
            setError(
              'The email or password is incorrect, or your account is unavailable.',
            );
          else {
            const destination = await finish();
            if (!destination.ok) setError(destination.error);
          }
        }
      } catch {
        setError('Unable to connect. Please try again.');
      }
    },
  });
  const pending = useStore(form.store, (state) => state.isSubmitting);
  const email = useStore(form.store, (state) => state.values.email);
  if (step === 'code')
    return (
      <VerificationCodeForm
        email={email}
        onResend={() => requestCode(email)}
        onBack={() => {
          setStep('email');
          setError(undefined);
        }}
        onVerify={async (otp) => {
          const result = await authClient.signIn.emailOtp({ email, otp });
          return result.error
            ? {
                ok: false,
                error: 'The code is incorrect or expired. Please try again.',
              }
            : finish();
        }}
      />
    );
  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-3 text-center">
        <h1 className="text-4xl font-semibold tracking-tight">
          {step === 'password' ? 'Enter your password' : 'Sign in'}
        </h1>
        {step === 'password' && (
          <p className="break-all text-muted-foreground">{email}</p>
        )}
      </header>
      {registered && (
        <Alert role="status">
          <AlertDescription>
            Your account is ready. Sign in to continue.
          </AlertDescription>
        </Alert>
      )}
      <form
        autoComplete="off"
        onSubmit={(event) => {
          event.preventDefault();
          void form.handleSubmit();
        }}
      >
        <FieldGroup>
          {step === 'email' ? (
            <form.Field name="email">
              {(field) => (
                <Field data-invalid={Boolean(error)} data-disabled={pending}>
                  <FieldLabel htmlFor="login-email">Email</FieldLabel>
                  <Input
                    id="login-email"
                    name={field.name}
                    type="email"
                    required
                    maxLength={254}
                    value={field.state.value}
                    onChange={(event) => {
                      field.handleChange(event.target.value);
                      setError(undefined);
                    }}
                    onBlur={field.handleBlur}
                    disabled={pending}
                    aria-invalid={Boolean(error)}
                    aria-describedby="login-email-error"
                    className="h-12"
                  />
                  <FieldError id="login-email-error">{error}</FieldError>
                </Field>
              )}
            </form.Field>
          ) : (
            <form.Field name="password">
              {(field) => (
                <Field data-invalid={Boolean(error)} data-disabled={pending}>
                  <FieldLabel htmlFor="login-password">Password</FieldLabel>
                  <Input
                    id="login-password"
                    name={field.name}
                    type="password"
                    required
                    maxLength={128}
                    value={field.state.value}
                    onChange={(event) => {
                      field.handleChange(event.target.value);
                      setError(undefined);
                    }}
                    onBlur={field.handleBlur}
                    disabled={pending}
                    aria-invalid={Boolean(error)}
                    aria-describedby="login-password-error"
                    className="h-12"
                  />
                  <FieldError id="login-password-error">{error}</FieldError>
                </Field>
              )}
            </form.Field>
          )}
          <LoadingButton
            type="submit"
            size="lg"
            className="w-full"
            loading={pending}
          >
            {step === 'email' ? 'Continue' : 'Sign in'}
          </LoadingButton>
          {step === 'password' && (
            <Button
              type="button"
              variant="ghost"
              className="w-full"
              disabled={pending}
              onClick={() => {
                setStep('email');
                form.setFieldValue('password', '');
                setError(undefined);
              }}
            >
              Use a different email
            </Button>
          )}
        </FieldGroup>
      </form>
    </div>
  );
}
